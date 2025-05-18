package subscription

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"regexp"
	"strconv"
	"testing"
	"time"

	"github.com/brianvoe/gofakeit/v7"
	"github.com/h2non/gock"
	"github.com/stretchr/testify/require"
	"github.com/cloudy-clip/api/internal/common/currency"
	"github.com/cloudy-clip/api/internal/common/database"
	jetModel "github.com/cloudy-clip/api/internal/common/database/.jet/model"
	"github.com/cloudy-clip/api/internal/common/database/.jet/table"
	"github.com/cloudy-clip/api/internal/common/environment"
	"github.com/cloudy-clip/api/internal/common/exception"
	"github.com/cloudy-clip/api/internal/common/plan"
	data "github.com/cloudy-clip/api/test"
	"github.com/cloudy-clip/api/test/debug"
	test "github.com/cloudy-clip/api/test/utils"
)

func TestReactivation(t1 *testing.T) {
	test.Integration(t1, func(testServer *httptest.Server) {
		offeringId := data.LitePlanMonthlyOfferingId
		amountDue := data.PriceTable[offeringId]

		previewReactivationCost := func(
			t *testing.T,
			testUser *test.TestUser,
			sessionCookie string,
		) {
			gock.New("https://api.stripe.com").
				Post("/v1/invoices/create_preview").
				AddMatcher(test.CreateRequestBodyMatcher(
					t,
					`
						{
							"customer": "%v",
							"subscription_details[items][0][price]": "%v"
						}
					`,
					testUser.StripeCustomerId,
					plan.GetPriceIdByOfferingId(offeringId),
				)).
				Reply(http.StatusOK).
				JSON(debug.JsonParse(`
					{
						"currency": "usd",
						"lines": {
							"data": [
								{
									"total": %v,
									"currency": "usd"
								}
							]
						},
						"customer_address": {
							"country": "US",
							"postal_code": "99301"
						}
					}
				`, amountDue))

			response, _ := test.SendGetRequest(
				t,
				testServer,
				"/api/v1/checkout/preview?offeringId="+offeringId,
				map[string]string{
					"Cookie": sessionCookie,
				},
			)

			require.Equal(t, http.StatusOK, response.StatusCode)
		}

		reactivate := func(t *testing.T, offeringId string) {
			sessionCookie, testUser, usedPaymentMethod := test.StartPaidPlan(t, testServer, offeringId)

			_ = test.CancelPaidPlan(t, testServer, sessionCookie)

			payments, _ := test.GetPayments(t, testServer, sessionCookie, 0, 100)
			require.Len(t, payments, 2)

			paymentMethodId := gofakeit.UUID()

			previewReactivationCost(t, testUser, sessionCookie)

			gock.New("https://api.stripe.com").
				Post("/v1/subscriptions").
				AddMatcher(test.CreateRequestBodyMatcherFunc(func(requestBody map[string]any) {
					require.Len(t, requestBody, 9)

					require.Subset(
						t,
						requestBody,
						debug.JsonParse(`
							{
								"customer":"%v",
								"default_payment_method": "%v",
								"items[0][price]": "%v",
								"metadata[offeringId]": "%v",
								"metadata[userEmail]": "%v",
								"metadata[userId]": "%v",
								"metadata[reactivation]": "true",
								"payment_behavior": "error_if_incomplete"
							}`,
							testUser.StripeCustomerId,
							paymentMethodId,
							plan.GetPriceIdByOfferingId(offeringId),
							offeringId,
							testUser.Email,
							testUser.UserId,
						),
					)

					require.NotEmpty(t, requestBody, "metdata[taskId]")
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
					}`,
				))

			card := gofakeit.CreditCard()
			newPaymentMethodModel := jetModel.PaymentMethod{
				PaymentMethodID: paymentMethodId,
				ExpMonth:        "12",
				ExpYear:         strconv.FormatInt(int64(time.Now().Year()), 10)[0:2] + card.Exp[3:5],
				Last4:           card.Number[len(card.Number)-4 : len(card.Number)],
				Brand:           "visa",
				IsDefault:       false,
				IsDeleted:       false,
				UserID:          testUser.UserId,
			}

			queryBuilder := table.PaymentMethodTable.
				INSERT(table.PaymentMethodTable.AllColumns).
				MODEL(newPaymentMethodModel)

			err := database.Exec(context.Background(), queryBuilder)
			if err != nil {
				panic(err)
			}

			reactivateApiResponse, reactivateApiResponseBody := test.SendPostRequest(
				t,
				testServer,
				"/api/v1/subscriptions/my/reactivate",
				map[string]any{
					"paymentMethodId": paymentMethodId,
				},
				map[string]string{
					"Cookie": sessionCookie,
				},
			)

			require.Equal(t, http.StatusOK, reactivateApiResponse.StatusCode)

			chargeId := "ch_" + gofakeit.UUID()

			gock.New("https://api.stripe.com").
				Get("/v1/charges/" + chargeId).
				Reply(http.StatusOK).
				JSON(debug.JsonParse(`
					{
						"payment_method": "%v",
						"created": %v,
						"payment_method_details": {
							"card": {
								"exp_month": %v,
								"exp_year":  %v,
								"last4":     "%v",
								"brand":     "%v"
							}
						}
					}`,
					usedPaymentMethod.PaymentMethodId,
					time.Now().Unix(),
					usedPaymentMethod.ExpMonth,
					usedPaymentMethod.ExpYear,
					usedPaymentMethod.Last4,
					usedPaymentMethod.Brand,
				))

			taskId := reactivateApiResponseBody["payload"].(string)
			invoiceId := "in_" + gofakeit.UUID()

			gock.New("https://api.resend.com").
				Post("/emails").
				AddMatcher(test.CreateRequestBodyMatcherFunc(func(requestBody map[string]any) {
					require.Equal(t, []any{testUser.Email}, requestBody["to"])
					require.Equal(t, "Subscription reactivated", requestBody["subject"])
					require.Equal(t, "Cloudy Clip <no-reply@cloudyclip.com>", requestBody["from"])
					require.Empty(t, requestBody["text"])

					htmlBody := requestBody["html"]
					require.NotContains(t, "{{.HostName}}", htmlBody)
					require.Contains(
						t,
						htmlBody,
						environment.Config.AccessControlAllowOrigin+"/images/cloudy-clip-bg-transparent.png",
					)
					require.Contains(t, htmlBody, "Hi "+testUser.DisplayName+",")

					require.Regexp(
						t,
						regexp.MustCompile(`.*This email confirms that your subscription has been\s+reactivated:`),
						htmlBody,
					)

					require.Contains(t, htmlBody, "Transaction ID:")
					require.NotContains(t, htmlBody, "{{.TransactionId}}")

					require.Contains(t, htmlBody, "Subscription:")
					require.NotContains(t, htmlBody, "{{.Subscription}}")
					require.Contains(t, htmlBody, plan.PlanNameTable[offeringId])

					require.Contains(t, htmlBody, "Purchase date:")
					require.NotContains(t, htmlBody, "{{.PurchaseDate}}")
					require.Contains(t, htmlBody, time.Now().Format(time.DateOnly))

					require.Contains(t, htmlBody, "Amount paid:")
					require.NotContains(t, htmlBody, "{{.AmountPaid}}")
					require.Contains(t, htmlBody, currency.Prettify(data.PriceTable[offeringId]))

					require.Contains(t, htmlBody, "To manage your subscription, please visit")
					require.Contains(t, htmlBody, `<a href="`+environment.Config.AccessControlAllowOrigin+`/my/subscription">Subscription</a>`)
					require.Contains(t, htmlBody, "page in your dashboard.")

					require.Regexp(
						t,
						regexp.MustCompile(`Thank you for subscribing to Cloudy Clip! We are excited\s+to have you back,`),
						htmlBody,
					)

					require.Contains(t, htmlBody, "The Cloudy Clip Team")
					require.Contains(t, htmlBody, "Terms of Service")
					require.Contains(
						t,
						htmlBody,
						environment.Config.AccessControlAllowOrigin+"/policies/terms-of-service",
					)
					require.Contains(t, htmlBody, "Privacy Policy")
					require.Contains(t, htmlBody, "|")
					require.Contains(
						t,
						htmlBody,
						environment.Config.AccessControlAllowOrigin+"/policies/privacy-policy",
					)
				})).
				Reply(http.StatusOK).
				JSON(map[string]any{})

			test.CallStripeWebhook(
				t,
				testServer,
				fmt.Sprintf(`
					{
						"api_version": "2024-06-20",
						"data": {
							"object": {
								"id": "%v",
								"object": "invoice",
								"charge": "%v",
								"created": %v,
								"billing_reason": "subscription_create",
								"customer": {
									"id": "%v"
								},
								"currency": "usd",
								"customer_address": {
									"country": "US",
									"postal_code": "99301"
								},
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
								"amount_paid": %v,
								"amount_due": %v,
								"subscription": "%v",
								"subscription_details": {
									"metadata": {
										"userEmail": "%s",
										"userId": "%s",
										"offeringId": "%s",
										"taskId": "%s",
										"reactivation": "true"
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
					time.Now().Unix(),
					testUser.StripeCustomerId,
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

			testUserAfterWebhook := test.RestoreAuthenticatedUserSession(t, testServer, sessionCookie)
			require.Nil(t, testUserAfterWebhook.Subscription.CanceledAt)
			require.Nil(t, testUserAfterWebhook.Subscription.CancellationReason)

			getTaskApiResponse, getTaskApiResponseBody := test.SendGetRequest(
				t,
				testServer,
				"/api/v1/tasks/"+taskId,
				map[string]string{
					"Cookie": sessionCookie,
				},
			)
			require.Equal(t, http.StatusOK, getTaskApiResponse.StatusCode)
			require.Equal(t, "SUCCESS", test.GetValueFromMap(getTaskApiResponseBody, "payload", "status"))

			paymentsAfterReactivation, _ := test.GetPayments(t, testServer, sessionCookie, 0, 100)

			require.Len(t, paymentsAfterReactivation, 3)
			require.Equal(
				t,
				"SUBSCRIPTION_REACTIVATION",
				test.GetValueFromMap(paymentsAfterReactivation[0], "paymentReason"),
			)
		}

		t1.Run("1. can reactivate paid plan and charge customer right away", func(t2 *testing.T) {
			reactivate(t2, data.LitePlanMonthlyOfferingId)
		})

		t1.Run("2. can reactivate free plan", func(t2 *testing.T) {
			sessionCookie := test.StartFreePlan(t2, testServer, data.FreePlanMonthlyOfferingId)

			_ = test.CancelFreePlan(t2, testServer, sessionCookie)

			response, _ := test.SendPostRequest(
				t2,
				testServer,
				"/api/v1/subscriptions/my/reactivate",
				map[string]any{},
				map[string]string{
					"Cookie": sessionCookie,
				},
			)
			require.Equal(t2, http.StatusOK, response.StatusCode)

			testUserAfterReactivation := test.RestoreAuthenticatedUserSession(t2, testServer, sessionCookie)
			require.NotNil(t2, testUserAfterReactivation.Subscription)
			require.Nil(t2, testUserAfterReactivation.Subscription.CanceledAt)
			require.Equal(t2, "Free", testUserAfterReactivation.Subscription.Plan.DisplayName)
		})

		t1.Run("3. empty payment method ID in request body does not prevent canceled free subscription from being reactivated", func(t2 *testing.T) {
			sessionCookie := test.StartFreePlan(t2, testServer, data.FreePlanMonthlyOfferingId)

			_ = test.CancelFreePlan(t2, testServer, sessionCookie)

			response, _ := test.SendPostRequest(
				t2,
				testServer,
				"/api/v1/subscriptions/my/reactivate",
				map[string]any{
					"paymentMethodId": "",
				},
				map[string]string{
					"Cookie": sessionCookie,
				},
			)
			require.Equal(t2, http.StatusOK, response.StatusCode)

			testUserAfterReactivation := test.RestoreAuthenticatedUserSession(t2, testServer, sessionCookie)
			require.NotNil(t2, testUserAfterReactivation.Subscription)
			require.Nil(t2, testUserAfterReactivation.Subscription.CanceledAt)
			require.Equal(t2, "Free", testUserAfterReactivation.Subscription.Plan.DisplayName)
		})

		t1.Run("4. can get subscription reactivation cost preview", func(t2 *testing.T) {
			sessionCookie, _, usedPaymentMethod := test.StartPaidPlan(t2, testServer, data.LitePlanMonthlyOfferingId)

			_ = test.CancelPaidPlan(t2, testServer, sessionCookie)

			gock.New("https://api.stripe.com").
				Post("/v1/invoices/create_preview").
				Reply(http.StatusOK).
				JSON(debug.JsonParse(`
					{
						"currency": "usd",
						"lines": {
							"data": [
								{
									"amount": -101
								}
							]
						},
						"customer_address": {
							"country": "US",
							"postal_code": "99301"
						}
					}
				`))

			response, responseBody := test.SendGetRequest(
				t2,
				testServer,
				"/api/v1/checkout/preview?offeringId="+data.LitePlanMonthlyOfferingId,
				map[string]string{
					"Cookie": sessionCookie,
				},
			)

			require.Equal(t2, http.StatusOK, response.StatusCode)
			require.Equal(
				t2,
				debug.JsonParse(`
					{
						"discount": "0",
						"amountDue": "0",
						"currencyCode": "usd",
						"refund": "101",
						"subtotal": "0",
						"tax": "0",
						"taxPercentage": "0.00",
						"storedPaymentMethods":[
							{
								"brand": "%v",
								"expMonth": "%v",
								"expYear": "%v",
								"isDefault": %v,
								"last4": "%v",
								"paymentMethodId": "%v"
							}
						]
					}
				`,
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

		t1.Run("5. return 400 when payment method ID is missing when reactivating paid subscription", func(t2 *testing.T) {
			sessionCookie, testUser, _ := test.StartPaidPlan(t2, testServer, data.LitePlanMonthlyOfferingId)
			_ = test.CancelPaidPlan(t2, testServer, sessionCookie)

			previewReactivationCost(t2, testUser, sessionCookie)

			response, responseBody := test.SendPostRequest(
				t2,
				testServer,
				"/api/v1/subscriptions/my/reactivate",
				map[string]any{},
				map[string]string{
					"Cookie": sessionCookie,
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

		t1.Run("6. return 402 when payment fails", func(t2 *testing.T) {
			sessionCookie, testUser, _ := test.StartPaidPlan(t2, testServer, data.LitePlanMonthlyOfferingId)
			_ = test.CancelPaidPlan(t2, testServer, sessionCookie)

			previewReactivationCost(t2, testUser, sessionCookie)

			paymentMethodId := gofakeit.UUID()

			gock.New("https://api.stripe.com").
				Post("/v1/subscriptions").
				Reply(http.StatusPaymentRequired).
				JSON(`
					{
						"error": {
							"code": "card_declined",
							"decline_code": "generic_decline"
						}
					}`,
				)

			response, responseBody := test.SendPostRequest(
				t2,
				testServer,
				"/api/v1/subscriptions/my/reactivate",
				map[string]any{
					"paymentMethodId": paymentMethodId,
				},
				map[string]string{
					"Cookie": sessionCookie,
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
	})
}
