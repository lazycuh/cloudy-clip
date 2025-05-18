package test

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/require"
	"github.com/cloudy-clip/api/internal/common/http/middleware/turnstile"
	_subscriptionDto "github.com/cloudy-clip/api/internal/subscription/dto"
	_userDto "github.com/cloudy-clip/api/internal/user/dto"
	data "github.com/cloudy-clip/api/test"
	"github.com/cloudy-clip/api/test/debug"
)

func StartFreePlan(
	t *testing.T,
	testServer *httptest.Server,
	offeringId string,
) string {
	sessionCookie, testUserAfterLogin := CreateAndLoginUser(t, testServer)

	MockCustomerCreationRequest(t, testUserAfterLogin)

	checkoutResponse, _ := SendPostRequest(
		t,
		testServer,
		"/api/v1/checkout",
		_subscriptionDto.FirstSubscriptionCheckoutRequest{
			FullName:    testUserAfterLogin.DisplayName,
			OfferingId:  data.FreePlanMonthlyOfferingId,
			CountryCode: "US",
			PostalCode:  "99301",
		},
		map[string]string{
			"Cookie":                       sessionCookie,
			turnstile.TurnstileTokenHeader: "turnstile-token",
		},
	)

	require.Equal(t, http.StatusOK, checkoutResponse.StatusCode)

	getAuthenticatedUserApiResponse, getAuthenticatedUserApiResponseBody := SendGetRequest(
		t,
		testServer,
		"/api/v1/users/me/sessions/my",
		map[string]string{
			"Cookie": sessionCookie,
		},
	)

	require.Equal(t, http.StatusOK, getAuthenticatedUserApiResponse.StatusCode)

	var authenticatedUser _userDto.AuthenticatedUser
	debug.JsonParseInto(getAuthenticatedUserApiResponseBody["payload"], &authenticatedUser)

	require.NotNil(t, authenticatedUser.Subscription)
	require.Nil(t, authenticatedUser.Subscription.CanceledAt)
	require.Nil(t, authenticatedUser.Subscription.CancellationReason)
	require.Equal(t, "Free", authenticatedUser.Subscription.Plan.DisplayName)

	require.Nil(t, authenticatedUser.Subscription.CanceledAt)

	return sessionCookie
}
