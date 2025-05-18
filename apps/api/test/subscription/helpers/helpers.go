package helpers

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"regexp"
	"strings"
	"testing"
	"time"

	"github.com/brianvoe/gofakeit/v7"
	"github.com/h2non/gock"
	"github.com/stretchr/testify/require"
	"github.com/cloudy-clip/api/internal/billing/dto"
	"github.com/cloudy-clip/api/internal/common/currency"
	"github.com/cloudy-clip/api/internal/common/environment"
	"github.com/cloudy-clip/api/internal/common/plan"
	"github.com/cloudy-clip/api/internal/subscription"
	data "github.com/cloudy-clip/api/test"
	"github.com/cloudy-clip/api/test/debug"
	test "github.com/cloudy-clip/api/test/utils"
)

var StripeSubscriptionItemId = "sub_123456789"

func UpgradeSubscriptionSuccessfully(
	t *testing.T,
	testServer *httptest.Server,
	fromOfferingId,
	toOfferingId string,
) (string, *test.TestUser, *dto.PaymentMethod) {
	sessionCookie, testUser, planChangeTaskId, usedPaymentMethod := SetupSubscriptionUpdateFlow(
		t,
		testServer,
		fromOfferingId,
		toOfferingId,
	)

	time.Sleep(500 * time.Millisecond)

	gock.New("https://api.resend.com").
		Post("/emails").
		AddMatcher(test.CreateRequestBodyMatcherFunc(func(requestBody map[string]any) {
			require.Equal(t, []any{testUser.Email}, requestBody["to"])
			require.Equal(t, "Subscription upgraded", requestBody["subject"])
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
				regexp.MustCompile(`.*This email confirms that your subscription has been upgraded\s+from`),
				htmlBody,
			)
			require.NotContains(t, htmlBody, "<strong>{{.OldSubscription}}</strong>")
			require.Contains(t, htmlBody, "<strong>"+plan.PlanNameTable[fromOfferingId]+"</strong>")
			require.NotContains(t, htmlBody, "</strong>{{.NewSubscription}}</strong>")
			require.Contains(t, htmlBody, "<strong>"+plan.PlanNameTable[toOfferingId]+"</strong>")

			require.Contains(t, htmlBody, "Transaction ID:")
			require.NotContains(t, htmlBody, "{{.TransactionId}}")

			require.Contains(t, htmlBody, "Purchase date:")
			require.NotContains(t, htmlBody, "{{.PurchaseDate}}")
			require.Contains(t, htmlBody, time.Now().Format(time.DateOnly))

			require.Contains(t, htmlBody, "Amount paid:")
			require.NotContains(t, htmlBody, "{{.AmountPaid}}")
			require.Contains(
				t,
				htmlBody,
				currency.Prettify(data.PriceTable[toOfferingId]-data.PriceTable[fromOfferingId]),
			)

			require.Contains(t, htmlBody, "Thank you for your continuing support,")
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

	test.TriggerInvoicePaymentSucceededEventForSubscriptionUpdateReason(
		t,
		testServer,
		testUser,
		fromOfferingId,
		toOfferingId,
		"ch_"+gofakeit.UUID(),
		planChangeTaskId,
		usedPaymentMethod,
	)

	test.VerifyTaskStatus(t, testServer, sessionCookie, planChangeTaskId, "SUCCESS")

	testUserAfterPlanChangeSuccesfulPayment := test.RestoreAuthenticatedUserSession(
		t,
		testServer,
		sessionCookie,
	)

	require.Equal(t, toOfferingId, testUserAfterPlanChangeSuccesfulPayment.Subscription.Plan.OfferingId)
	require.NotEqual(
		t,
		testUserAfterPlanChangeSuccesfulPayment.Subscription.Plan.OfferingId,
		testUser.Subscription.Plan.OfferingId,
	)

	return sessionCookie, testUserAfterPlanChangeSuccesfulPayment, usedPaymentMethod
}

func SetupSubscriptionUpdateFlow(
	t *testing.T,
	testServer *httptest.Server,
	fromOfferingId,
	toOfferingId string,
) (string, *test.TestUser, string, *dto.PaymentMethod) {
	sessionCookie, testUser, _ := test.StartPaidPlan(t, testServer, fromOfferingId)

	prorationDateCookie, cookies := PreviewSubscriptionUpdateCheckout(
		t,
		testServer,
		testUser,
		sessionCookie,
		toOfferingId,
		data.PriceTable[toOfferingId],
	)

	newPaymentMethod := test.GenerateNonDefaultPaymentMethod(testUser, true)

	MockSubscriptionUpdate(
		testUser,
		test.CreateRequestBodyMatcherFunc(func(requestBody map[string]any) {
			require.Len(t, requestBody, 12)

			require.Subset(
				t,
				requestBody,
				debug.JsonParse(`
					{
						"billing_cycle_anchor": "now",
						"cancel_at_period_end": "false",
						"default_payment_method": "%v",
						"items[0][id]": "%v",
						"items[0][price]": "%v",
						"metadata[offeringId]": "%v",
						"metadata[userEmail]": "%v",
						"metadata[userId]": "%v",
						"payment_behavior": "error_if_incomplete",
						"proration_behavior": "always_invoice",
						"proration_date": "%v"
					}`,
					newPaymentMethod.PaymentMethodId,
					StripeSubscriptionItemId,
					plan.GetPriceIdByOfferingId(toOfferingId),
					toOfferingId,
					testUser.Email,
					testUser.UserId,
					prorationDateCookie.Value,
				),
			)

			require.NotEmpty(t, requestBody["metadata[taskId]"])
		}),
		http.StatusOK,
		debug.JsonParse(`
			{
				"items": {
					"data": [
						{
							"id": "%v"
						}
					]
				}
			}`,
			StripeSubscriptionItemId,
		),
	)

	changePlanApiResponse, changePlanApiResponseBody := test.SendPutRequest(
		t,
		testServer,
		"/api/v1/subscriptions/my",
		map[string]any{
			"offeringId":      toOfferingId,
			"paymentMethodId": newPaymentMethod.PaymentMethodId,
		},
		map[string]string{
			"Cookie": fmt.Sprintf("%v; %v", sessionCookie, cookies),
		},
	)

	require.Equal(t, http.StatusOK, changePlanApiResponse.StatusCode)

	planChangeTaskId := changePlanApiResponseBody["payload"].(string)

	taskEndpointResponse, taskEndpointResponseBody := test.SendGetRequest(
		t,
		testServer,
		"/api/v1/tasks/"+planChangeTaskId,
		map[string]string{
			"Cookie": sessionCookie,
		},
	)

	require.Equal(t, http.StatusOK, taskEndpointResponse.StatusCode)
	require.Equal(t, "IN_PROGRESS", test.GetValueFromMap(taskEndpointResponseBody, "payload", "status"))

	testUser = test.RestoreAuthenticatedUserSession(t, testServer, sessionCookie)

	require.Equal(t, fromOfferingId, testUser.Subscription.Plan.OfferingId)

	return sessionCookie, testUser, planChangeTaskId, newPaymentMethod
}

func MockSubscriptionUpdate(
	testUser *test.TestUser,
	requestMatcher gock.MatchFunc,
	statusCode int,
	responseBody map[string]any,
) {
	MockGettingSubscriptionItem(testUser)

	mock := gock.New("https://api.stripe.com").
		Post("/v1/subscriptions/" + testUser.StripeSubscriptionId)
	if requestMatcher != nil {
		mock.AddMatcher(requestMatcher)
	}

	mock.Reply(statusCode).JSON(responseBody)
}

func MockGettingSubscriptionItem(testUser *test.TestUser) {
	gock.New("https://api.stripe.com").
		Get("/v1/subscriptions/" + testUser.StripeSubscriptionId).
		Reply(http.StatusOK).
		JSON(debug.JsonParse(`
			{
				"items": {
					"data": [
						{
							"id": "%v"
						}
					]
				}
			}`,
			StripeSubscriptionItemId,
		))
}

func PreviewSubscriptionUpdateCheckout(
	t *testing.T,
	testServer *httptest.Server,
	testUser *test.TestUser,
	sessionCookie,
	offeringId string,
	amountDue int64,
) (prorationDateCookie *http.Cookie, cookies string) {
	MockGettingSubscriptionItem(testUser)

	gock.New("https://api.stripe.com").
		Post("/v1/invoices/create_preview").
		AddMatcher(test.CreateRequestBodyMatcherFunc(func(requestBody map[string]any) {
			require.Len(t, requestBody, 7)

			require.Subset(
				t,
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
					StripeSubscriptionItemId,
					plan.GetPriceIdByOfferingId(offeringId),
				),
			)

			require.NotEmpty(t, requestBody, "subscription_details[proration_date]")
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
			}`,
			data.PriceTable[offeringId],
			data.PriceTable[offeringId]-50,
		))

	response, _ := test.SendGetRequest(
		t,
		testServer,
		"/api/v1/checkout/preview?offeringId="+offeringId,
		map[string]string{
			"Cookie": sessionCookie,
		},
	)

	require.Equal(t, http.StatusOK, response.StatusCode)

	prorationDateCookie = test.GetCookieFromResponse(t, response, subscription.ProrationDateCookieName)

	return prorationDateCookie, fmt.Sprintf(
		"%v=%v",
		prorationDateCookie.Name,
		prorationDateCookie.Value,
	)
}

func DowngradeAndRefund(
	t *testing.T,
	testServer *httptest.Server,
	fromOfferingId,
	toOfferingId string,
) (string, *test.TestUser, *dto.PaymentMethod) {
	chargeId := "ch_" + gofakeit.UUID()
	mockRefundAmount := currency.Abs(data.PriceTable[toOfferingId] - data.PriceTable[fromOfferingId])

	sessionCookie, testUser, downgradeTaskId, usedPaymentMethod := SetupSubscriptionUpdateFlow(
		t,
		testServer,
		fromOfferingId,
		toOfferingId,
	)

	gock.New("https://api.stripe.com").
		Get("/v1/charges/search").
		AddMatcher(func(r1 *http.Request, r2 *gock.Request) (bool, error) {
			query := r1.URL.Query().Get("query")

			hasCustomerFilter := strings.Contains(query, fmt.Sprintf("customer:'%v'", testUser.StripeCustomerId))
			hasAmountFilter := strings.Contains(query, fmt.Sprintf(" AND amount>=%v", mockRefundAmount))
			hasRefundFilter := strings.Contains(query, " AND -refunded:'true'")
			hasStatusFilter := strings.Contains(query, " AND status:'succeeded'")

			return hasCustomerFilter && hasAmountFilter && hasRefundFilter && hasStatusFilter, nil
		}).
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
						"invoice": "%v",
						"outcome": {
							"network_advice_code": null,
							"network_decline_code": null,
							"network_status": "approved_by_network",
							"paymentReason": "NEW_SUBSCRIPTION",
							"risk_level": "normal",
							"risk_score": 22,
							"seller_message": "Payment complete.",
							"type": "authorized"
						},
						"paid": true,
						"payment_intent": "%v",
						"payment_method": "%v"
					}
				],
				"has_more": false
			}`,
			chargeId,
			data.PriceTable[fromOfferingId],
			data.PriceTable[fromOfferingId],
			testUser.StripeCustomerId,
			"in_"+gofakeit.UUID(),
			"pi_"+gofakeit.UUID(),
			usedPaymentMethod.PaymentMethodId,
		))

	gock.New("https://api.stripe.com").
		Post("/v1/refunds").
		AddMatcher(test.CreateRequestBodyMatcher(
			t,
			`{
						"amount":"%v",
						"charge":"%v"
					}`,
			mockRefundAmount,
			chargeId,
		)).
		Reply(http.StatusOK).
		JSON(map[string]any{})

	gock.New("https://api.resend.com").
		Post("/emails").
		AddMatcher(test.CreateRequestBodyMatcherFunc(func(requestBody map[string]any) {
			require.Equal(t, []any{testUser.Email}, requestBody["to"])
			require.Equal(t, "Subscription downgraded", requestBody["subject"])
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
				regexp.MustCompile(`.*This email confirms that your subscription has been\s+downgraded from`),
				htmlBody,
			)
			require.NotContains(t, htmlBody, "<strong>{{.OldSubscription}}</strong>")
			require.Contains(t, htmlBody, "<strong>"+plan.PlanNameTable[fromOfferingId]+"</strong>")
			require.NotContains(t, htmlBody, "<strong>{{.NewSubscription}}</strong>")
			require.Contains(t, htmlBody, "<strong>"+plan.PlanNameTable[toOfferingId]+"</strong>")

			require.Contains(t, htmlBody, "Transaction ID:")
			require.NotContains(t, htmlBody, "{{.TransactionId}}")

			require.Contains(t, htmlBody, "Date:")
			require.NotContains(t, htmlBody, "{{.Date}}")
			require.Contains(t, htmlBody, time.Now().Format(time.DateOnly))

			require.NotContains(t, htmlBody, "Amount paid:")
			require.NotContains(t, htmlBody, "{{.AmountPaid}}")
			require.Regexp(
				t,
				regexp.MustCompile(`.*A refund of \`+currency.Prettify(currency.Abs(data.PriceTable[toOfferingId]-data.PriceTable[fromOfferingId]))+` will be issued back to the\s+original payment method used within 5-10 business days\.`),
				htmlBody,
			)

			require.Contains(t, htmlBody, "Thank you,")
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

	test.TriggerInvoicePaymentSucceededEventForSubscriptionUpdateReason(
		t,
		testServer,
		testUser,
		fromOfferingId,
		toOfferingId,
		chargeId,
		downgradeTaskId,
		usedPaymentMethod,
	)

	gock.New("https://api.stripe.com").
		Get("/v1/customers/"+testUser.StripeCustomerId+"/balance_transactions").
		MatchParam("limit", "1").
		Reply(http.StatusOK).
		JSON(debug.JsonParse(`
			{
				"object": "list",
				"data": [
					{
						"id": "cbtxn_1QVpqSIWw5KeSeJEvdjCV9UM",
						"object": "customer_balance_transaction",
						"amount": -%v,
						"created": 1734161580,
						"credit_note": null,
						"currency": "usd",
						"customer": "%v",
						"description": null,
						"ending_balance": -%v,
						"invoice": null,
						"livemode": false,
						"metadata": {},
						"type": "adjustment"
					}
				],
				"has_more": false,
				"url": "/v1/customers/%v/balance_transactions"
			}`,
			mockRefundAmount,
			testUser.StripeCustomerId,
			mockRefundAmount,
			testUser.StripeCustomerId,
		))

	gock.New("https://api.stripe.com").
		Post("/v1/customers/" + testUser.StripeCustomerId + "/balance_transactions").
		AddMatcher(test.CreateRequestBodyMatcher(
			t,
			`{
				"amount": "%v",
				"currency": "usd"
			}`,
			mockRefundAmount,
		)).
		Reply(http.StatusOK).
		JSON(debug.JsonParse(`
			{
				"id": "cbtxn_1QVpqSIWw5KeSeJEvdjCV9UM",
				"object": "customer_balance_transaction",
				"amount": %v,
				"created": %v,
				"credit_note": null,
				"currency": "usd",
				"customer": "%v",
				"description": null,
				"ending_balance": 0,
				"invoice": null,
				"livemode": false,
				"metadata": {},
				"type": "adjustment"
			}`,
			mockRefundAmount,
			time.Now().Unix(),
			testUser.StripeCustomerId,
		))

	test.CallStripeWebhook(
		t,
		testServer,
		fmt.Sprintf(`
			{
				"api_version": "2024-06-20",
				"id": "evt_3QTyXPIWw5KeSeJE1jLmvlCe",
				"object": "event",
				"type": "charge.refunded",
				"data": {
					"object": {
						"id": "%v",
						"object": "charge",
						"amount": 100,
						"amount_captured": %v,
						"amount_refunded": %v,
						"billing_details": {
							"email": "%v"
						},
						"currency": "usd",
						"customer": "%v",
						"invoice": "in_1QTyXOIWw5KeSeJEhPRWkjJw",
						"payment_intent": "pi_123456789",
						"payment_method": "%v",
						"status": "succeeded"
					}
				}
			}`,
			chargeId,
			data.PriceTable[fromOfferingId],
			data.PriceTable[fromOfferingId],
			testUser.Email,
			testUser.StripeCustomerId,
			usedPaymentMethod.PaymentMethodId,
		),
	)

	test.VerifyTaskStatus(t, testServer, sessionCookie, downgradeTaskId, "SUCCESS")

	return sessionCookie, testUser, usedPaymentMethod
}
