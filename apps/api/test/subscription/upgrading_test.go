package subscription

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/brianvoe/gofakeit/v7"
	"github.com/h2non/gock"
	"github.com/stretchr/testify/require"
	"github.com/cloudy-clip/api/internal/common/exception"
	"github.com/cloudy-clip/api/internal/common/plan"
	"github.com/cloudy-clip/api/internal/subscription"
	data "github.com/cloudy-clip/api/test"

	"github.com/cloudy-clip/api/test/debug"
	"github.com/cloudy-clip/api/test/subscription/helpers"
	test "github.com/cloudy-clip/api/test/utils"
)

func TestUpgrading(t1 *testing.T) {
	test.Integration(t1, func(testServer *httptest.Server) {
		const fromOfferingId = data.LitePlanMonthlyOfferingId
		const toOfferingId = data.EssentialPlanMonthlyOfferingId

		t1.Run("1. can create checkout preview", func(t2 *testing.T) {
			sessionCookie, testUser, usedPaymentMethod := test.StartPaidPlan(t2, testServer, fromOfferingId)

			helpers.MockGettingSubscriptionItem(testUser)

			gock.New("https://api.stripe.com").
				Post("/v1/invoices/create_preview").
				AddMatcher(test.CreateRequestBodyMatcherFunc(func(requestBody map[string]any) {
					require.Len(t2, requestBody, 7)

					require.Subset(
						t2,
						requestBody,
						debug.JsonParse(`
							{
								"customer":"%v",
								"subscription": "%v",
								"subscription_details[proration_behavior]": "always_invoice",
								"subscription_details[billing_cycle_anchor]": "now",
								"subscription_details[items][0][id]": "%v",
								"subscription_details[items][0][price]": "%v"
							}`,
							testUser.StripeCustomerId,
							testUser.StripeSubscriptionId,
							helpers.StripeSubscriptionItemId,
							plan.GetPriceIdByOfferingId(toOfferingId),
						),
					)

					require.NotEmpty(t2, requestBody, "subscription_details[proration_date]")
				})).
				Reply(http.StatusOK).
				JSON(debug.JsonParse(`
					{
						"subtotal_excluding_tax": %v,
						"tax": 0,
						"lines": {
							"data": [
								{
									"amount": -50
								}
							]
						},
						"total": %v,
						"currency": "usd",
						"customer_address": {
							"country":     "US",
							"postal_code": "99301"
						},
						"discount": {
							"coupon": {
								"amount_off": 10
							}
						}
					}
				`,
					data.PriceTable[toOfferingId],
					data.PriceTable[toOfferingId]-50,
				))

			response, responseBody := test.SendGetRequest(
				t2,
				testServer,
				"/api/v1/checkout/preview?offeringId="+toOfferingId,
				map[string]string{
					"Cookie": sessionCookie,
				},
			)

			require.Equal(t2, http.StatusOK, response.StatusCode)

			prorationDateCookie := test.GetCookieFromResponse(t2, response, subscription.ProrationDateCookieName)
			require.NotEqual(t2, "", prorationDateCookie.Value)
			require.Equal(t2, 30*60, prorationDateCookie.MaxAge)

			require.Equal(
				t2,
				debug.JsonParse(`
					{
						"amountDue": "349",
						"discount": "10",
						"currencyCode": "usd",
						"refund": "50",
						"subtotal": "399",
						"tax": "0",
						"taxPercentage": "0.00",
						"storedPaymentMethods": [
							{
								"brand": "%v",
								"expMonth": "%v",
								"expYear": "%v",
								"isDefault": %v,
								"last4": "%v",
								"paymentMethodId": "%v"
							}
						]
					}`,
					usedPaymentMethod.Brand,
					usedPaymentMethod.ExpMonth,
					usedPaymentMethod.ExpYear,
					usedPaymentMethod.IsDefault,
					usedPaymentMethod.Last4,
					usedPaymentMethod.PaymentMethodId,
				),
				responseBody["payload"],
			)
		})

		t1.Run("2. can upgrade and add correct payment records", func(t2 *testing.T) {
			sessionCookie, _, _ := helpers.UpgradeSubscriptionSuccessfully(t2, testServer, fromOfferingId, toOfferingId)

			payments, totalPayments := test.GetPayments(t2, testServer, sessionCookie, 0, 25)
			require.Len(t2, payments, 2)
			require.Equal(t2, 2, totalPayments)

			require.Subset(
				t2,
				payments[0],
				debug.JsonParse(`
					{
						"amountDue": "%v",
						"currencyCode": "usd",
						"discount": "0",
						"failureReason": null,
						"paymentReason": "SUBSCRIPTION_UPGRADE",
						"status": "PAID",
						"subtotal": "%v",
						"tax": "0"
					}`,
					data.PriceTable[toOfferingId]-data.PriceTable[fromOfferingId],
					data.PriceTable[toOfferingId]-data.PriceTable[fromOfferingId],
				),
			)
			require.NotEmpty(t2, test.GetValueFromMap(payments[0], "paymentId"))
			require.NotEmpty(t2, test.GetValueFromMap(payments[0], "paidAt"))
			require.NotEmpty(t2, test.GetValueFromMap(payments[0], "paymentMethodBrand"))
			require.NotEmpty(t2, test.GetValueFromMap(payments[0], "paymentMethodLast4"))

			require.Subset(
				t2,
				payments[1],
				debug.JsonParse(`
					{
						"amountDue": "%v",
						"currencyCode": "usd",
						"discount": "0",
						"failureReason": null,
						"paymentReason": "NEW_SUBSCRIPTION",
						"status": "PAID",
						"subtotal": "%v",
						"tax": "0"
					}`,
					data.PriceTable[fromOfferingId],
					data.PriceTable[fromOfferingId],
				),
			)
			require.NotEmpty(t2, test.GetValueFromMap(payments[1], "paymentId"))
			require.NotEmpty(t2, test.GetValueFromMap(payments[1], "paidAt"))
			require.NotEmpty(t2, test.GetValueFromMap(payments[1], "paymentMethodBrand"))
			require.NotEmpty(t2, test.GetValueFromMap(payments[1], "paymentMethodLast4"))
		})

		t1.Run("3. return 400 when payment method ID is missing", func(t2 *testing.T) {
			sessionCookie, testUser, _ := test.StartPaidPlan(t2, testServer, fromOfferingId)

			_, cookies := helpers.PreviewSubscriptionUpdateCheckout(
				t2,
				testServer,
				testUser,
				sessionCookie,
				toOfferingId,
				data.PriceTable[toOfferingId],
			)

			response, responseBody := test.SendPutRequest(
				t2,
				testServer,
				"/api/v1/subscriptions/my",
				map[string]any{
					"offeringId": toOfferingId,
				},
				map[string]string{
					"Cookie": fmt.Sprintf("%v; %v", sessionCookie, cookies),
				},
			)

			require.Equal(t2, http.StatusBadRequest, response.StatusCode)
			require.Equal(t2, exception.DefaultValidationExceptionMessage, responseBody["message"])
			require.Equal(
				t2,
				"missing or empty",
				test.GetValueFromMap(responseBody, "payload", "extra", "paymentMethodId"),
			)
		})

		t1.Run("4. return 402 when payment fails", func(t2 *testing.T) {
			sessionCookie, testUser, _ := test.StartPaidPlan(t2, testServer, fromOfferingId)

			_, cookies := helpers.PreviewSubscriptionUpdateCheckout(
				t2,
				testServer,
				testUser,
				sessionCookie,
				toOfferingId,
				data.PriceTable[toOfferingId],
			)

			helpers.MockSubscriptionUpdate(
				testUser,
				nil,
				http.StatusPaymentRequired,
				debug.JsonParse(`
					{
						"error": {
							"code": "card_declined",
							"decline_code": "generic_decline"
						}
					}`,
				))

			response, responseBody := test.SendPutRequest(
				t2,
				testServer,
				"/api/v1/subscriptions/my",
				map[string]any{
					"offeringId":      toOfferingId,
					"paymentMethodId": gofakeit.UUID(),
				},
				map[string]string{
					"Cookie": fmt.Sprintf("%v; %v", sessionCookie, cookies),
				},
			)

			require.Equal(t2, http.StatusPaymentRequired, response.StatusCode)
			require.Equal(t2, `payment failed with reason "card_declined.generic_decline"`, responseBody["message"])
			require.Equal(
				t2,
				"card_declined.generic_decline",
				test.GetValueFromMap(responseBody, "payload", "extra", "failureReason"),
			)
		})

		t1.Run("5. return 400 when proration date cookie is missing", func(t2 *testing.T) {
			sessionCookie, testUser, _ := test.StartPaidPlan(t2, testServer, fromOfferingId)

			_, _ = helpers.PreviewSubscriptionUpdateCheckout(
				t2,
				testServer,
				testUser,
				sessionCookie,
				toOfferingId,
				data.PriceTable[toOfferingId],
			)

			response, responseBody := test.SendPutRequest(
				t2,
				testServer,
				"/api/v1/subscriptions/my",
				map[string]any{
					"offeringId":      toOfferingId,
					"paymentMethodId": gofakeit.UUID(),
				},
				map[string]string{
					"Cookie": sessionCookie,
				},
			)

			require.Equal(t2, http.StatusBadRequest, response.StatusCode)
			require.Equal(t2, "failed to update subscription", responseBody["message"])
			require.Equal(t2, "RequiredStatesAreMissingException", test.GetValueFromMap(responseBody, "payload", "code"))
		})

		t1.Run("6. can change from monthly to yearly and add expected payment records", func(t2 *testing.T) {
			sessionCookie, _, _ := helpers.UpgradeSubscriptionSuccessfully(t2, testServer, fromOfferingId, toOfferingId)

			payments, totalPayments := test.GetPayments(t2, testServer, sessionCookie, 0, 25)
			require.Len(t2, payments, 2)
			require.Equal(t2, 2, totalPayments)

			require.Subset(
				t2,
				payments[0],
				debug.JsonParse(`
					{
						"amountDue": "%v",
						"currencyCode": "usd",
						"discount": "0",
						"failureReason": null,
						"paymentReason": "SUBSCRIPTION_UPGRADE",
						"status": "PAID",
						"subtotal": "%v",
						"tax": "0"
					}`,
					data.PriceTable[toOfferingId]-data.PriceTable[fromOfferingId],
					data.PriceTable[toOfferingId]-data.PriceTable[fromOfferingId],
				),
			)
			require.NotEmpty(t2, test.GetValueFromMap(payments[0], "paymentId"))
			require.NotEmpty(t2, test.GetValueFromMap(payments[0], "paidAt"))
			require.NotEmpty(t2, test.GetValueFromMap(payments[0], "paymentMethodBrand"))
			require.NotEmpty(t2, test.GetValueFromMap(payments[0], "paymentMethodLast4"))

			require.Subset(
				t2,
				payments[1],
				debug.JsonParse(`
					{
						"amountDue": "%v",
						"currencyCode": "usd",
						"discount": "0",
						"failureReason": null,
						"paymentReason": "NEW_SUBSCRIPTION",
						"status": "PAID",
						"subtotal": "%v",
						"tax": "0"
					}`,
					data.PriceTable[fromOfferingId],
					data.PriceTable[fromOfferingId],
				),
			)
			require.NotEmpty(t2, test.GetValueFromMap(payments[1], "paymentId"))
			require.NotEmpty(t2, test.GetValueFromMap(payments[1], "paidAt"))
			require.NotEmpty(t2, test.GetValueFromMap(payments[1], "paymentMethodBrand"))
			require.NotEmpty(t2, test.GetValueFromMap(payments[1], "paymentMethodLast4"))
		})

	})
}
