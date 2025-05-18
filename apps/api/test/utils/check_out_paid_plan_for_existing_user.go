package test

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/brianvoe/gofakeit/v7"
	"github.com/stretchr/testify/require"
	_billingDto "github.com/cloudy-clip/api/internal/billing/dto"
	"github.com/cloudy-clip/api/internal/common/http/middleware/turnstile"
	"github.com/cloudy-clip/api/internal/subscription/dto"
)

func CheckOutPaidPlanForExistingUser(
	t *testing.T,
	testServer *httptest.Server,
	testUser *TestUser,
	offeringId string,
	sessionCookie string,
	paymentMethod *_billingDto.PaymentMethod,
) {
	MockSubscriptionCreationRequest(t, testUser, offeringId, false)

	response, responseBody := SendPostRequest(
		t,
		testServer,
		"/api/v1/checkout",
		dto.FirstSubscriptionCheckoutRequest{
			FullName:    gofakeit.Name(),
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

	MockSavingDefaultPaymentMethodOnCustomerRequest(t, testUser, paymentMethod)

	TriggerInvoicePaymentSucceededEventForSubscriptionCreateReason(
		t,
		testServer,
		testUser,
		offeringId,
		GetValueFromMap(responseBody, "payload", "taskId").(string),
		paymentMethod,
	)

	testUserBefore := RestoreAuthenticatedUserSession(t, testServer, sessionCookie)
	require.NotNil(t, testUserBefore.Subscription)
	require.Nil(t, testUserBefore.Subscription.CanceledAt)
	require.Nil(t, testUserBefore.Subscription.CancellationReason)
	require.Equal(t, offeringId, testUserBefore.Subscription.Plan.OfferingId)
	require.Nil(t, testUserBefore.Subscription.CanceledAt)
}
