package test

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/require"
	_billingDto "github.com/cloudy-clip/api/internal/billing/dto"
	"github.com/cloudy-clip/api/internal/common/http/middleware/turnstile"
	"github.com/cloudy-clip/api/internal/subscription/dto"
	data "github.com/cloudy-clip/api/test"
)

func StartPaidPlan(
	t *testing.T,
	testServer *httptest.Server,
	offeringId string,
) (string, *TestUser, *_billingDto.PaymentMethod) {
	if data.PriceTable[offeringId] == 0 {
		panic(fmt.Errorf("provided offering ID '%s' is for a free plan", offeringId))
	}

	sessionCookie, testUser := CreateAndLoginUser(t, testServer)

	MockCustomerCreationRequest(t, testUser)

	MockSubscriptionCreationRequest(t, testUser, offeringId, true)

	response, responseBody := SendPostRequest(
		t,
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

	require.Equal(t, http.StatusOK, response.StatusCode)

	paymentMethod := GetOrCreateDefaultPaymentMethod(testUser)

	MockSavingDefaultPaymentMethodOnCustomerRequest(t, testUser, paymentMethod)

	TriggerInvoicePaymentSucceededEventForSubscriptionCreateReason(
		t,
		testServer,
		testUser,
		offeringId,
		GetValueFromMap(responseBody, "payload", "taskId").(string),
		paymentMethod,
	)

	testUserAfterPurchase := RestoreAuthenticatedUserSession(t, testServer, sessionCookie)
	require.NotNil(t, testUserAfterPurchase.Subscription)
	require.Equal(t, offeringId, testUserAfterPurchase.Subscription.Plan.OfferingId)
	require.Nil(t, testUserAfterPurchase.Subscription.CanceledAt)
	require.Nil(t, testUserAfterPurchase.Subscription.CancellationReason)

	return sessionCookie, testUserAfterPurchase, paymentMethod
}
