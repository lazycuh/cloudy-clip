package billing

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/brianvoe/gofakeit/v7"
	"github.com/h2non/gock"
	"github.com/stretchr/testify/require"
	"github.com/cloudy-clip/api/internal/billing/dto"
	"github.com/cloudy-clip/api/internal/common/database"
	_jetModel "github.com/cloudy-clip/api/internal/common/database/.jet/model"
	"github.com/cloudy-clip/api/internal/common/database/.jet/table"
	"github.com/cloudy-clip/api/internal/common/environment"
	data "github.com/cloudy-clip/api/test"
	"github.com/cloudy-clip/api/test/debug"
	test "github.com/cloudy-clip/api/test/utils"
)

func TestPaymentMethodApi(t1 *testing.T) {
	test.Integration(t1, func(testServer *httptest.Server) {

		addPaymentMethods := func(paymentMethods []_jetModel.PaymentMethod) {
			for _, paymentMethod := range paymentMethods {
				queryBuilder := table.PaymentMethodTable.
					INSERT(table.PaymentMethodTable.AllColumns).
					MODEL(paymentMethod)

				err := database.Exec(context.Background(), queryBuilder)
				if err != nil {
					panic(err)
				}
			}
		}

		t1.Run("1. returns all non-deleted payment methods", func(t2 *testing.T) {
			sessionCookie, testUser, usedPaymentMethod := test.StartPaidPlan(t1, testServer, data.LitePlanMonthlyOfferingId)

			paymentMethodModels := []_jetModel.PaymentMethod{
				{
					PaymentMethodID: gofakeit.UUID(),
					ExpMonth:        "1",
					ExpYear:         "2024",
					Last4:           "1234",
					Brand:           "visa",
					IsDefault:       false,
					IsDeleted:       false,
					UserID:          testUser.UserId,
				},
				{
					PaymentMethodID: gofakeit.UUID(),
					ExpMonth:        "2",
					ExpYear:         "2025",
					Last4:           "1234",
					Brand:           "mastercard",
					IsDefault:       false,
					IsDeleted:       false,
					UserID:          testUser.UserId,
				},
				{
					PaymentMethodID: gofakeit.UUID(),
					ExpMonth:        "3",
					ExpYear:         "2026",
					Last4:           "3456",
					Brand:           "discover",
					IsDefault:       false,
					IsDeleted:       true,
					UserID:          testUser.UserId,
				},
			}

			addPaymentMethods(paymentMethodModels)

			response, responseBody := test.SendGetRequest(
				t2,
				testServer,
				"/api/v1/billing/my/payment-methods",
				map[string]string{
					"Cookie": sessionCookie,
				},
			)

			require.Equal(t2, http.StatusOK, response.StatusCode)
			require.Len(t2, responseBody["payload"], 3)

			buf, err := json.Marshal(map[string]any{
				"expectedPayload": []any{
					usedPaymentMethod,
					dto.NewPaymentMethod(paymentMethodModels[0]),
					dto.NewPaymentMethod(paymentMethodModels[1]),
				},
			})
			if err != nil {
				panic(err)
			}

			require.ElementsMatch(
				t2,
				debug.JsonParse(string(buf))["expectedPayload"],
				responseBody["payload"],
			)
		})

		t1.Run("2. marks payment method as deleted", func(t2 *testing.T) {
			sessionCookie, testUser, usedPaymentMethod := test.StartPaidPlan(t1, testServer, data.LitePlanMonthlyOfferingId)

			paymentMethodModels := []_jetModel.PaymentMethod{
				{
					PaymentMethodID: gofakeit.UUID(),
					ExpMonth:        "1",
					ExpYear:         "2024",
					Last4:           "1234",
					Brand:           "visa",
					IsDefault:       false,
					IsDeleted:       false,
					UserID:          testUser.UserId,
				},
				{
					PaymentMethodID: gofakeit.UUID(),
					ExpMonth:        "2",
					ExpYear:         "2025",
					Last4:           "1234",
					Brand:           "mastercard",
					IsDefault:       false,
					IsDeleted:       false,
					UserID:          testUser.UserId,
				},
			}

			addPaymentMethods(paymentMethodModels)

			gock.New("https://api.stripe.com").
				Post("/v1/payment_methods/" + paymentMethodModels[0].PaymentMethodID + "/detach").
				Reply(http.StatusOK).
				JSON(map[string]any{})

			_, _ = test.SendDeleteRequest(
				t2,
				testServer,
				"/api/v1/billing/my/payment-methods/"+paymentMethodModels[0].PaymentMethodID,
				map[string]string{
					"Cookie": sessionCookie,
				},
			)

			response, responseBody := test.SendGetRequest(
				t2,
				testServer,
				"/api/v1/billing/my/payment-methods",
				map[string]string{
					"Cookie": sessionCookie,
				},
			)

			require.Equal(t2, http.StatusOK, response.StatusCode)
			require.Len(t2, responseBody["payload"], 2)

			buf, err := json.Marshal(map[string]any{
				"expectedPayload": []any{
					usedPaymentMethod,
					dto.NewPaymentMethod(paymentMethodModels[1]),
				},
			})
			if err != nil {
				panic(err)
			}

			require.ElementsMatch(
				t2,
				debug.JsonParse(string(buf))["expectedPayload"],
				responseBody["payload"],
			)
		})

		t1.Run("3. prohibits deleting default payment method", func(t2 *testing.T) {
			sessionCookie, _, usedPaymentMethod := test.StartPaidPlan(t1, testServer, data.LitePlanMonthlyOfferingId)

			response, responseBody := test.SendDeleteRequest(
				t2,
				testServer,
				"/api/v1/billing/my/payment-methods/"+usedPaymentMethod.PaymentMethodId,
				map[string]string{
					"Cookie": sessionCookie,
				},
			)

			require.Equal(t2, http.StatusBadRequest, response.StatusCode)
			require.Equal(t2, "default payment method cannot be deleted", responseBody["message"])
		})

		t1.Run("4. changes default payment method", func(t2 *testing.T) {
			sessionCookie, testUser, usedPaymentMethod := test.StartPaidPlan(t1, testServer, data.LitePlanMonthlyOfferingId)

			paymentMethodModels := []_jetModel.PaymentMethod{
				{
					PaymentMethodID: gofakeit.UUID(),
					ExpMonth:        "1",
					ExpYear:         "2024",
					Last4:           "1234",
					Brand:           "visa",
					IsDefault:       false,
					IsDeleted:       false,
					UserID:          testUser.UserId,
				},
				{
					PaymentMethodID: gofakeit.UUID(),
					ExpMonth:        "2",
					ExpYear:         "2025",
					Last4:           "1234",
					Brand:           "mastercard",
					IsDefault:       false,
					IsDeleted:       false,
					UserID:          testUser.UserId,
				},
			}

			addPaymentMethods(paymentMethodModels)

			responseBeforeUpdate, responseBodyBeforeUpdate := test.SendGetRequest(
				t2,
				testServer,
				"/api/v1/billing/my/payment-methods",
				map[string]string{
					"Cookie": sessionCookie,
				},
			)

			require.Equal(t2, http.StatusOK, responseBeforeUpdate.StatusCode)
			require.Len(t2, responseBodyBeforeUpdate["payload"], 3)

			expectedPaymentMethodListJsonStringBefore := debug.JsonStringify([]any{
				usedPaymentMethod,
				dto.NewPaymentMethod(paymentMethodModels[0]),
				dto.NewPaymentMethod(paymentMethodModels[1]),
			})

			require.ElementsMatch(
				t2,
				debug.JsonParseArray(expectedPaymentMethodListJsonStringBefore),
				responseBodyBeforeUpdate["payload"],
			)

			gock.New("https://api.stripe.com").
				Post("/v1/customers/" + testUser.StripeCustomerId).
				AddMatcher(test.CreateRequestBodyMatcher(
					t2,
					`{
						"invoice_settings[default_payment_method]": "%v"
					}`,
					paymentMethodModels[0].PaymentMethodID),
				).
				Reply(http.StatusOK).
				JSON(map[string]any{})

			gock.New("https://api.stripe.com").
				Post("/v1/subscriptions/" + testUser.StripeSubscriptionId).
				AddMatcher(test.CreateRequestBodyMatcher(
					t2,
					`{
						"default_payment_method": "%v"
					}`,
					paymentMethodModels[0].PaymentMethodID),
				).
				Reply(http.StatusOK).
				JSON(map[string]any{})

			_, _ = test.SendPatchRequest(
				t2,
				testServer,
				"/api/v1/billing/my/payment-methods/"+paymentMethodModels[0].PaymentMethodID+"/default",
				nil,
				map[string]string{
					"Cookie": sessionCookie,
				},
			)

			responseAfterUpdate, responseBodyAfterUpdate := test.SendGetRequest(
				t2,
				testServer,
				"/api/v1/billing/my/payment-methods",
				map[string]string{
					"Cookie": sessionCookie,
				},
			)

			require.Equal(t2, http.StatusOK, responseAfterUpdate.StatusCode)
			require.Len(t2, responseBodyAfterUpdate["payload"], 3)

			paymentMethodModels[0].IsDefault = true
			usedPaymentMethod.IsDefault = false

			expectedPaymentMethodListJsonStringAfter := debug.JsonStringify([]any{
				usedPaymentMethod,
				dto.NewPaymentMethod(paymentMethodModels[0]),
				dto.NewPaymentMethod(paymentMethodModels[1]),
			})

			require.ElementsMatch(
				t2,
				debug.JsonParseArray(expectedPaymentMethodListJsonStringAfter),
				responseBodyAfterUpdate["payload"],
			)
		})

		t1.Run("5. GET /api/v1/billing/my/management/page/payment-method returns URL to page to add payment method", func(t2 *testing.T) {
			sessionCookie, testUser, _ := test.StartPaidPlan(t1, testServer, data.LitePlanMonthlyOfferingId)

			gock.New("https://api.stripe.com").
				Post("/v1/checkout/sessions").
				AddMatcher(test.CreateRequestBodyMatcher(
					t2,
					`{
						"payment_method_types[0]": "card",
						"customer": "%v",
						"metadata[userId]": "%v",
						"setup_intent_data[metadata][customer_id]": "%v",
						"mode": "setup",
						"success_url": "%v",
						"cancel_url": "%v"
					}`,
					testUser.StripeCustomerId,
					testUser.UserId,
					testUser.StripeCustomerId,
					environment.Config.AccessControlAllowOrigin+"/checkout?session_id={CHECKOUT_SESSION_ID}",
					environment.Config.AccessControlAllowOrigin+"/checkout",
				)).
				Reply(http.StatusOK).
				JSON(map[string]any{
					"url": "https://helloworld.com",
				})

			response, responseBody := test.SendGetRequest(
				t2,
				testServer,
				"/api/v1/billing/my/management/page/payment-method?returnUrlPath=checkout",
				map[string]string{
					"Cookie": sessionCookie,
				},
			)

			require.Equal(t2, http.StatusOK, response.StatusCode)
			require.Equal(t2, "https://helloworld.com", responseBody["payload"])
		})

		t1.Run("6. GET /api/v1/billing/my/management/page/payment-method returns 404 when no billing info exists for user", func(t2 *testing.T) {
			sessionCookie, _ := test.CreateAndLoginUser(t1, testServer)

			response, responseBody := test.SendGetRequest(
				t2,
				testServer,
				"/api/v1/billing/my/management/page/payment-method",
				map[string]string{
					"Cookie": sessionCookie,
				},
			)

			require.Equal(t2, http.StatusNotFound, response.StatusCode)
			require.Equal(t2, "no billing info exists", responseBody["message"])
		})

		t1.Run("7. returns payment methods for expected user", func(t2 *testing.T) {
			sessionCookie1, testUser1, usedPaymentMethod1 := test.StartPaidPlan(
				t2,
				testServer,
				data.LitePlanMonthlyOfferingId,
			)

			paymentMethodModels := []_jetModel.PaymentMethod{
				{
					PaymentMethodID: gofakeit.UUID(),
					ExpMonth:        "1",
					ExpYear:         "2024",
					Last4:           "1234",
					Brand:           "visa",
					IsDefault:       false,
					IsDeleted:       false,
					UserID:          testUser1.UserId,
				},
				{
					PaymentMethodID: gofakeit.UUID(),
					ExpMonth:        "2",
					ExpYear:         "2025",
					Last4:           "1234",
					Brand:           "mastercard",
					IsDefault:       false,
					IsDeleted:       false,
					UserID:          testUser1.UserId,
				},
			}

			addPaymentMethods(paymentMethodModels)

			sessionCookie2, _, usedPaymentMethod2 := test.StartPaidPlan(t2, testServer, data.LitePlanMonthlyOfferingId)

			assertCorrectPaymentMethods := func(paymentMethods []dto.PaymentMethod, sessionCookie string, expectedLenth int) {
				response, responseBody := test.SendGetRequest(
					t2,
					testServer,
					"/api/v1/billing/my/payment-methods",
					map[string]string{
						"Cookie": sessionCookie,
					},
				)

				require.Equal(t2, http.StatusOK, response.StatusCode)
				require.Len(t2, responseBody["payload"], expectedLenth)

				buf, err := json.Marshal(map[string]any{
					"expectedPayload": paymentMethods,
				})
				if err != nil {
					panic(err)
				}

				require.ElementsMatch(
					t2,
					debug.JsonParse(string(buf))["expectedPayload"],
					responseBody["payload"],
				)
			}

			assertCorrectPaymentMethods(
				[]dto.PaymentMethod{
					*usedPaymentMethod1,
					dto.NewPaymentMethod(paymentMethodModels[0]),
					dto.NewPaymentMethod(paymentMethodModels[1]),
				},
				sessionCookie1,
				3,
			)

			assertCorrectPaymentMethods(
				[]dto.PaymentMethod{
					*usedPaymentMethod2,
				},
				sessionCookie2,
				1,
			)
		})

		t1.Run("8. GET /api/v1/billing/my/management/page/payment-method returns URL to page to add payment method and redirect back to /my/payment-methods when no return url path is provided", func(t2 *testing.T) {
			sessionCookie, testUser, _ := test.StartPaidPlan(t2, testServer, data.LitePlanMonthlyOfferingId)

			gock.New("https://api.stripe.com").
				Post("/v1/checkout/sessions").
				AddMatcher(test.CreateRequestBodyMatcher(
					t2,
					`{
						"payment_method_types[0]": "card",
						"customer": "%v",
						"metadata[userId]": "%v",
						"setup_intent_data[metadata][customer_id]": "%v",
						"mode": "setup",
						"success_url": "%v",
						"cancel_url": "%v"
					}`,
					testUser.StripeCustomerId,
					testUser.UserId,
					testUser.StripeCustomerId,
					environment.Config.AccessControlAllowOrigin+"/my/payment-methods?session_id={CHECKOUT_SESSION_ID}",
					environment.Config.AccessControlAllowOrigin+"/my/payment-methods",
				)).
				Reply(http.StatusOK).
				JSON(map[string]any{
					"url": "https://helloworld.com",
				})

			response, responseBody := test.SendGetRequest(
				t2,
				testServer,
				"/api/v1/billing/my/management/page/payment-method",
				map[string]string{
					"Cookie": sessionCookie,
				},
			)

			require.Equal(t2, http.StatusOK, response.StatusCode)
			require.Equal(t2, "https://helloworld.com", responseBody["payload"])
		})
	})

}
