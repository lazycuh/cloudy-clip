package webhook

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"strconv"
	"testing"
	"time"

	"github.com/brianvoe/gofakeit/v7"
	"github.com/h2non/gock"
	"github.com/stretchr/testify/require"
	_billingDto "github.com/cloudy-clip/api/internal/billing/dto"
	_jetModel "github.com/cloudy-clip/api/internal/common/database/.jet/model"
	"github.com/cloudy-clip/api/internal/common/http/middleware/turnstile"
	"github.com/cloudy-clip/api/internal/subscription/dto"
	data "github.com/cloudy-clip/api/test"
	"github.com/cloudy-clip/api/test/debug"
	test "github.com/cloudy-clip/api/test/utils"
)

func TestStripeWebhook(t1 *testing.T) {
	test.Integration(t1, func(testServer *httptest.Server) {
		t1.Run("1. checkout.session.completed event handler adds payment method as default when there's no existing payment method on file", func(t2 *testing.T) {
			sessionCookie, testUser := test.CreateAndLoginUser(t2, testServer)

			test.MockCustomerCreationRequest(t2, testUser)

			gock.New("https://api.stripe.com").
				Post("/v1/subscriptions").
				Reply(http.StatusCreated).
				JSON(debug.JsonParse(`
					{
						"latest_invoice": {
							"payment_intent": {
								"client_secret": "pi_123456789"
							},
							"subtotal":   199,
							"tax":        0,
							"amount_due": 199,
							"customer_address": {
								"postal_code": "99301",
								"country": "US"
							}
						}
					}
				`))

			response, _ := test.SendPostRequest(
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

			getPaymentMethodsResponse, getPaymentMethodsResponseBody := test.SendGetRequest(
				t2,
				testServer,
				"/api/v1/billing/my/payment-methods",
				map[string]string{
					"Cookie": sessionCookie,
				},
			)

			require.Equal(t2, http.StatusOK, getPaymentMethodsResponse.StatusCode)
			require.Len(t2, getPaymentMethodsResponseBody["payload"], 0)

			paymentMethodId := gofakeit.UUID()

			gock.New("https://api.stripe.com").
				Get("/v1/setup_intents/seti_123456789").
				Reply(http.StatusCreated).
				JSON(debug.JsonParse(`
					{
						"payment_method": {
							"id": "%v"
						}
					}`,
					paymentMethodId,
				))

			gock.New("https://api.stripe.com").
				Get("v1/payment_methods/" + paymentMethodId).
				Reply(http.StatusCreated).
				JSON(debug.JsonParse(`
					{
						"card": {
							"exp_month": 1,
							"exp_year": %v,
							"last4": "4242",
							"brand": "visa"
						}
					}`,
					time.Now().Year()+4,
				))

			gock.New("https://api.stripe.com").
				Post("/v1/customers/" + testUser.StripeCustomerId).
				AddMatcher(test.CreateRequestBodyMatcher(
					t2,
					`{
						"invoice_settings[default_payment_method]": "%v"
					}`,
					paymentMethodId),
				).
				Reply(http.StatusOK).
				JSON(map[string]any{})

			test.CallStripeWebhook(
				t2,
				testServer,
				fmt.Sprintf(`
					{
						"api_version": "2024-06-20",
						"id": "evt_1QSv3BIWw5KeSeJEKLJJz32q",
						"object": "event",
						"type": "checkout.session.completed",
						"data": {
							"object": {
								"id": "cs_test_123456789",
								"object": "checkout.session",
								"customer": "%v",
								"customer_details": {
									"address": null,
									"email": "%v",
									"name": "%v",
									"phone": null,
									"tax_exempt": null,
									"tax_ids": []
								},
								"customer_email": null,
								"metadata": {
									"userId": "%v"
								},
								"setup_intent": "seti_123456789"
							}
						}
					}`,
					testUser.StripeCustomerId,
					testUser.Email,
					testUser.DisplayName,
					testUser.UserId,
				),
			)

			getPaymentMethodsResponse, getPaymentMethodsResponseBody = test.SendGetRequest(
				t2,
				testServer,
				"/api/v1/billing/my/payment-methods",
				map[string]string{
					"Cookie": sessionCookie,
				},
			)

			require.Equal(t2, http.StatusOK, getPaymentMethodsResponse.StatusCode)
			require.Len(t2, getPaymentMethodsResponseBody["payload"], 1)
		})

		t1.Run("2. checkout.session.completed event handler does not add payment method as default when there's already existing default payment method on file", func(t2 *testing.T) {
			sessionCookie, testUser, usedPaymentMethod := test.StartPaidPlan(
				t2,
				testServer,
				data.LitePlanMonthlyOfferingId,
			)

			getPaymentMethodsResponse, getPaymentMethodsResponseBody := test.SendGetRequest(
				t2,
				testServer,
				"/api/v1/billing/my/payment-methods",
				map[string]string{
					"Cookie": sessionCookie,
				},
			)

			require.Equal(t2, http.StatusOK, getPaymentMethodsResponse.StatusCode)
			require.Len(t2, getPaymentMethodsResponseBody["payload"], 1)

			paymentMethodId := gofakeit.UUID()

			gock.New("https://api.stripe.com").
				Get("/v1/setup_intents/seti_123456789").
				Reply(http.StatusCreated).
				JSON(debug.JsonParse(`
					{
						"payment_method": {
							"id": "%v"
						}
					}`,
					paymentMethodId,
				))

			gock.New("https://api.stripe.com").
				Get("v1/payment_methods/" + paymentMethodId).
				Reply(http.StatusCreated).
				JSON(debug.JsonParse(`
					{
						"card": {
							"exp_month": 1,
							"exp_year": %v,
							"last4": "4242",
							"brand": "visa"
						}
					}`,
					time.Now().Year()+4,
				))

			test.CallStripeWebhook(
				t2,
				testServer,
				fmt.Sprintf(`
					{
						"api_version": "2024-06-20",
						"id": "evt_1QSv3BIWw5KeSeJEKLJJz32q",
						"object": "event",
						"type": "checkout.session.completed",
						"data": {
							"object": {
								"id": "cs_test_123456789",
								"object": "checkout.session",
								"customer": "%v",
								"customer_details": {
									"address": null,
									"email": "%v",
									"name": "%v",
									"phone": null,
									"tax_exempt": null,
									"tax_ids": []
								},
								"customer_email": null,
								"metadata": {
									"userId": "%v"
								},
								"setup_intent": "seti_123456789"
							}
						}
					}`,
					testUser.StripeCustomerId,
					testUser.Email,
					testUser.DisplayName,
					testUser.UserId,
				),
			)

			getPaymentMethodsResponse, getPaymentMethodsResponseBody = test.SendGetRequest(
				t2,
				testServer,
				"/api/v1/billing/my/payment-methods",
				map[string]string{
					"Cookie": sessionCookie,
				},
			)

			require.Equal(t2, http.StatusOK, getPaymentMethodsResponse.StatusCode)
			require.Len(t2, getPaymentMethodsResponseBody["payload"], 2)
			require.ElementsMatch(
				t2,
				debug.JsonParseArray(debug.JsonStringify([]any{
					usedPaymentMethod,
					_billingDto.NewPaymentMethod(_jetModel.PaymentMethod{
						PaymentMethodID: paymentMethodId,
						ExpMonth:        "1",
						ExpYear:         strconv.Itoa(time.Now().Year() + 4),
						Last4:           "4242",
						Brand:           "visa",
						IsDefault:       false,
						IsDeleted:       false,
					}),
				})),
				getPaymentMethodsResponseBody["payload"], 2)
		})
	})
}
