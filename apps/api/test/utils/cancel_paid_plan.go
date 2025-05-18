package test

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"slices"
	"strings"
	"testing"
	"time"

	"github.com/brianvoe/gofakeit/v7"
	"github.com/h2non/gock"
	"github.com/stretchr/testify/require"
	"github.com/cloudy-clip/api/internal/common/currency"
	"github.com/cloudy-clip/api/internal/subscription/model"
	data "github.com/cloudy-clip/api/test"
	"github.com/cloudy-clip/api/test/debug"
)

func CancelPaidPlan(
	t *testing.T,
	testServer *httptest.Server,
	sessionCookie string,
) *TestUser {
	testUser := RestoreAuthenticatedUserSession(t, testServer, sessionCookie)

	activeOfferingId := testUser.Subscription.Plan.OfferingId

	var mockRefundAmount int64 = 50

	gock.New("https://api.stripe.com").
		Post("/v1/invoices/create_preview").
		AddMatcher(CreateRequestBodyMatcherFunc(func(requestBody map[string]any) {
			require.Len(t, requestBody, 5)

			require.Equal(t, requestBody["customer"], testUser.StripeCustomerId)
			require.Equal(t, requestBody["subscription"], testUser.StripeSubscriptionId)
			require.Equal(t, requestBody["subscription_details[cancel_now]"], "true")
			require.Equal(t, requestBody["subscription_details[proration_behavior]"], "always_invoice")
			require.NotEmpty(t, requestBody["subscription_details[proration_date]"])
		})).
		Reply(http.StatusOK).
		JSON(map[string]any{
			"total": mockRefundAmount,
		})

	gock.New("https://api.stripe.com").
		Delete("/v1/subscriptions/" + testUser.StripeSubscriptionId).
		Reply(http.StatusOK).
		JSON(map[string]any{})

	paymentMethod := GetOrCreateDefaultPaymentMethod(testUser)

	chargeId := "ch_" + gofakeit.UUID()

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
		MatchParam("limit", "1").
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
		AddMatcher(CreateRequestBodyMatcher(
			t,
			`{
				"amount": "%v",
				"charge": "%v"
			}`,
			mockRefundAmount,
			chargeId,
		)).
		Reply(http.StatusOK).
		JSON(map[string]any{})

	MockSendingEmail()

	response, _ := SendDeleteRequest(
		t,
		testServer,
		"/api/v1/subscriptions/my",
		map[string]string{
			"Cookie": sessionCookie,
		},
	)

	require.Equal(t, http.StatusNoContent, response.StatusCode)

	CallStripeWebhook(
		t,
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

	testUserAfter := RestoreAuthenticatedUserSession(t, testServer, sessionCookie)
	require.NotNil(t, testUserAfter.Subscription)
	require.NotNil(t, testUserAfter.Subscription.CanceledAt)
	require.Equal(
		t,
		model.SubscriptionCancellationReasonRequestedByUser,
		*testUserAfter.Subscription.CancellationReason,
	)
	require.Equal(t, activeOfferingId, testUserAfter.Subscription.Plan.OfferingId)
	require.NotNil(t, testUserAfter.Subscription.CanceledAt)
	require.True(t, time.Since(*testUserAfter.Subscription.CanceledAt).Seconds() <= 30)
	require.Equal(
		t,
		model.SubscriptionCancellationReasonRequestedByUser,
		*testUserAfter.Subscription.CancellationReason,
	)

	paymentsBeforeSuccessfulRefund, _ := GetPayments(t, testServer, sessionCookie, 0, 25)
	require.Greater(t, len(paymentsBeforeSuccessfulRefund), 1, "should have more than 1 payments")

	inprogressRefundPaymentIndex := slices.IndexFunc(paymentsBeforeSuccessfulRefund, func(current any) bool {
		return current.(map[string]any)["status"] == "REFUND_IN_PROGRESS"
	})

	require.NotEqual(t, -1, inprogressRefundPaymentIndex)

	inprogressRefundPayment := (paymentsBeforeSuccessfulRefund[inprogressRefundPaymentIndex]).(map[string]any)

	require.Equal(t, currency.FormatInt(-mockRefundAmount), inprogressRefundPayment["amountDue"])
	require.Equal(t, "SUBSCRIPTION_CANCELLATION", inprogressRefundPayment["paymentReason"])

	gock.New("https://api.stripe.com").
		Get("/v1/customers/"+testUser.StripeCustomerId+"/balance_transactions").
		MatchParam("limit", "1").
		Reply(http.StatusOK).
		JSON(debug.JsonParse(`
			{
				"object": "list",
				"data": [],
				"has_more": false
			}
		`))

	CallStripeWebhook(
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
						"amount": %v,
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
			data.PriceTable[activeOfferingId],
			data.PriceTable[activeOfferingId],
			mockRefundAmount,
			testUser.Email,
			testUser.StripeCustomerId,
			paymentMethod.PaymentMethodId,
		),
	)

	return testUserAfter
}
