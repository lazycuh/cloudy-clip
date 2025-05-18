package test

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/brianvoe/gofakeit/v7"
	"github.com/h2non/gock"
	"github.com/stretchr/testify/require"
	"github.com/stripe/stripe-go/v79"
	"github.com/stripe/stripe-go/v79/webhook"
	"github.com/cloudy-clip/api/internal/billing/dto"
	"github.com/cloudy-clip/api/internal/common/environment"
	"github.com/cloudy-clip/api/internal/common/plan"
	data "github.com/cloudy-clip/api/test"
	"github.com/cloudy-clip/api/test/debug"
)

func TriggerInvoicePaymentSucceededEventForSubscriptionCreateReason(
	t *testing.T,
	testServer *httptest.Server,
	testUser *TestUser,
	offeringId,
	taskId string,
	paymentMethod *dto.PaymentMethod,
) {
	chargeId := "ch_" + gofakeit.UUID()
	MockRequestForGettingPaymentMethodByChargeId(t, chargeId, paymentMethod)

	invoiceId := "in_" + gofakeit.UUID()

	MockSendingEmail()

	CallStripeWebhook(
		t,
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
}

func CallStripeWebhook(t *testing.T, testServer *httptest.Server, requestBodyPayload string) {
	stripeSignedPayload := webhook.GenerateTestSignedPayload(&webhook.UnsignedPayload{
		Payload: []byte(requestBodyPayload),
		Secret:  environment.Config.PaymentGatewayWebhookSecret,
	})

	response, _ := SendPostRequest(
		t,
		testServer,
		"/api/v1/stripe",
		stripeSignedPayload.Payload,
		map[string]string{
			"Stripe-Signature": stripeSignedPayload.Header,
		},
	)

	require.Equal(t, http.StatusOK, response.StatusCode)

	time.Sleep(time.Millisecond * 500)
}

func TriggerInvoicePaymentSucceededEventForSubscriptionUpdateReason(
	t *testing.T,
	testServer *httptest.Server,
	testUser *TestUser,
	fromOfferingId,
	toOfferingId,
	chargeId,
	taskId string,
	paymentMethod *dto.PaymentMethod,
) {
	amountDue := data.PriceTable[toOfferingId] - data.PriceTable[fromOfferingId]
	chargeIdLine := fmt.Sprintf(`"charge": "%v",`, chargeId)

	if amountDue > 0 {
		MockRequestForGettingPaymentMethodByChargeId(t, chargeId, paymentMethod)

		if !paymentMethod.IsDefault {
			MockSavingDefaultPaymentMethodOnCustomerRequest(t, testUser, paymentMethod)
		}

	} else {
		chargeIdLine = ""
	}

	invoiceId := "in_" + gofakeit.UUID()

	CallStripeWebhook(
		t,
		testServer,
		fmt.Sprintf(`
			{
				"api_version": "2024-06-20",
				"data": {
					"object": {
						"id": "%v",
						"object": "invoice",
						"billing_reason": "subscription_update",
						%v
						"created": %v,
						"currency": "usd",
						"customer": {
							"id": "%v"
						},
						"customer_address": {
							"country": "US",
							"postal_code": "99301"
						},
						"lines": {
							"object": "list",
							"data": [
								{
									"id": "il_1R2oXOIWw5KeSeJEkC8inFAb",
									"object": "line_item",
									"plan": {
										"id": "%v",
										"object": "plan",
										"active": true,
										"amount": %v
									},
									"price": {
										"id": "%v",
										"object": "price",
										"active": true,
										"unit_amount": %v
									},
									"period": {
										"end": %v
									},
									"subscription": "%v",
									"subscription_item": "si_RwhvOfy7w7S7X0",
									"type": "invoiceitem"
								},
								{
									"id": "il_1R2oXOIWw5KeSeJEuCSaYQb9",
									"object": "line_item",
									"plan": {
										"id": "%v",
										"object": "plan",
										"active": true,
										"amount": %v
									},
									"price": {
										"id": "%v",
										"object": "plan",
										"active": true,
										"unit_amount": %v
									},
									"subscription": "%v",
									"subscription_item": "si_RwhvOfy7w7S7X0",
									"type": "subscription"
								}
							],
							"has_more": false,
							"total_count": 2
						},
						"status_transitions": {
							"paid_at": %v
						},
						"subscription": "%v",
						"subscription_details": {
							"metadata": {
								"offeringId": "%v",
								"taskId": "%v",
								"userEmail": "%v",
								"userId": "%v"
							}
						},
						"subtotal": %v,
						"amount_due": %v,
						"amount_paid": %v,
						"subtotal_excluding_tax": %v,
						"total": %v
					}
				},
				"id": "evt_1QAnOYIWw5KeSeJEo2nTkbxs",
				"object": "event",
				"type": "invoice.payment_succeeded"
			}`,
			invoiceId,
			chargeIdLine,
			time.Now().Unix(),
			testUser.StripeCustomerId,
			plan.GetPriceIdByOfferingId(fromOfferingId),
			data.PriceTable[fromOfferingId],
			plan.GetPriceIdByOfferingId(fromOfferingId),
			data.PriceTable[fromOfferingId],
			time.Now().Add(time.Duration(30*60)*time.Hour).Unix(),
			testUser.StripeSubscriptionId,
			plan.GetPriceIdByOfferingId(toOfferingId),
			data.PriceTable[toOfferingId],
			plan.GetPriceIdByOfferingId(toOfferingId),
			data.PriceTable[toOfferingId],
			testUser.StripeSubscriptionId,
			time.Now().Unix(),
			testUser.StripeSubscriptionId,
			toOfferingId,
			taskId,
			testUser.Email,
			testUser.UserId,
			amountDue,
			amountDue,
			amountDue,
			amountDue,
			amountDue,
		),
	)
}

func TriggerInvoicePaymentFailedStripeEvent(
	t *testing.T,
	testServer *httptest.Server,
	testUser *TestUser,
	offeringId,
	taskId string,
	billingReason stripe.InvoiceBillingReason,
) *dto.PaymentMethod {
	chargeId := "ch_" + gofakeit.UUID()

	paymentMethod := GenerateNonDefaultPaymentMethod(testUser, false)

	gock.New("https://api.stripe.com").
		Get("/v1/charges/" + chargeId).
		Reply(http.StatusOK).
		JSON(debug.JsonParse(`
			{
				"id": "%v",
				"created": %v,
				"payment_method": "%v",
				"failure_code": "card_declined",
				"outcome": {
					"reason": "generic_decline"
				},
				"payment_method_details": {
					"card": {
						"exp_month": %v,
						"exp_year":  %v,
						"last4":     "%v",
						"brand":     "%v"
					}
				}
			}`,
			chargeId,
			time.Now().Unix(),
			paymentMethod.PaymentMethodId,
			paymentMethod.ExpMonth,
			paymentMethod.ExpYear,
			paymentMethod.Last4,
			paymentMethod.Brand,
		))

	invoiceId := "in_" + gofakeit.UUID()

	CallStripeWebhook(
		t,
		testServer,
		fmt.Sprintf(`
			{
				"api_version": "2024-06-20",
				"data": {
					"object": {
						"id": "%v",
						"billing_reason": "%v",
						"object": "invoice",
						"charge": "%v",
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
				"type": "invoice.payment_failed"
			}`,
			invoiceId,
			billingReason,
			chargeId,
			testUser.StripeCustomerId,
			invoiceId,
			time.Now().Add(time.Duration(30*60)*time.Hour).Unix(),
			data.PriceTable[offeringId],
			data.PriceTable[offeringId],
			testUser.StripeSubscriptionId,
			testUser.Email,
			testUser.UserId,
			offeringId,
			taskId,
		),
	)

	return paymentMethod
}
