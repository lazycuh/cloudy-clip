package webhook

import (
	"net/http"
	"net/http/httptest"
	"regexp"
	"testing"
	"time"

	"github.com/h2non/gock"
	"github.com/stretchr/testify/require"
	"github.com/stripe/stripe-go/v79"
	"github.com/cloudy-clip/api/internal/common/currency"
	"github.com/cloudy-clip/api/internal/common/environment"
	"github.com/cloudy-clip/api/internal/common/http/middleware/turnstile"
	"github.com/cloudy-clip/api/internal/subscription/dto"
	data "github.com/cloudy-clip/api/test"
	"github.com/cloudy-clip/api/test/debug"
	test "github.com/cloudy-clip/api/test/utils"
)

func TestFailedPaymentEvent(t1 *testing.T) {
	test.Integration(t1, func(testServer *httptest.Server) {
		t1.Run("1. adds failed payment record", func(t2 *testing.T) {
			sessionCookie, testUser, _ := test.StartPaidPlan(t2, testServer, data.LitePlanMonthlyOfferingId)

			_ = test.CancelPaidPlan(t2, testServer, sessionCookie)

			paymentsAfterCancellation, totalPaymentsAfterCancellation := test.GetPayments(
				t2,
				testServer,
				sessionCookie,
				0,
				10,
			)

			require.Equal(t2, 2, totalPaymentsAfterCancellation)
			require.Len(t2, paymentsAfterCancellation, 2)

			require.Equal(t2, "REFUNDED", test.GetValueFromMap(paymentsAfterCancellation[0], "status"))
			require.Equal(t2, "PAID", test.GetValueFromMap(paymentsAfterCancellation[1], "status"))

			// Add a delay to ensure that payment records are sorted by time correctly
			time.Sleep(16 * time.Millisecond)

			_ = test.TriggerInvoicePaymentFailedStripeEvent(
				t2,
				testServer,
				testUser,
				data.LitePlanMonthlyOfferingId,
				"",
				stripe.InvoiceBillingReasonSubscriptionCreate,
			)

			paymentsAfterPaymentFailure, totalPaymentsAfterPaymentFailure := test.GetPayments(
				t2,
				testServer,
				sessionCookie,
				0,
				10,
			)

			require.Equal(t2, 3, totalPaymentsAfterPaymentFailure)
			require.Len(t2, paymentsAfterPaymentFailure, 3)

			firstPaymentAfterPaymentFailure := paymentsAfterPaymentFailure[0].(map[string]any)
			require.Equal(t2, "FAILED", firstPaymentAfterPaymentFailure["status"])
			require.Equal(t2, "card_declined.generic_decline", firstPaymentAfterPaymentFailure["failureReason"])

			secondPaymentAfterPaymentFailure := paymentsAfterPaymentFailure[1].(map[string]any)
			require.Equal(t2, "REFUNDED", secondPaymentAfterPaymentFailure["status"])
			require.Nil(t2, secondPaymentAfterPaymentFailure["failureReason"])

			thirdPaymentAfterPaymentFailure := paymentsAfterPaymentFailure[2].(map[string]any)
			require.Equal(t2, "PAID", thirdPaymentAfterPaymentFailure["status"])
			require.Nil(t2, thirdPaymentAfterPaymentFailure["failureReason"])
		})

		t1.Run("2. does not add charged card as default payment method", func(t2 *testing.T) {
			sessionCookie, testUser, usedPaymentMethod := test.StartPaidPlan(
				t2,
				testServer,
				data.LitePlanMonthlyOfferingId,
			)

			_ = test.CancelPaidPlan(t2, testServer, sessionCookie)

			getPaymentMethodsResponse, getPaymentMethodsResponseBody := test.SendGetRequest(
				t2,
				testServer,
				"/api/v1/billing/my/payment-methods",
				map[string]string{
					"Cookie": sessionCookie,
				},
			)

			require.Equal(t2, http.StatusOK, getPaymentMethodsResponse.StatusCode)

			getPaymentMethodsPayload := getPaymentMethodsResponseBody["payload"].([]any)

			require.Len(t2, getPaymentMethodsPayload, 1)

			require.Equal(
				t2,
				debug.JsonParse(debug.JsonStringify(usedPaymentMethod)),
				getPaymentMethodsPayload[0],
			)

			_ = test.TriggerInvoicePaymentFailedStripeEvent(
				t2,
				testServer,
				testUser,
				data.LitePlanMonthlyOfferingId,
				"",
				stripe.InvoiceBillingReasonSubscriptionCreate,
			)

			getPaymentMethodsResponseAfterPaymentFailure, getPaymentMethodsResponseBodyAfterPaymentFailure := test.SendGetRequest(
				t2,
				testServer,
				"/api/v1/billing/my/payment-methods",
				map[string]string{
					"Cookie": sessionCookie,
				},
			)

			require.Equal(t2, http.StatusOK, getPaymentMethodsResponseAfterPaymentFailure.StatusCode)

			getPaymentMethodsPayloadAfterPaymentFailure := getPaymentMethodsResponseBodyAfterPaymentFailure["payload"].([]any)

			require.Len(t2, getPaymentMethodsPayloadAfterPaymentFailure, 2)

			require.Equal(
				t2,
				debug.JsonParse(debug.JsonStringify(usedPaymentMethod)),
				getPaymentMethodsPayloadAfterPaymentFailure[0],
			)

			failedPaymentMethod := getPaymentMethodsPayloadAfterPaymentFailure[1].(map[string]any)
			require.NotEqual(t2, usedPaymentMethod.Last4, failedPaymentMethod["last4"])
			require.False(t2, failedPaymentMethod["isDefault"].(bool))
		})

		t1.Run("3. sends email for subscription renewal", func(t2 *testing.T) {
			_, testUser, _ := test.StartPaidPlan(
				t2,
				testServer,
				data.LitePlanMonthlyOfferingId,
			)

			gock.New("https://api.resend.com").
				Post("/emails").
				AddMatcher(test.CreateRequestBodyMatcherFunc(func(requestBody map[string]any) {
					require.Equal(t2, []any{testUser.Email}, requestBody["to"])
					require.Equal(t2, "Failed subscription renewal payment", requestBody["subject"])
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
						regexp.MustCompile(`.*We wanted to let you know that your recent automatic\s+subscription renewal payment for the amount of`),
						htmlBody,
					)
					require.Contains(t2, htmlBody, currency.Prettify(data.PriceTable[data.LitePlanMonthlyOfferingId])+" has failed.")

					require.Regexp(
						t2,
						regexp.MustCompile(`.*To ensure uninterrupted access to your data, please update\s+your payment information immediately here:`),
						htmlBody,
					)

					require.NotContains(
						t2,
						htmlBody,
						"{{.HostName}}/my/payment-methods",
					)
					require.Contains(
						t2,
						htmlBody,
						`href="`+environment.Config.AccessControlAllowOrigin+`/my/payment-methods"`,
					)
					require.Contains(
						t2,
						htmlBody,
						environment.Config.AccessControlAllowOrigin+"/my/payment-methods",
					)

					require.Regexp(
						t2,
						regexp.MustCompile(`.*If your payment details are already up-to-date, there might\s+be a temporary issue with your payment method\. Please\s+contact your bank or payment provider to resolve it\.`),
						htmlBody,
					)

					require.Regexp(
						t2,
						regexp.MustCompile(`.*We will attempt to process the payment again the next day\.\s+<strong>\s+If the payment continues to fail after the third retry\s+attempt, your subscription will be canceled\s+automatically\.\s+</strong>`),
						htmlBody,
					)

					require.Contains(t2, htmlBody, "Thank you for your prompt attention,")
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

			_ = test.TriggerInvoicePaymentFailedStripeEvent(
				t2,
				testServer,
				testUser,
				data.LitePlanMonthlyOfferingId,
				"",
				stripe.InvoiceBillingReasonSubscriptionCycle,
			)
		})

		t1.Run("4. marks task as failed", func(t2 *testing.T) {
			sessionCookie, testUser := test.CreateAndLoginUser(t2, testServer)

			test.MockCustomerCreationRequest(t2, testUser)

			test.MockSubscriptionCreationRequest(t2, testUser, data.LitePlanMonthlyOfferingId, true)

			response, responseBody := test.SendPostRequest(
				t2,
				testServer,
				"/api/v1/checkout",
				dto.FirstSubscriptionCheckoutRequest{
					FullName:    testUser.DisplayName,
					OfferingId:  data.LitePlanMonthlyOfferingId,
					CountryCode: "US",
					PostalCode:  "99301",
				},
				map[string]string{
					"Cookie":                       sessionCookie,
					turnstile.TurnstileTokenHeader: "turnstile-token",
				},
			)

			require.Equal(t2, http.StatusOK, response.StatusCode)

			taskId := test.GetValueFromMap(responseBody, "payload", "taskId").(string)

			_ = test.TriggerInvoicePaymentFailedStripeEvent(
				t2,
				testServer,
				testUser,
				data.LitePlanMonthlyOfferingId,
				taskId,
				stripe.InvoiceBillingReasonSubscriptionCreate,
			)

			test.VerifyTaskStatus(t2, testServer, sessionCookie, taskId, "FAILURE")
		})
	})
}
