package webhook

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"regexp"
	"testing"
	"time"

	"github.com/h2non/gock"
	"github.com/stretchr/testify/require"
	"github.com/stripe/stripe-go/v79"
	"github.com/cloudy-clip/api/internal/billing"
	"github.com/cloudy-clip/api/internal/common/environment"
	data "github.com/cloudy-clip/api/test"
	test "github.com/cloudy-clip/api/test/utils"
)

func TestSubscriptionDeletedEvent(t1 *testing.T) {
	test.Integration(t1, func(testServer *httptest.Server) {
		t1.Run("1. marks subscription as canceled", func(t2 *testing.T) {
			sessionCookie, testUser, _ := test.StartPaidPlan(t2, testServer, data.LitePlanMonthlyOfferingId)

			billingInfo, err := billing.
				GetBillingRepository().
				FindBillingInfoByUserId(context.Background(), nil, testUser.UserId)
			if err != nil {
				panic(err)
			}

			require.NotEmpty(t2, billingInfo.StripeSubscriptionID)

			_ = test.CancelPaidPlan(t2, testServer, sessionCookie)

			currentSubscriptionAfter := test.RestoreAuthenticatedUserSession(t2, testServer, sessionCookie).Subscription
			require.NotNil(t2, currentSubscriptionAfter)
			require.NotNil(t2, currentSubscriptionAfter.CanceledAt)

			billingInfoAfterCancellation, err := billing.
				GetBillingRepository().
				FindBillingInfoByUserId(context.Background(), nil, testUser.UserId)
			if err != nil {
				panic(err)
			}

			require.Nil(t2, billingInfoAfterCancellation.StripeSubscriptionID)
		})

		t1.Run("2. sends email if cancellation reason is due to failed payment", func(t2 *testing.T) {
			_, testUser, _ := test.StartPaidPlan(t2, testServer, data.LitePlanMonthlyOfferingId)

			gock.New("https://api.resend.com").
				Post("/emails").
				AddMatcher(test.CreateRequestBodyMatcherFunc(func(requestBody map[string]any) {
					require.Equal(t2, []any{testUser.Email}, requestBody["to"])
					require.Equal(t2, "Subscription canceled", requestBody["subject"])
					require.Equal(t2, "Cloudy Clip <no-reply@cloudyclip.com>", requestBody["from"])
					require.Empty(t2, requestBody["text"])

					htmlBody := requestBody["html"]
					require.NotContains(t2, "{{.HostName}}", htmlBody)
					require.Contains(
						t2,
						htmlBody,
						environment.Config.AccessControlAllowOrigin+"/images/cloudy-clip-bg-transparent.png",
					)
					require.Contains(t2, htmlBody, "Hi "+testUser.DisplayName+",")

					require.NotContains(t2, htmlBody, "{{.Subscription}}")
					require.Regexp(
						t2,
						regexp.MustCompile(`.*This email confirms that your Lite \(Monthly\) subscription\s+has now been canceled due to multiple failed payment\s+attempts following our previous notifications\.`),
						htmlBody,
					)

					require.Regexp(
						t2,
						regexp.MustCompile(`.*While your paid subscription is now canceled and you will no\s+longer have access to premium features, your account remains\s+active\.`),
						htmlBody,
					)

					require.Regexp(
						t2,
						regexp.MustCompile(`.*If you wish to regain access to premium features, you will\s+need to resubscribe here:`),
						htmlBody,
					)
					require.NotContains(t2, htmlBody, `<a href="{{.HostName}}/pricing">{{.HostName}}/pricing</a>`)
					require.Contains(
						t2,
						htmlBody,
						fmt.Sprintf(
							`<a href="%s/pricing">%s/pricing</a>`,
							environment.Config.AccessControlAllowOrigin,
							environment.Config.AccessControlAllowOrigin,
						),
					)

					require.Regexp(
						t2,
						regexp.MustCompile(`.*We look forward to having you back in the future. If you\s+have any questions or feedback, please don't hesitate to\s+reach out to us. We are always here to help you\.`),
						htmlBody,
					)

					require.Contains(t2, htmlBody, "Thank you,")

					require.Contains(t2, htmlBody, "The Cloudy Clip Team")
					require.Contains(t2, htmlBody, "Terms of Service")
					require.Contains(
						t2,
						htmlBody,
						environment.Config.AccessControlAllowOrigin+"/policies/terms-of-service",
					)
					require.Contains(t2, htmlBody, "Privacy Policy")
					require.Contains(t2, htmlBody, "|")
					require.Contains(
						t2,
						htmlBody,
						environment.Config.AccessControlAllowOrigin+"/policies/privacy-policy",
					)
				})).
				Reply(http.StatusOK).
				JSON(map[string]any{})

			test.CallStripeWebhook(
				t2,
				testServer,
				fmt.Sprintf(`
					{
						"api_version": "2024-06-20",
						"created": 1731912713,
						"id": "evt_1QMOoPIWw5KeSeJEwNzigLq9",
						"object": "event",
						"type": "customer.subscription.deleted",
						"data": {
							"object": {
								"id": "%v",
								"object": "subscription",
								"canceled_at": %v,
								"cancellation_details": {
									"comment": null,
									"feedback": null,
									"reason": "%v"
								},
								"customer": "%v",
								"metadata": {
									"userEmail": "%v",
									"userId": "%v",
									"offeringId": "%v"
								},
								"status": "canceled"
							}
						}
					}`,
					testUser.StripeSubscriptionId,
					time.Now().Unix(),
					stripe.SubscriptionCancellationDetailsReasonPaymentFailed,
					testUser.StripeCustomerId,
					testUser.Email,
					testUser.UserId,
					data.LitePlanMonthlyOfferingId,
				),
			)

		})

	})
}
