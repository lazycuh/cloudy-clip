package test

import (
	"net/http"
	"testing"
	"time"

	"github.com/h2non/gock"
	"github.com/stretchr/testify/require"
	"github.com/cloudy-clip/api/internal/billing/dto"
	"github.com/cloudy-clip/api/internal/common/plan"
	data "github.com/cloudy-clip/api/test"
	"github.com/cloudy-clip/api/test/debug"
)

func MockSubscriptionCreationRequest(
	t *testing.T,
	testUser *TestUser,
	offeringId string,
	shouldVerifyRequestBody bool,
) {
	gock.New("https://api.stripe.com").
		Post("/v1/subscriptions").
		AddMatcher(CreateRequestBodyMatcherFunc(func(requestBody map[string]any) {
			if !shouldVerifyRequestBody {
				return
			}

			require.Len(t, requestBody, 10)

			require.Subset(
				t,
				requestBody,
				debug.JsonParse(`
                    {
                        "customer":"%v",
                        "expand[0]": "latest_invoice.payment_intent",
                        "items[0][price]": "%v",
                        "metadata[offeringId]": "%v",
                        "metadata[userEmail]": "%v",
                        "metadata[userId]": "%v",
                        "payment_behavior": "default_incomplete",
                        "payment_settings[payment_method_types][0]": "card",
                        "payment_settings[save_default_payment_method]": "on_subscription"
                    }`,
					testUser.StripeCustomerId,
					plan.GetPriceIdByOfferingId(offeringId),
					offeringId,
					testUser.Email,
					testUser.UserId,
				),
			)

			require.NotEmpty(t, requestBody, "taskId")
		})).
		Reply(http.StatusCreated).
		JSON(debug.JsonParse(`
            {
                "latest_invoice": {
                    "payment_intent": {
                        "client_secret": "pi_123456789"
                    },
                    "subtotal":   %v,
                    "tax":        0,
                    "amount_due": %v,
                    "customer_address": {
                        "postal_code": "99301",
                        "country": "US"
                    }
                }
            }`,
			data.PriceTable[offeringId],
			data.PriceTable[offeringId],
		))
}

func MockRequestForGettingPaymentMethodByChargeId(t *testing.T, chargeId string, paymentMethod *dto.PaymentMethod) {
	gock.New("https://api.stripe.com").
		Get("/v1/charges/" + chargeId).
		Reply(http.StatusOK).
		JSON(debug.JsonParse(`
			{
				"created": %v,
				"payment_method": "%v",
				"payment_method_details": {
					"card": {
						"exp_month": %v,
						"exp_year":  %v,
						"last4":     "%v",
						"brand":     "%v"
					}
				}
			}`,
			time.Now().Unix(),
			paymentMethod.PaymentMethodId,
			paymentMethod.ExpMonth,
			paymentMethod.ExpYear,
			paymentMethod.Last4,
			paymentMethod.Brand,
		))
}

func MockSavingDefaultPaymentMethodOnCustomerRequest(
	t *testing.T,
	testUser *TestUser,
	paymentMethod *dto.PaymentMethod,
) {
	gock.New("https://api.stripe.com").
		Post("/v1/customers/" + testUser.StripeCustomerId).
		AddMatcher(CreateRequestBodyMatcher(
			t,
			`{ "invoice_settings[default_payment_method]": "%v" }`,
			paymentMethod.PaymentMethodId,
		)).
		Reply(http.StatusOK).
		JSON(map[string]any{})
}

func MockCustomerCreationRequest(t *testing.T, testUser *TestUser) {
	gock.New("https://api.stripe.com").
		Post("/v1/customers").
		AddMatcher(CreateRequestBodyMatcher(
			t,
			`{
				"address[country]": "US",
				"address[postal_code]": "99301",
				"email": "%v",
				"name": "%v"
			}`,
			testUser.Email,
			testUser.DisplayName,
		)).
		Reply(http.StatusCreated).
		JSON(map[string]any{
			"id": testUser.StripeCustomerId,
		})
}

func MockSendingEmail() {
	gock.New("https://api.resend.com").
		Post("/emails").
		Reply(http.StatusOK).
		JSON(map[string]any{})
}
