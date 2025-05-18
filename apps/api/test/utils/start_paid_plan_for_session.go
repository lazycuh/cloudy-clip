package test

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/require"
	_billingDto "github.com/cloudy-clip/api/internal/billing/dto"
	"github.com/cloudy-clip/api/internal/common/http/middleware/turnstile"
	"github.com/cloudy-clip/api/internal/subscription/dto"
)

func StartPaidPlanForExistingUser(
	t *testing.T,
	testServer *httptest.Server,
	testUser *TestUser,
	offeringId,
	sessionCookie string,
	shouldCreateCustomerOnStripe bool,
	paymentMethod *_billingDto.PaymentMethod,
) {
	testUserAfterRestore := RestoreAuthenticatedUserSession(t, testServer, sessionCookie)
	testUserAfterRestore.StripeCustomerId = testUser.StripeCustomerId
	testUserAfterRestore.StripeSubscriptionId = testUser.StripeSubscriptionId

	if shouldCreateCustomerOnStripe {
		MockCustomerCreationRequest(t, testUserAfterRestore)
	}

	MockSubscriptionCreationRequest(t, testUserAfterRestore, offeringId, true)

	response, responseBody := SendPostRequest(
		t,
		testServer,
		"/api/v1/checkout",
		dto.FirstSubscriptionCheckoutRequest{
			FullName:    testUserAfterRestore.DisplayName,
			OfferingId:  offeringId,
			CountryCode: "US",
			PostalCode:  "99301",
		},
		map[string]string{
			"Cookie":                       sessionCookie,
			turnstile.TurnstileTokenHeader: "turnstile-token",
		},
	)

	require.Equal(t, http.StatusOK, response.StatusCode)

	TriggerInvoicePaymentSucceededEventForSubscriptionCreateReason(
		t,
		testServer,
		testUserAfterRestore,
		offeringId,
		GetValueFromMap(responseBody, "payload", "taskId").(string),
		paymentMethod,
	)

	testUserAfterPurchase := RestoreAuthenticatedUserSession(t, testServer, sessionCookie)

	require.NotNil(t, testUserAfterPurchase.Subscription)
	require.Nil(t, testUserAfterPurchase.Subscription.CanceledAt)
	require.Nil(t, testUserAfterPurchase.Subscription.CancellationReason)
	require.Equal(t, offeringId, testUserAfterPurchase.Subscription.Plan.OfferingId)
	require.Nil(t, testUserAfterPurchase.Subscription.CanceledAt)
}
