package subscription

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"regexp"
	"slices"
	"testing"
	"time"

	"github.com/brianvoe/gofakeit/v7"
	"github.com/h2non/gock"
	"github.com/stretchr/testify/require"
	"github.com/cloudy-clip/api/internal/common/currency"
	"github.com/cloudy-clip/api/internal/common/environment"
	"github.com/cloudy-clip/api/internal/subscription/model"
	data "github.com/cloudy-clip/api/test"
	"github.com/cloudy-clip/api/test/debug"
	test "github.com/cloudy-clip/api/test/utils"
)

func TestCancellationFlow(t1 *testing.T) {
	test.Integration(t1, func(testServer *httptest.Server) {
		t1.Run("1. can cancel paid plan and refund customer", func(t2 *testing.T) {
			sessionCookie, _, _ := test.StartPaidPlan(t2, testServer, data.LitePlanMonthlyOfferingId)

			paymentsBeforeCancellation, totalPaymentsBeforeCancellation := test.GetPayments(
				t2,
				testServer,
				sessionCookie,
				0,
				25,
			)

			require.Equal(t2, 1, totalPaymentsBeforeCancellation)
			require.Len(t2, paymentsBeforeCancellation, 1)

			payment1BeforeCancellation := paymentsBeforeCancellation[0]

			require.Equal(
				t2,
				currency.FormatInt(data.PriceTable[data.LitePlanMonthlyOfferingId]),
				test.GetValueFromMap(payment1BeforeCancellation, "amountDue"),
			)

			_ = test.CancelPaidPlan(t2, testServer, sessionCookie)

			paymentsAfterSuccessfulRefund, totalPaymentsAfterSuccessfulRefund := test.GetPayments(
				t2,
				testServer,
				sessionCookie,
				0,
				25,
			)

			require.Equal(t2, 2, totalPaymentsAfterSuccessfulRefund)
			require.Len(t2, paymentsAfterSuccessfulRefund, 2)

			refundedPaymentIndex := slices.IndexFunc(paymentsAfterSuccessfulRefund, func(current any) bool {
				return test.GetValueFromMap(current, "status").(string) == "REFUNDED"
			})
			inprogressPaymentIndex := slices.IndexFunc(paymentsAfterSuccessfulRefund, func(current any) bool {
				return test.GetValueFromMap(current, "status").(string) == "REFUND_IN_PROGRESS"
			})

			require.Equal(t2, -1, inprogressPaymentIndex)
			require.NotEqual(t2, -1, refundedPaymentIndex)
			require.Equal(
				t2,
				"SUBSCRIPTION_CANCELLATION",
				test.GetValueFromMap(paymentsAfterSuccessfulRefund[refundedPaymentIndex], "paymentReason"),
			)
		})

		t1.Run("2. can cancel free plan", func(t2 *testing.T) {
			sessionCookie := test.StartFreePlan(t2, testServer, data.FreePlanMonthlyOfferingId)

			response, _ := test.SendDeleteRequest(
				t2,
				testServer,
				"/api/v1/subscriptions/my",
				map[string]string{
					"Cookie": sessionCookie,
				},
			)

			require.Equal(t2, http.StatusNoContent, response.StatusCode)

			testUserAfter := test.RestoreAuthenticatedUserSession(t2, testServer, sessionCookie)
			require.NotNil(t2, testUserAfter.Subscription)
			require.Equal(t2, "Free", testUserAfter.Subscription.Plan.DisplayName)
			require.NotNil(t2, testUserAfter.Subscription.CanceledAt)
			require.Equal(
				t2,
				model.SubscriptionCancellationReasonRequestedByUser,
				*testUserAfter.Subscription.CancellationReason,
			)
		})

		t1.Run("3. can get subscription cancellation refund amount", func(t2 *testing.T) {
			sessionCookie, _, _ := test.StartPaidPlan(t2, testServer, data.LitePlanMonthlyOfferingId)

			gock.New("https://api.stripe.com").
				Post("/v1/invoices/create_preview").
				Reply(http.StatusOK).
				JSON(map[string]any{
					"total": float64(101),
				})

			response, responseBody := test.SendGetRequest(
				t2,
				testServer,
				"/api/v1/subscriptions/my/cancellation",
				map[string]string{
					"Cookie": sessionCookie,
				},
			)

			require.Equal(t2, http.StatusOK, response.StatusCode)
			require.Equal(t2, float64(101), responseBody["payload"])
		})

		t1.Run("4. return 400 when getting cancellation refund and subscription is less than 7 days old for production execution profile", func(t2 *testing.T) {
			originalExecutionProfile := environment.Config.ExecutionProfile

			environment.Config.ExecutionProfile = environment.ExecutionProfileProduction

			sessionCookie, testUser, _ := test.StartPaidPlan(t2, testServer, data.LitePlanMonthlyOfferingId)

			subscriptionCreatedDate := time.
				Now().
				Add(-7 * 23 * time.Hour)

			gock.New("https://api.stripe.com").
				Get("/v1/subscriptions/" + testUser.StripeSubscriptionId).
				Reply(http.StatusOK).
				JSON(map[string]any{
					"created": subscriptionCreatedDate.Unix(),
				})

			response, responseBody := test.SendGetRequest(
				t2,
				testServer,
				"/api/v1/subscriptions/my/cancellation",
				map[string]string{
					"Cookie": sessionCookie,
				},
			)

			payload := responseBody["payload"].(map[string]any)

			require.Equal(t2, http.StatusBadRequest, response.StatusCode)
			require.Equal(t2, "subscription was created less than 7 days ago", responseBody["message"])

			actualDate, err := time.Parse(time.RFC3339, payload["extra"].(map[string]any)["startDate"].(string))
			if err != nil {
				panic(err)
			}

			require.Equal(t2, subscriptionCreatedDate.Year(), actualDate.Year())
			require.Equal(t2, subscriptionCreatedDate.Month(), actualDate.Month())
			require.Equal(t2, subscriptionCreatedDate.Day(), actualDate.Day())
			require.Equal(t2, subscriptionCreatedDate.Hour(), actualDate.Hour())
			require.Equal(t2, subscriptionCreatedDate.Minute(), actualDate.Minute())
			require.Equal(t2, subscriptionCreatedDate.Second(), actualDate.Second())

			environment.Config.ExecutionProfile = originalExecutionProfile
		})

		t1.Run("5. return 400 when getting cancellation refund for free plan", func(t2 *testing.T) {
			sessionCookie := test.StartFreePlan(t2, testServer, data.FreePlanMonthlyOfferingId)

			response, responseBody := test.SendGetRequest(
				t2,
				testServer,
				"/api/v1/subscriptions/my/cancellation",
				map[string]string{
					"Cookie": sessionCookie,
				},
			)

			require.Equal(t2, http.StatusBadRequest, response.StatusCode)

			require.Equal(t2, "free plan cannot get cancellation refund", responseBody["message"])
		})

		t1.Run("6. can get cancellation refund anytime regardless of when subscription was created for non-production execution profile", func(t2 *testing.T) {
			sessionCookie, _, _ := test.StartPaidPlan(t2, testServer, data.LitePlanMonthlyOfferingId)

			gock.New("https://api.stripe.com").
				Post("/v1/invoices/create_preview").
				Reply(http.StatusOK).
				JSON(map[string]any{
					"total": float64(101),
				})

			response, _ := test.SendGetRequest(
				t2,
				testServer,
				"/api/v1/subscriptions/my/cancellation",
				map[string]string{
					"Cookie": sessionCookie,
				},
			)

			require.Equal(t2, http.StatusOK, response.StatusCode)
		})

		t1.Run("7. sends cancellation confirmation email", func(t2 *testing.T) {
			sessionCookie, testUser, _ := test.StartPaidPlan(t2, testServer, data.LitePlanMonthlyOfferingId)

			activeOfferingId := testUser.Subscription.Plan.OfferingId

			mockRefundAmount := 50

			gock.New("https://api.stripe.com").
				Post("/v1/invoices/create_preview").
				AddMatcher(test.CreateRequestBodyMatcherFunc(func(requestBody map[string]any) {
					require.Len(t2, requestBody, 5)

					require.Equal(t2, requestBody["customer"], testUser.StripeCustomerId)
					require.Equal(t2, requestBody["subscription"], testUser.StripeSubscriptionId)
					require.Equal(t2, requestBody["subscription_details[cancel_now]"], "true")
					require.Equal(t2, requestBody["subscription_details[proration_behavior]"], "always_invoice")
					require.NotEmpty(t2, requestBody["subscription_details[proration_date]"])
				})).
				Reply(http.StatusOK).
				JSON(map[string]any{
					"total": mockRefundAmount,
				})

			gock.New("https://api.stripe.com").
				Delete("/v1/subscriptions/" + testUser.StripeSubscriptionId).
				Reply(http.StatusOK).
				JSON(map[string]any{})

			paymentMethod := test.GetOrCreateDefaultPaymentMethod(testUser)

			chargeId := "ch_" + gofakeit.UUID()

			gock.New("https://api.stripe.com").
				Get("/v1/charges/search").
				Reply(http.StatusOK).
				JSON(debug.JsonParse(`
					{
						"object": "list",
						"data": [
							{
								"id": "%v",
								"object": "charge",
								"amount": %v,
								"amount_captured": %v,
								"amount_refunded": 0,
								"balance_transaction": "txn_123456789",
								"currency": "usd",
								"customer": "%v",
								"invoice": "in_123456789",
								"outcome": {
									"network_advice_code": null,
									"network_decline_code": null,
									"network_status": "approved_by_network",
									"reason": null,
									"risk_level": "normal",
									"risk_score": 22,
									"seller_message": "Payment complete.",
									"type": "authorized"
								},
								"paid": true,
								"payment_intent": "pi_123456789",
								"payment_method": "%v"
							}
						],
						"has_more": false
					}`,
					chargeId,
					data.PriceTable[activeOfferingId],
					data.PriceTable[activeOfferingId],
					testUser.StripeCustomerId,
					paymentMethod.PaymentMethodId,
				))

			gock.New("https://api.stripe.com").
				Post("/v1/refunds").
				AddMatcher(test.CreateRequestBodyMatcher(
					t2,
					`{
						"amount": "%v",
						"charge": "%v"
					}`,
					mockRefundAmount,
					chargeId,
				)).
				Reply(http.StatusOK).
				JSON(map[string]any{})

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

					require.Regexp(
						t2,
						regexp.MustCompile(`.*We wanted to let you know that your Lite \(Monthly\)\s+subscription has been successfully canceled\. You will not be\s+charged anymore\.`),
						htmlBody,
					)

					require.Regexp(
						t2,
						regexp.MustCompile(`.*A refund of \$0\.50 will be issued back to the\s+original payment method within 5-10 business days for the\s+unused portion of your subscription\. To check the status of\s+your refund, please visit`),
						htmlBody,
					)

					require.Contains(t2, htmlBody, environment.Config.AccessControlAllowOrigin+"/my/billing")
					require.Regexp(
						t2,
						regexp.MustCompile(`.*Billing history</a> page\s+in your dashboard\.`),
						htmlBody,
					)

					require.Regexp(
						t2,
						regexp.MustCompile(`.*Please note that all your created journals will be deleted\s+in 7 days unless you re-subscribe by accessing`),
						htmlBody,
					)
					require.Contains(t2, htmlBody, environment.Config.AccessControlAllowOrigin+"/my/subscription")
					require.Regexp(
						t2,
						regexp.MustCompile(`.*Subscription</a>\s+page in your dashboard\.`),
						htmlBody,
					)
					require.Regexp(
						t2,
						regexp.MustCompile(`.*We look forward to having you back in the future\. If you\s+have any questions or feedback, please don't hesitate to\s+reach out to us\. We are always here to help you\.`),
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

			response, _ := test.SendDeleteRequest(
				t2,
				testServer,
				"/api/v1/subscriptions/my",
				map[string]string{
					"Cookie": sessionCookie,
				},
			)

			require.Equal(t2, http.StatusNoContent, response.StatusCode)

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
									"reason": "cancellation_requested"
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
					testUser.StripeCustomerId,
					testUser.Email,
					testUser.UserId,
					activeOfferingId,
				),
			)
		})

		t1.Run("8. Does not mention a refund in cancellation confirmation email when refund is $0", func(t2 *testing.T) {
			sessionCookie, testUser, _ := test.StartPaidPlan(t2, testServer, data.LitePlanMonthlyOfferingId)

			mockRefundAmount := 0

			gock.New("https://api.stripe.com").
				Post("/v1/invoices/create_preview").
				AddMatcher(test.CreateRequestBodyMatcherFunc(func(requestBody map[string]any) {
					require.Len(t2, requestBody, 5)

					require.Equal(t2, requestBody["customer"], testUser.StripeCustomerId)
					require.Equal(t2, requestBody["subscription"], testUser.StripeSubscriptionId)
					require.Equal(t2, requestBody["subscription_details[cancel_now]"], "true")
					require.Equal(t2, requestBody["subscription_details[proration_behavior]"], "always_invoice")
					require.NotEmpty(t2, requestBody["subscription_details[proration_date]"])
				})).
				Reply(http.StatusOK).
				JSON(map[string]any{
					"total": mockRefundAmount,
				})

			gock.New("https://api.stripe.com").
				Delete("/v1/subscriptions/" + testUser.StripeSubscriptionId).
				Reply(http.StatusOK).
				JSON(map[string]any{})

			gock.New("https://api.resend.com").
				Post("/emails").
				AddMatcher(test.CreateRequestBodyMatcherFunc(func(requestBody map[string]any) {
					htmlBody := requestBody["html"]

					require.NotContains(t2, htmlBody, "A refund of")

					require.NotContains(t2, htmlBody, environment.Config.AccessControlAllowOrigin+"/my/billing")
					require.NotRegexp(
						t2,
						regexp.MustCompile(`.*Billing history</a> page\s+in your dashboard\.`),
						htmlBody,
					)
				})).
				Reply(http.StatusOK).
				JSON(map[string]any{})

			response, _ := test.SendDeleteRequest(
				t2,
				testServer,
				"/api/v1/subscriptions/my",
				map[string]string{
					"Cookie": sessionCookie,
				},
			)

			require.Equal(t2, http.StatusNoContent, response.StatusCode)
		})
	})
}
