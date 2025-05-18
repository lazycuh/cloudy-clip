package test

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/require"
	"github.com/cloudy-clip/api/internal/billing"
	"github.com/cloudy-clip/api/internal/common/database"
	"github.com/cloudy-clip/api/internal/user/dto"
	"github.com/cloudy-clip/api/test/debug"
)

func RestoreAuthenticatedUserSession(
	t *testing.T,
	testServer *httptest.Server,
	sessionCookie string,
) *TestUser {
	response, responseBody := SendGetRequest(
		t,
		testServer,
		"/api/v1/users/me/sessions/my",
		map[string]string{
			"Cookie": sessionCookie,
		},
	)

	require.Equal(t, http.StatusOK, response.StatusCode)

	var authenticatedUser dto.AuthenticatedUser
	debug.JsonParseInto(responseBody["payload"], &authenticatedUser)

	restoredTestUser := NewTestUser(&authenticatedUser)

	billingInfo, err := billing.
		GetBillingRepository().
		FindBillingInfoByUserId(context.Background(), nil, restoredTestUser.UserId)
	if err != nil && !database.IsEmptyResultError(err) {
		panic(err)
	}

	if billingInfo.BillingCustomerID != nil {
		restoredTestUser.StripeCustomerId = *billingInfo.BillingCustomerID
	}

	if billingInfo.StripeSubscriptionID != nil {
		restoredTestUser.StripeSubscriptionId = *billingInfo.StripeSubscriptionID
	}

	return restoredTestUser
}
