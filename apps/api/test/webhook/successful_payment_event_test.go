package webhook

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"regexp"
	"testing"
	"time"

	"github.com/brianvoe/gofakeit/v7"
	jet "github.com/go-jet/jet/v2/postgres"
	"github.com/h2non/gock"
	"github.com/stretchr/testify/require"
	"github.com/cloudy-clip/api/internal/common/currency"
	"github.com/cloudy-clip/api/internal/common/database"
	"github.com/cloudy-clip/api/internal/common/database/.jet/table"
	"github.com/cloudy-clip/api/internal/common/environment"
	"github.com/cloudy-clip/api/internal/common/http/middleware/turnstile"
	"github.com/cloudy-clip/api/internal/subscription/dto"
	_subscriptionModel "github.com/cloudy-clip/api/internal/subscription/model"
	"github.com/cloudy-clip/api/internal/task/model"
	data "github.com/cloudy-clip/api/test"
	"github.com/cloudy-clip/api/test/debug"
	test "github.com/cloudy-clip/api/test/utils"
)

func TestSuccessfulPaymentEvent(t1 *testing.T) {
	test.Integration(t1, func(testServer *httptest.Server) {
		t1.Run("1. creates active subscription", func(t2 *testing.T) {
			sessionCookie, testUser := test.CreateAndLoginUser(t2, testServer)

			subscriptionBeforePaying := test.RestoreAuthenticatedUserSession(
				t2,
				testServer,
				sessionCookie,
			).Subscription
			require.Nil(t2, subscriptionBeforePaying)

			paymentMethod := test.GenerateDefaultPaymentMethod()
			test.MockSavingDefaultPaymentMethodOnCustomerRequest(t2, testUser, paymentMethod)

			test.TriggerInvoicePaymentSucceededEventForSubscriptionCreateReason(
				t2,
				testServer,
				testUser,
				data.LitePlanMonthlyOfferingId,
				"",
				paymentMethod,
			)

			subscriptionAfterPaying := test.RestoreAuthenticatedUserSession(
				t2,
				testServer,
				sessionCookie,
			).Subscription
			require.NotNil(t2, subscriptionAfterPaying)
			require.Nil(t2, subscriptionAfterPaying.CanceledAt)
			require.Nil(t2, subscriptionAfterPaying.CancellationReason)
		})

		t1.Run("2. marks task as successful", func(t2 *testing.T) {
			sessionCookie, testUser, _ := test.StartPaidPlan(t2, testServer, data.LitePlanMonthlyOfferingId)

			type taskIdRow struct {
				TaskId string `db:"task_id"`
			}

			taskQueryBuilder := table.TaskTable.
				SELECT(table.TaskTable.TaskID.AS("task_id")).
				WHERE(
					table.TaskTable.UserID.EQ(jet.String(testUser.UserId)).
						AND(table.TaskTable.Status.EQ(jet.Int16(int16(model.TaskStatusSuccess)))),
				)

			taskIds, err := database.SelectMany[taskIdRow](context.Background(), taskQueryBuilder)
			require.NoError(t2, err)
			require.Len(t2, taskIds, 1)

			taskEndpointResponse, taskEndpointResponseBody := test.SendGetRequest(
				t2,
				testServer,
				"/api/v1/tasks/"+taskIds[0].TaskId,
				map[string]string{
					"Cookie": sessionCookie,
				},
			)
			require.Equal(t2, http.StatusOK, taskEndpointResponse.StatusCode)
			require.Equal(t2, "SUCCESS", test.GetValueFromMap(taskEndpointResponseBody, "payload", "status"))
		})

		t1.Run("3. sets subscription's canceled_at timestamp to nil", func(t2 *testing.T) {
			sessionCookie, testUser, usedPaymentMethod := test.StartPaidPlan(t2, testServer, data.LitePlanMonthlyOfferingId)

			_ = test.CancelPaidPlan(t2, testServer, sessionCookie)

			subscriptionAfterCancellation := test.RestoreAuthenticatedUserSession(
				t2,
				testServer,
				sessionCookie,
			).Subscription

			require.NotNil(t2, subscriptionAfterCancellation)
			require.Equal(t2, data.LitePlanMonthlyOfferingId, subscriptionAfterCancellation.Plan.OfferingId)
			require.NotNil(t2, subscriptionAfterCancellation.CanceledAt)
			require.Equal(
				t2,
				_subscriptionModel.SubscriptionCancellationReasonRequestedByUser,
				*subscriptionAfterCancellation.CancellationReason,
			)

			test.TriggerInvoicePaymentSucceededEventForSubscriptionCreateReason(
				t2,
				testServer,
				testUser,
				data.EssentialPlanMonthlyOfferingId,
				"",
				usedPaymentMethod,
			)

			subscriptionAfterRebuy := test.RestoreAuthenticatedUserSession(t2, testServer, sessionCookie).Subscription
			require.NotNil(t2, subscriptionAfterRebuy)
			require.Nil(t2, subscriptionAfterRebuy.CanceledAt)
			require.Nil(t2, subscriptionAfterRebuy.CancellationReason)
			require.Equal(t2, data.EssentialPlanMonthlyOfferingId, subscriptionAfterRebuy.Plan.OfferingId)
		})

		t1.Run("4. adds provided payment method as default if this payment method does not exist", func(t2 *testing.T) {
			sessionCookie, testUser := test.CreateAndLoginUser(t2, testServer)

			getPaymentMethodsResponse, getPaymentMethodsResponseBody := test.SendGetRequest(
				t2,
				testServer,
				"/api/v1/billing/my/payment-methods",
				map[string]string{
					"Cookie": sessionCookie,
				},
			)

			require.Equal(t2, http.StatusOK, getPaymentMethodsResponse.StatusCode)
			require.Empty(t2, getPaymentMethodsResponseBody["payload"])

			paymentMethod := test.GenerateDefaultPaymentMethod()
			test.MockSavingDefaultPaymentMethodOnCustomerRequest(t2, testUser, paymentMethod)

			test.StartPaidPlanForExistingUser(
				t2,
				testServer,
				testUser,
				data.LitePlanMonthlyOfferingId,
				sessionCookie,
				true,
				paymentMethod,
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

		t1.Run("5. does not add provided payment method as default if this payment method is already the default", func(t2 *testing.T) {
			sessionCookie, testUser, usedPaymentMethod := test.StartPaidPlan(
				t2,
				testServer,
				data.EssentialPlanMonthlyOfferingId,
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
			require.Len(t2, getPaymentMethodsResponseBody["payload"], 1)

			test.MockSubscriptionCreationRequest(t2, testUser, data.EssentialPlanMonthlyOfferingId, true)

			secondCheckoutResponse, secondCheckoutResponseBody := test.SendPostRequest(
				t2,
				testServer,
				"/api/v1/checkout",
				dto.FirstSubscriptionCheckoutRequest{
					FullName:    testUser.DisplayName,
					OfferingId:  data.EssentialPlanMonthlyOfferingId,
					CountryCode: "US",
					PostalCode:  "99301",
				},
				map[string]string{
					"Cookie":                       sessionCookie,
					turnstile.TurnstileTokenHeader: "turnstile-token",
				},
			)

			require.Equal(t2, http.StatusOK, secondCheckoutResponse.StatusCode)

			test.TriggerInvoicePaymentSucceededEventForSubscriptionCreateReason(
				t2,
				testServer,
				testUser,
				data.EssentialPlanMonthlyOfferingId,
				test.GetValueFromMap(secondCheckoutResponseBody, "payload", "taskId").(string),
				usedPaymentMethod,
			)

			testUserAfterPurchase := test.RestoreAuthenticatedUserSession(t2, testServer, sessionCookie)

			require.NotNil(t2, testUserAfterPurchase.Subscription)
			require.Nil(t2, testUserAfterPurchase.Subscription.CanceledAt)
			require.Nil(t2, testUserAfterPurchase.Subscription.CancellationReason)
			require.Equal(t2, data.EssentialPlanMonthlyOfferingId, testUserAfterPurchase.Subscription.Plan.OfferingId)

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

		t1.Run("6. sets provided payment method as default if this payment method already exists but it is not the default", func(t2 *testing.T) {
			sessionCookie, testUser, usedPaymentMethod := test.StartPaidPlan(
				t2,
				testServer,
				data.EssentialPlanMonthlyOfferingId,
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
			require.Len(t2, getPaymentMethodsResponseBody["payload"], 1)

			test.MockSubscriptionCreationRequest(t2, testUser, data.EssentialPlanMonthlyOfferingId, true)

			secondCheckoutResponse, secondCheckoutResponseBody := test.SendPostRequest(
				t2,
				testServer,
				"/api/v1/checkout",
				dto.FirstSubscriptionCheckoutRequest{
					FullName:    testUser.DisplayName,
					OfferingId:  data.EssentialPlanMonthlyOfferingId,
					CountryCode: "US",
					PostalCode:  "99301",
				},
				map[string]string{
					"Cookie":                       sessionCookie,
					turnstile.TurnstileTokenHeader: "turnstile-token",
				},
			)

			require.Equal(t2, http.StatusOK, secondCheckoutResponse.StatusCode)

			test.TriggerInvoicePaymentSucceededEventForSubscriptionCreateReason(
				t2,
				testServer,
				testUser,
				data.EssentialPlanMonthlyOfferingId,
				test.GetValueFromMap(secondCheckoutResponseBody, "payload", "taskId").(string),
				usedPaymentMethod,
			)

			testUserAfterPurchase := test.RestoreAuthenticatedUserSession(t2, testServer, sessionCookie)

			require.NotNil(t2, testUserAfterPurchase.Subscription)
			require.Nil(t2, testUserAfterPurchase.Subscription.CanceledAt)
			require.Nil(t2, testUserAfterPurchase.Subscription.CancellationReason)
			require.Equal(t2, data.EssentialPlanMonthlyOfferingId, testUserAfterPurchase.Subscription.Plan.OfferingId)

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

		t1.Run("7. adds provided payment method as default and unsets the existing default payment method", func(t2 *testing.T) {
			sessionCookie, testUser, usedPaymentMethodAfterFirstPurchase := test.StartPaidPlan(
				t2,
				testServer,
				data.EssentialPlanMonthlyOfferingId,
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
			require.Len(t2, getPaymentMethodsResponseBody["payload"], 1)
			require.Equal(
				t2,
				debug.JsonParse(debug.JsonStringify(usedPaymentMethodAfterFirstPurchase)),
				test.GetValueFromMap(getPaymentMethodsResponseBody, "payload").([]any)[0],
			)

			newPaymentMethod := test.GenerateNonDefaultPaymentMethod(testUser, false)
			test.MockSavingDefaultPaymentMethodOnCustomerRequest(t2, testUser, newPaymentMethod)

			test.StartPaidPlanForExistingUser(
				t2,
				testServer,
				testUser,
				data.LitePlanMonthlyOfferingId,
				sessionCookie,
				false,
				newPaymentMethod,
			)

			getPaymentMethodsResponseAfter2ndPurchase, getPaymentMethodsResponseBodyAfter2ndPurchase := test.SendGetRequest(
				t2,
				testServer,
				"/api/v1/billing/my/payment-methods",
				map[string]string{
					"Cookie": sessionCookie,
				},
			)

			usedPaymentMethodAfterFirstPurchase.IsDefault = false
			newPaymentMethod.IsDefault = true

			require.Equal(t2, http.StatusOK, getPaymentMethodsResponseAfter2ndPurchase.StatusCode)
			require.Len(t2, getPaymentMethodsResponseBodyAfter2ndPurchase["payload"], 2)
			require.Contains(
				t2,
				getPaymentMethodsResponseBodyAfter2ndPurchase["payload"],
				debug.JsonParse(debug.JsonStringify(usedPaymentMethodAfterFirstPurchase)),
			)
			require.Contains(
				t2,
				getPaymentMethodsResponseBodyAfter2ndPurchase["payload"],
				debug.JsonParse(debug.JsonStringify(newPaymentMethod)),
			)
		})

		t1.Run("8. adds a payment record", func(t2 *testing.T) {
			sessionCookie, testUser := test.CreateAndLoginUser(t2, testServer)

			paymentsBeforeFirstSubscription, totalPaymentsBeforeFirstSubscription := test.GetPayments(
				t2,
				testServer,
				sessionCookie,
				0,
				25,
			)
			require.Empty(t2, paymentsBeforeFirstSubscription)
			require.Equal(t2, 0, totalPaymentsBeforeFirstSubscription)

			paymentMethod := test.GenerateDefaultPaymentMethod()
			test.MockSavingDefaultPaymentMethodOnCustomerRequest(t2, testUser, paymentMethod)

			test.StartPaidPlanForExistingUser(
				t2,
				testServer,
				testUser,
				data.LitePlanMonthlyOfferingId,
				sessionCookie,
				true,
				paymentMethod,
			)

			paymentsAfterFirstSubscription, totalPaymentsAfterFirstSubscription := test.GetPayments(
				t2,
				testServer,
				sessionCookie,
				0,
				10,
			)

			require.NotEmpty(t2, paymentsAfterFirstSubscription)
			require.Equal(t2, 1, totalPaymentsAfterFirstSubscription)
		})

		t1.Run("9. sends email when subscription is renewed", func(t2 *testing.T) {
			offeringId := data.LitePlanMonthlyOfferingId

			_, testUser, _ := test.StartPaidPlan(t2, testServer, offeringId)

			gock.New("https://api.resend.com").
				Post("/emails").
				AddMatcher(test.CreateRequestBodyMatcherFunc(func(requestBody map[string]any) {
					require.Equal(t2, []any{testUser.Email}, requestBody["to"])
					require.Equal(t2, "Your subscription has been renewed!", requestBody["subject"])
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
						regexp.MustCompile(`.*We're happy to confirm that your Lite \(Monthly\)\s+subscription has been successfully renewed!`),
						htmlBody,
					)

					require.Contains(t2, htmlBody, "Transaction ID:")
					require.NotContains(t2, htmlBody, "{{.TransactionId}}")

					require.Contains(t2, htmlBody, "Date:")
					require.NotContains(t2, htmlBody, "{{.Date}}")

					require.Contains(t2, htmlBody, "Amount paid:")
					require.NotContains(t2, htmlBody, "{{.AmountPaid}}")
					require.Contains(
						t2,
						htmlBody,
						currency.Prettify(data.PriceTable[offeringId]),
					)

					require.Contains(t2, htmlBody, "Thanks for for your continuing support,")

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

			chargeId := "ch_" + gofakeit.UUID()
			test.MockRequestForGettingPaymentMethodByChargeId(t2, chargeId, paymentMethod)

			invoiceId := "in_" + gofakeit.UUID()

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
								"billing_reason": "subscription_cycle",
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
					"",
				),
			)
		})

	})
}
