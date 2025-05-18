package subscription

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"regexp"
	"strings"
	"testing"
	"time"

	"github.com/brianvoe/gofakeit/v7"
	"github.com/go-jet/jet/v2/postgres"
	"github.com/h2non/gock"
	"github.com/stretchr/testify/require"
	"github.com/cloudy-clip/api/internal/common/currency"
	"github.com/cloudy-clip/api/internal/common/database"
	"github.com/cloudy-clip/api/internal/common/database/.jet/table"
	"github.com/cloudy-clip/api/internal/common/environment"
	"github.com/cloudy-clip/api/internal/common/http/middleware/turnstile"
	"github.com/cloudy-clip/api/internal/common/plan"
	"github.com/cloudy-clip/api/internal/subscription"
	"github.com/cloudy-clip/api/internal/subscription/dto"
	"github.com/cloudy-clip/api/internal/subscription/model"
	data "github.com/cloudy-clip/api/test"
	"github.com/cloudy-clip/api/test/debug"
	test "github.com/cloudy-clip/api/test/utils"
)

func TestCheckoutApi(t1 *testing.T) {
	test.Integration(t1, func(testServer *httptest.Server) {
		t1.Run("1. can checkout paid plan and return expected data", func(t2 *testing.T) {
			sessionCookie, testUser := test.CreateAndLoginUser(t2, testServer)

			offeringId := data.LitePlanMonthlyOfferingId

			test.MockCustomerCreationRequest(t2, testUser)
			test.MockSubscriptionCreationRequest(t2, testUser, offeringId, true)

			checkoutEndpointResponse, checkoutEndpointResponseBody := test.SendPostRequest(
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

			require.Equal(t2, http.StatusOK, checkoutEndpointResponse.StatusCode)

			checkoutResponsePayload := checkoutEndpointResponseBody["payload"].(map[string]any)

			require.Equal(
				t2,
				debug.JsonParse(`
					{
						"clientSecret":  "pi_123456789",
						"subtotal":      "199",
						"tax":           "0",
						"taxPercentage": "0.00",
						"discount":      "0",
						"amountDue":     "199"
					}`,
				),
				checkoutResponsePayload["checkoutResponse"],
			)

			taskEndpointResponse, taskEndpointResponseBody := test.SendGetRequest(
				t2,
				testServer,
				"/api/v1/tasks/"+checkoutResponsePayload["taskId"].(string),
				map[string]string{
					"Cookie": sessionCookie,
				},
			)
			require.Equal(t2, http.StatusOK, taskEndpointResponse.StatusCode)
			require.Equal(t2, "IN_PROGRESS", taskEndpointResponseBody["payload"].(map[string]any)["status"])
		})

		t1.Run("2. can checkout free plan", func(t2 *testing.T) {
			freePlanMonthlyOfferingId := "01J9FAJGRYSF5Y1338HSE07SB8"
			_ = test.StartFreePlan(t2, testServer, freePlanMonthlyOfferingId)
		})

		t1.Run("3. can switch between plans during checkout for a new subscriber", func(t2 *testing.T) {
			sessionCookie, testUser := test.CreateAndLoginUser(t2, testServer)

			gock.New("https://api.stripe.com").
				Post("/v1/customers").
				Reply(http.StatusCreated).
				JSON(map[string]any{
					"id": testUser.StripeCustomerId,
				})

			fullName := gofakeit.Name()

			assertCorrectCheckoutResponse := func(offeringId string) {
				offeringPrice := data.PriceTable[offeringId]

				test.MockSubscriptionCreationRequest(t2, testUser, offeringId, true)

				taskEndpointResponse, taskEndpointResponseBody := test.SendPostRequest(
					t2,
					testServer,
					"/api/v1/checkout",
					dto.FirstSubscriptionCheckoutRequest{
						FullName:    fullName,
						OfferingId:  offeringId,
						CountryCode: "US",
						PostalCode:  "99301",
					},
					map[string]string{
						"Cookie":                       sessionCookie,
						turnstile.TurnstileTokenHeader: "turnstile-token",
					},
				)

				checkoutResponsePayload := taskEndpointResponseBody["payload"].(map[string]any)

				require.Equal(t2, http.StatusOK, taskEndpointResponse.StatusCode)
				require.Equal(
					t2,
					debug.JsonParse(`
						{
							"clientSecret":  "pi_123456789",
							"subtotal":      "%v",
							"tax":           "0",
							"taxPercentage": "0.00",
							"discount":      "0",
							"amountDue":     "%v"
						}
					`, offeringPrice, offeringPrice),
					checkoutResponsePayload["checkoutResponse"],
				)

				taskEndpointResponse, taskEndpointResponseBody = test.SendGetRequest(
					t2,
					testServer,
					"/api/v1/tasks/"+checkoutResponsePayload["taskId"].(string),
					map[string]string{
						"Cookie": sessionCookie,
					},
				)
				require.Equal(t2, http.StatusOK, taskEndpointResponse.StatusCode)
				require.Equal(t2, "IN_PROGRESS", taskEndpointResponseBody["payload"].(map[string]any)["status"])

				currentSubscription := test.RestoreAuthenticatedUserSession(t2, testServer, sessionCookie).Subscription
				require.Nil(t2, currentSubscription)
			}

			litePlanMonthlyOfferingId := "01J9FAJQBCAFBCG5ZV0JE1NDJA"
			essentialPlanMonthlyOfferingId := "01J9FAJY010PPGWYABP8VSSHCV"

			assertCorrectCheckoutResponse(litePlanMonthlyOfferingId)
			assertCorrectCheckoutResponse(essentialPlanMonthlyOfferingId)
		})

		t1.Run("4. returns 400 if `fullName` is empty", func(t2 *testing.T) {
			sessionCookie, _ := test.CreateAndLoginUser(t2, testServer)

			response, responseBody := test.SendPostRequest(
				t2,
				testServer,
				"/api/v1/checkout",
				dto.FirstSubscriptionCheckoutRequest{
					FullName:    "",
					OfferingId:  "01J9FAJQBCAFBCG5ZV0JE1NDJA",
					CountryCode: "US",
					PostalCode:  "99301",
				},
				map[string]string{
					"Cookie":                       sessionCookie,
					turnstile.TurnstileTokenHeader: "turnstile-token",
				},
			)

			require.Equal(t2, http.StatusBadRequest, response.StatusCode)
			require.Subset(
				t2,
				responseBody["payload"],
				map[string]any{
					"code": "ValidationException",
					"extra": map[string]any{
						"fullName": "missing or empty",
					},
				},
			)
		})

		t1.Run("5. returns 400 if `fullName` is missing", func(t2 *testing.T) {
			sessionCookie, _ := test.CreateAndLoginUser(t2, testServer)

			response, responseBody := test.SendPostRequest(
				t2,
				testServer,
				"/api/v1/checkout",
				dto.FirstSubscriptionCheckoutRequest{
					OfferingId:  "01J9FAJQBCAFBCG5ZV0JE1NDJA",
					CountryCode: "US",
					PostalCode:  "99301",
				},
				map[string]string{
					"Cookie":                       sessionCookie,
					turnstile.TurnstileTokenHeader: "turnstile-token",
				},
			)

			require.Equal(t2, http.StatusBadRequest, response.StatusCode)
			require.Subset(
				t2,
				responseBody["payload"],
				map[string]any{
					"code": "ValidationException",
					"extra": map[string]any{
						"fullName": "missing or empty",
					},
				},
			)
		})

		t1.Run("6. returns 400 if `fullName` has more than 64 characters", func(t2 *testing.T) {
			sessionCookie, _ := test.CreateAndLoginUser(t2, testServer)

			response, responseBody := test.SendPostRequest(
				t2,
				testServer,
				"/api/v1/checkout",
				dto.FirstSubscriptionCheckoutRequest{
					FullName:    strings.Repeat("a", 65),
					OfferingId:  "01J9FAJQBCAFBCG5ZV0JE1NDJA",
					CountryCode: "US",
					PostalCode:  "99301",
				},
				map[string]string{
					"Cookie":                       sessionCookie,
					turnstile.TurnstileTokenHeader: "turnstile-token",
				},
			)

			require.Equal(t2, http.StatusBadRequest, response.StatusCode)
			require.Subset(
				t2,
				responseBody["payload"],
				map[string]any{
					"code": "ValidationException",
					"extra": map[string]any{
						"fullName": "must contain at most 64 characters",
					},
				},
			)
		})

		t1.Run("7. returns 400 if `offeringId` does not have exactly 26 characters", func(t2 *testing.T) {
			sessionCookie, testUser := test.CreateAndLoginUser(t2, testServer)

			response, responseBody := test.SendPostRequest(
				t2,
				testServer,
				"/api/v1/checkout",
				dto.FirstSubscriptionCheckoutRequest{
					FullName:    testUser.DisplayName,
					OfferingId:  "01J9FAJQBCAFBCG5ZV0JE1NDJAA",
					CountryCode: "US",
					PostalCode:  "99301",
				},
				map[string]string{
					"Cookie":                       sessionCookie,
					turnstile.TurnstileTokenHeader: "turnstile-token",
				},
			)

			require.Equal(t2, http.StatusBadRequest, response.StatusCode)
			require.Subset(
				t2,
				responseBody["payload"],
				map[string]any{
					"code": "ValidationException",
					"extra": map[string]any{
						"offeringId": "must contain exactly 26 characters",
					},
				},
			)
		})

		t1.Run("8. returns 400 if `offeringId` is missing", func(t2 *testing.T) {
			sessionCookie, testUser := test.CreateAndLoginUser(t2, testServer)

			response, responseBody := test.SendPostRequest(
				t2,
				testServer,
				"/api/v1/checkout",
				dto.FirstSubscriptionCheckoutRequest{
					FullName:    testUser.DisplayName,
					CountryCode: "US",
					PostalCode:  "99301",
				},
				map[string]string{
					"Cookie":                       sessionCookie,
					turnstile.TurnstileTokenHeader: "turnstile-token",
				},
			)

			require.Equal(t2, http.StatusBadRequest, response.StatusCode)
			require.Subset(
				t2,
				responseBody["payload"],
				map[string]any{
					"code": "ValidationException",
					"extra": map[string]any{
						"offeringId": "missing or empty",
					},
				},
			)
		})

		t1.Run("9. returns 400 if `offeringId` is empty", func(t2 *testing.T) {
			sessionCookie, testUser := test.CreateAndLoginUser(t2, testServer)

			response, responseBody := test.SendPostRequest(
				t2,
				testServer,
				"/api/v1/checkout",
				dto.FirstSubscriptionCheckoutRequest{
					FullName:    testUser.DisplayName,
					OfferingId:  "",
					CountryCode: "US",
					PostalCode:  "99301",
				},
				map[string]string{
					"Cookie":                       sessionCookie,
					turnstile.TurnstileTokenHeader: "turnstile-token",
				},
			)

			require.Equal(t2, http.StatusBadRequest, response.StatusCode)
			require.Subset(
				t2,
				responseBody["payload"],
				map[string]any{
					"code": "ValidationException",
					"extra": map[string]any{
						"offeringId": "missing or empty",
					},
				},
			)
		})

		t1.Run("10. returns 400 if `couponCode` has more than 64 characters", func(t2 *testing.T) {
			sessionCookie, testUser := test.CreateAndLoginUser(t2, testServer)

			response, responseBody := test.SendPostRequest(
				t2,
				testServer,
				"/api/v1/checkout",
				dto.FirstSubscriptionCheckoutRequest{
					FullName:    testUser.DisplayName,
					CouponCode:  strings.Repeat("a", 65),
					OfferingId:  "01J9FAJQBCAFBCG5ZV0JE1NDJA",
					CountryCode: "US",
					PostalCode:  "99301",
				},
				map[string]string{
					"Cookie":                       sessionCookie,
					turnstile.TurnstileTokenHeader: "turnstile-token",
				},
			)

			require.Equal(t2, http.StatusBadRequest, response.StatusCode)
			require.Subset(
				t2,
				responseBody["payload"],
				map[string]any{
					"code": "ValidationException",
					"extra": map[string]any{
						"couponCode": "must contain at most 64 characters",
					},
				},
			)
		})

		t1.Run("11. returns 400 if `countryCode` is missing", func(t2 *testing.T) {
			sessionCookie, testUser := test.CreateAndLoginUser(t2, testServer)

			response, responseBody := test.SendPostRequest(
				t2,
				testServer,
				"/api/v1/checkout",
				dto.FirstSubscriptionCheckoutRequest{
					FullName:   testUser.DisplayName,
					OfferingId: "01J9FAJQBCAFBCG5ZV0JE1NDJA",
					PostalCode: "99301",
				},
				map[string]string{
					"Cookie":                       sessionCookie,
					turnstile.TurnstileTokenHeader: "turnstile-token",
				},
			)

			require.Equal(t2, http.StatusBadRequest, response.StatusCode)
			require.Subset(
				t2,
				responseBody["payload"],
				map[string]any{
					"code": "ValidationException",
					"extra": map[string]any{
						"countryCode": "missing or empty",
					},
				},
			)
		})

		t1.Run("12. returns 400 if `countryCode` is empty", func(t2 *testing.T) {
			sessionCookie, testUser := test.CreateAndLoginUser(t2, testServer)

			response, responseBody := test.SendPostRequest(
				t2,
				testServer,
				"/api/v1/checkout",
				dto.FirstSubscriptionCheckoutRequest{
					FullName:    testUser.DisplayName,
					OfferingId:  "01J9FAJQBCAFBCG5ZV0JE1NDJA",
					CountryCode: "",
					PostalCode:  "99301",
				},
				map[string]string{
					"Cookie":                       sessionCookie,
					turnstile.TurnstileTokenHeader: "turnstile-token",
				},
			)

			require.Equal(t2, http.StatusBadRequest, response.StatusCode)
			require.Subset(
				t2,
				responseBody["payload"],
				map[string]any{
					"code": "ValidationException",
					"extra": map[string]any{
						"countryCode": "missing or empty",
					},
				},
			)
		})

		t1.Run("13. returns 400 if `countryCode` contains more than 4 characters", func(t2 *testing.T) {
			sessionCookie, testUser := test.CreateAndLoginUser(t2, testServer)

			response, responseBody := test.SendPostRequest(
				t2,
				testServer,
				"/api/v1/checkout",
				dto.FirstSubscriptionCheckoutRequest{
					FullName:    testUser.DisplayName,
					OfferingId:  "01J9FAJQBCAFBCG5ZV0JE1NDJA",
					CountryCode: "ABCDE",
					PostalCode:  "99301",
				},
				map[string]string{
					"Cookie":                       sessionCookie,
					turnstile.TurnstileTokenHeader: "turnstile-token",
				},
			)

			require.Equal(t2, http.StatusBadRequest, response.StatusCode)
			require.Subset(
				t2,
				responseBody["payload"],
				map[string]any{
					"code": "ValidationException",
					"extra": map[string]any{
						"countryCode": "must contain at most 4 characters",
					},
				},
			)
		})

		t1.Run("14. returns 400 if `countryCode` contains fewer than 2 characters", func(t2 *testing.T) {
			sessionCookie, testUser := test.CreateAndLoginUser(t2, testServer)

			response, responseBody := test.SendPostRequest(
				t2,
				testServer,
				"/api/v1/checkout",
				dto.FirstSubscriptionCheckoutRequest{
					FullName:    testUser.DisplayName,
					OfferingId:  "01J9FAJQBCAFBCG5ZV0JE1NDJA",
					CountryCode: "A",
					PostalCode:  "99301",
				},
				map[string]string{
					"Cookie":                       sessionCookie,
					turnstile.TurnstileTokenHeader: "turnstile-token",
				},
			)

			require.Equal(t2, http.StatusBadRequest, response.StatusCode)
			require.Subset(
				t2,
				responseBody["payload"],
				map[string]any{
					"code": "ValidationException",
					"extra": map[string]any{
						"countryCode": "must contain at least 2 characters",
					},
				},
			)
		})

		t1.Run("15. returns 400 if `postalCode` contains more than 16 characters", func(t2 *testing.T) {
			sessionCookie, testUser := test.CreateAndLoginUser(t2, testServer)

			response, responseBody := test.SendPostRequest(
				t2,
				testServer,
				"/api/v1/checkout",
				dto.FirstSubscriptionCheckoutRequest{
					FullName:    testUser.DisplayName,
					OfferingId:  "01J9FAJQBCAFBCG5ZV0JE1NDJA",
					CountryCode: "US",
					PostalCode:  strings.Repeat("1", 17),
				},
				map[string]string{
					"Cookie":                       sessionCookie,
					turnstile.TurnstileTokenHeader: "turnstile-token",
				},
			)

			require.Equal(t2, http.StatusBadRequest, response.StatusCode)
			require.Subset(
				t2,
				responseBody["payload"],
				map[string]any{
					"code": "ValidationException",
					"extra": map[string]any{
						"postalCode": "must contain at most 16 characters",
					},
				},
			)
		})

		t1.Run("16. does not create stripe customer more than once", func(t2 *testing.T) {
			sessionCookie, testUser := test.CreateAndLoginUser(t2, testServer)

			test.MockCustomerCreationRequest(t2, testUser)

			test.MockSubscriptionCreationRequest(t2, testUser, data.LitePlanMonthlyOfferingId, true)

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

			test.MockSubscriptionCreationRequest(t2, testUser, data.LitePlanMonthlyOfferingId, true)

			response, _ = test.SendPostRequest(
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
		})

		t1.Run("17. creates checkout preview", func(t2 *testing.T) {
			sessionCookie, testUser := test.CreateAndLoginUser(t2, testServer)

			test.MockSubscriptionCreationRequest(t2, testUser, data.LitePlanMonthlyOfferingId, false)

			test.MockCustomerCreationRequest(t2, testUser)

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

			usedPaymentMethod := test.GetOrCreateDefaultPaymentMethod(testUser)

			test.MockSavingDefaultPaymentMethodOnCustomerRequest(t2, testUser, usedPaymentMethod)

			test.TriggerInvoicePaymentSucceededEventForSubscriptionCreateReason(
				t2,
				testServer,
				testUser,
				data.LitePlanMonthlyOfferingId,
				"",
				usedPaymentMethod,
			)

			gock.New("https://api.stripe.com").
				Get("/v1/subscriptions/" + testUser.StripeSubscriptionId).
				Reply(http.StatusOK).
				JSON(map[string]any{
					"items": map[string]any{
						"data": []map[string]any{
							{
								"id": "sub_123456789",
							},
						},
					},
				})

			gock.New("https://api.stripe.com").
				Post("/v1/invoices/create_preview").
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
					data.PriceTable[data.EssentialPlanMonthlyOfferingId],
					data.PriceTable[data.EssentialPlanMonthlyOfferingId]-50,
				))

			response, responseBody := test.SendGetRequest(
				t2,
				testServer,
				"/api/v1/checkout/preview?offeringId="+data.EssentialPlanMonthlyOfferingId,
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

		t1.Run("18. can switch between plans during checkout when subscription has been canceled", func(t2 *testing.T) {
			sessionCookie, authenticatedUser, _ := test.StartPaidPlan(t2, testServer, data.LitePlanMonthlyOfferingId)

			_ = test.CancelPaidPlan(t2, testServer, sessionCookie)

			assertCorrectCheckoutResponse := func(offeringId string) {
				offeringPrice := data.PriceTable[offeringId]

				test.MockSubscriptionCreationRequest(t2, authenticatedUser, offeringId, true)

				checkoutEndpointResponse, checkoutEndpointResponseBody := test.SendPostRequest(
					t2,
					testServer,
					"/api/v1/checkout",
					dto.FirstSubscriptionCheckoutRequest{
						FullName:    authenticatedUser.DisplayName,
						OfferingId:  offeringId,
						CountryCode: "US",
						PostalCode:  "99301",
					},
					map[string]string{
						"Cookie":                       sessionCookie,
						turnstile.TurnstileTokenHeader: "turnstile-token",
					},
				)

				checkoutResponsePayload := checkoutEndpointResponseBody["payload"].(map[string]any)

				require.Equal(t2, http.StatusOK, checkoutEndpointResponse.StatusCode)
				require.Equal(
					t2,
					debug.JsonParse(`
						{
							"clientSecret":  "pi_123456789",
							"subtotal":      "%v",
							"tax":           "0",
							"taxPercentage": "0.00",
							"discount":      "0",
							"amountDue":     "%v"
						}
					`, offeringPrice, offeringPrice),
					checkoutResponsePayload["checkoutResponse"],
				)

				taskEndpointResponse, taskEndpointResponseBody := test.SendGetRequest(
					t2,
					testServer,
					"/api/v1/tasks/"+checkoutResponsePayload["taskId"].(string),
					map[string]string{
						"Cookie": sessionCookie,
					},
				)
				require.Equal(t2, http.StatusOK, taskEndpointResponse.StatusCode)
				require.Equal(t2, "IN_PROGRESS", taskEndpointResponseBody["payload"].(map[string]any)["status"])

				currentSubscription := test.RestoreAuthenticatedUserSession(t2, testServer, sessionCookie).Subscription
				require.NotNil(t2, currentSubscription)
				require.NotNil(t2, currentSubscription.CanceledAt)
				require.Equal(
					t2,
					model.SubscriptionCancellationReasonRequestedByUser,
					*currentSubscription.CancellationReason,
				)
				require.Equal(t2, data.LitePlanMonthlyOfferingId, currentSubscription.Plan.OfferingId)
			}

			assertCorrectCheckoutResponse(data.LitePlanMonthlyOfferingId)
			assertCorrectCheckoutResponse(data.EssentialPlanMonthlyOfferingId)
		})

		t1.Run("19. includes tax rate when creating a new stripe subscription", func(t2 *testing.T) {
			sessionCookie, testUser := test.CreateAndLoginUser(t2, testServer)

			litePlanMonthlyOfferingId := "01J9FAJQBCAFBCG5ZV0JE1NDJA"

			queryBuilder := table.TaxRateTable.
				INSERT(
					table.TaxRateTable.CountryCode,
					table.TaxRateTable.PostalCode,
					table.TaxRateTable.TaxPercentage,
					table.TaxRateTable.StripeTaxRateID,
				).
				VALUES(
					"US",
					"99301",
					"8.9",
					data.StripeTaxRateId,
				)

			_ = database.Exec(context.Background(), queryBuilder)

			test.MockCustomerCreationRequest(t2, testUser)

			gock.New("https://api.stripe.com").
				Post("/v1/subscriptions").
				AddMatcher(test.CreateRequestBodyMatcherFunc(func(requestBody map[string]any) {
					require.Equal(t2, data.StripeTaxRateId, requestBody["default_tax_rates[0]"])
				})).
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

			checkoutEndpointResponse, _ := test.SendPostRequest(
				t2,
				testServer,
				"/api/v1/checkout",
				dto.FirstSubscriptionCheckoutRequest{
					FullName:    testUser.DisplayName,
					OfferingId:  litePlanMonthlyOfferingId,
					CountryCode: "US",
					PostalCode:  "99301",
				},
				map[string]string{
					"Cookie":                       sessionCookie,
					turnstile.TurnstileTokenHeader: "turnstile-token",
				},
			)

			require.Equal(t2, http.StatusOK, checkoutEndpointResponse.StatusCode)

			deleteQueryBuilder := table.TaxRateTable.
				DELETE().
				WHERE(table.TaxRateTable.StripeTaxRateID.EQ(postgres.String(data.StripeTaxRateId)))

			require.NoError(t2, database.Exec(context.Background(), deleteQueryBuilder))
		})

		t1.Run("20. returns 400 when checking out a new subscription while an active paid subscription already exists", func(t2 *testing.T) {
			sessionCookie, _, _ := test.StartPaidPlan(t2, testServer, data.LitePlanMonthlyOfferingId)

			checkoutEndpointResponse, checkoutEndpointResponseBody := test.SendPostRequest(
				t2,
				testServer,
				"/api/v1/checkout",
				dto.FirstSubscriptionCheckoutRequest{
					FullName:    "Hello World",
					OfferingId:  data.EssentialPlanYearlyOfferingId,
					CountryCode: "US",
					PostalCode:  "99301",
				},
				map[string]string{
					"Cookie":                       sessionCookie,
					turnstile.TurnstileTokenHeader: "turnstile-token",
				},
			)

			require.Equal(t2, http.StatusBadRequest, checkoutEndpointResponse.StatusCode)
			require.Equal(
				t2,
				"cannot check out new subscription because an active paid subscription already exists",
				checkoutEndpointResponseBody["message"],
			)
			require.Subset(
				t2,
				checkoutEndpointResponseBody["payload"],
				map[string]any{
					"code": "ValidationException",
				},
			)
		})

		t1.Run("21. can check out new subscription when a free subscription is active", func(t2 *testing.T) {
			sessionCookie := test.StartFreePlan(t2, testServer, data.LitePlanMonthlyOfferingId)
			testUser := test.RestoreAuthenticatedUserSession(t2, testServer, sessionCookie)

			paymentMethod := test.GenerateDefaultPaymentMethod()

			test.MockSavingDefaultPaymentMethodOnCustomerRequest(t2, testUser, paymentMethod)

			test.StartPaidPlanForExistingUser(
				t2,
				testServer,
				testUser,
				data.EssentialPlanMonthlyOfferingId,
				sessionCookie,
				false,
				paymentMethod,
			)
		})

		t1.Run("22. can check out paid plan while having a canceled subscription", func(t2 *testing.T) {
			sessionCookie, testUser, usedPaymentMethod := test.StartPaidPlan(
				t2,
				testServer,
				data.EssentialPlanMonthlyOfferingId,
			)

			_ = test.CancelPaidPlan(t2, testServer, sessionCookie)

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

			test.TriggerInvoicePaymentSucceededEventForSubscriptionCreateReason(
				t2,
				testServer,
				testUser,
				data.LitePlanMonthlyOfferingId,
				test.GetValueFromMap(responseBody, "payload", "taskId").(string),
				usedPaymentMethod,
			)

			testUserAfterPurchase := test.RestoreAuthenticatedUserSession(t2, testServer, sessionCookie)

			require.NotNil(t2, testUserAfterPurchase.Subscription)
			require.Equal(t2, data.LitePlanMonthlyOfferingId, testUserAfterPurchase.Subscription.Plan.OfferingId)
			require.Nil(t2, testUserAfterPurchase.Subscription.CanceledAt)
			require.Nil(t2, testUserAfterPurchase.Subscription.CancellationReason)
		})

		t1.Run("23. can check out a new subscription while an active free subscription already exists", func(t2 *testing.T) {
			sessionCookie := test.StartFreePlan(t2, testServer, data.FreePlanMonthlyOfferingId)

			test.MockSubscriptionCreationRequest(
				t2,
				test.RestoreAuthenticatedUserSession(t2, testServer, sessionCookie),
				data.LitePlanMonthlyOfferingId,
				true,
			)

			checkoutEndpointResponse, _ := test.SendPostRequest(
				t2,
				testServer,
				"/api/v1/checkout",
				dto.FirstSubscriptionCheckoutRequest{
					FullName:    "Hello World",
					OfferingId:  data.LitePlanMonthlyOfferingId,
					CountryCode: "US",
					PostalCode:  "99301",
				},
				map[string]string{
					"Cookie":                       sessionCookie,
					turnstile.TurnstileTokenHeader: "turnstile-token",
				},
			)

			require.Equal(t2, http.StatusOK, checkoutEndpointResponse.StatusCode)
		})

		t1.Run("24. sends new subscription purchase confirmation email", func(t2 *testing.T) {
			sessionCookie, testUser := test.CreateAndLoginUser(t2, testServer)

			offeringId := data.LitePlanMonthlyOfferingId

			test.MockCustomerCreationRequest(t2, testUser)
			test.MockSubscriptionCreationRequest(t2, testUser, offeringId, false)

			checkoutEndpointResponse, checkoutEndpointResponseBody := test.SendPostRequest(
				t2,
				testServer,
				"/api/v1/checkout",
				dto.FirstSubscriptionCheckoutRequest{
					FullName:    testUser.DisplayName,
					OfferingId:  offeringId,
					CountryCode: "US",
					PostalCode:  "99301",
				},
				map[string]string{
					"Cookie":                       sessionCookie,
					turnstile.TurnstileTokenHeader: "turnstile-token",
				},
			)

			require.Equal(t2, http.StatusOK, checkoutEndpointResponse.StatusCode)

			checkoutResponsePayload := checkoutEndpointResponseBody["payload"].(map[string]any)

			chargeId := "ch_" + gofakeit.UUID()

			gock.New("https://api.resend.com").
				Post("/emails").
				AddMatcher(test.CreateRequestBodyMatcherFunc(func(requestBody map[string]any) {
					require.Equal(t2, []any{testUser.Email}, requestBody["to"])
					require.Equal(t2, "Subscription purchase confirmation", requestBody["subject"])
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
					require.Contains(t2, htmlBody, "This email confirms your subscription purchase:")

					require.Contains(t2, htmlBody, "Transaction ID:")
					require.NotContains(t2, htmlBody, "{{.TransactionId}}")

					require.Contains(t2, htmlBody, "Subscription:")
					require.NotContains(t2, htmlBody, "{{.Subscription}}")
					require.Contains(t2, htmlBody, plan.PlanNameTable[offeringId])

					require.Contains(t2, htmlBody, "Purchase date:")
					require.NotContains(t2, htmlBody, "{{.PurchaseDate}}")
					require.Contains(t2, htmlBody, time.Now().Format(time.DateOnly))

					require.Contains(t2, htmlBody, "Amount paid:")
					require.NotContains(t2, htmlBody, "{{.AmountPaid}}")
					require.Contains(t2, htmlBody, currency.Prettify(data.PriceTable[offeringId]))

					require.Contains(t2, htmlBody, "To manage your subscription, please visit")
					require.Contains(t2, htmlBody, `<a href="`+environment.Config.AccessControlAllowOrigin+`/my/subscription">Subscription</a>`)
					require.Contains(t2, htmlBody, "page in your dashboard.")

					require.Regexp(
						t2,
						regexp.MustCompile(`Thank you for subscribing to Cloudy Clip! We are excited\s+to have you on board,`),
						htmlBody,
					)
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

			paymentMethod := test.GetOrCreateDefaultPaymentMethod(testUser)
			test.MockRequestForGettingPaymentMethodByChargeId(t2, chargeId, paymentMethod)
			test.MockSavingDefaultPaymentMethodOnCustomerRequest(t2, testUser, paymentMethod)

			invoiceId := "in_" + gofakeit.UUID()
			taskId := checkoutResponsePayload["taskId"].(string)

			test.CallStripeWebhook(
				t2,
				testServer,
				fmt.Sprintf(`
				{
					"api_version": "2024-06-20",
					"data": {
						"object": {
							"id": "%v",
							"object": "invoice",
							"billing_reason": "subscription_create",
							"charge": "%v",
							"customer": {
								"id": "%v"
							},
							"currency": "usd",
							"customer_address": {
								"country": "US",
								"postal_code": "99301"
							},
							"created": %v,
							"customer_email": "%v",
							"customer_name": "%v",
							"lines": {
								"object": "list",
								"data": [
									{
										"id": "il_123456789",
										"object": "line_item",
										"invoice": "%v",
										"period": {
											"end": %v
										}
									}
								]
							},
							"subtotal": %d,
							"tax": 0,
							"amount_paid": %d,
							"amount_due": %d,
							"subscription": "%v",
							"subscription_details": {
								"metadata": {
									"userEmail": "%s",
									"userId": "%s",
									"offeringId": "%s",
									"taskId": "%s"
								}
							}
						}
					},
					"id": "evt_1QAnOYIWw5KeSeJEo2nTkbxs",
					"object": "event",
					"type": "invoice.payment_succeeded"
				}`,
					invoiceId,
					chargeId,
					testUser.StripeCustomerId,
					time.Now().Unix(),
					testUser.Email,
					testUser.DisplayName,
					invoiceId,
					time.Now().Add(time.Duration(30*60)*time.Hour).Unix(),
					data.PriceTable[offeringId],
					data.PriceTable[offeringId],
					data.PriceTable[offeringId],
					testUser.StripeSubscriptionId,
					testUser.Email,
					testUser.UserId,
					offeringId,
					taskId,
				),
			)

			testUserAfterPurchase := test.RestoreAuthenticatedUserSession(t2, testServer, sessionCookie)

			require.NotNil(t2, testUserAfterPurchase.Subscription)
			require.Nil(t2, testUserAfterPurchase.Subscription.CanceledAt)
			require.Nil(t2, testUserAfterPurchase.Subscription.CancellationReason)
			require.Equal(t2, offeringId, testUserAfterPurchase.Subscription.Plan.OfferingId)
		})
	})
}
