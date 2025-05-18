package test

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/require"
	"github.com/cloudy-clip/api/internal/subscription/model"
)

func CancelFreePlan(
	t *testing.T,
	testServer *httptest.Server,
	sessionCookie string,
) *TestUser {
	response, _ := SendDeleteRequest(
		t,
		testServer,
		"/api/v1/subscriptions/my",
		map[string]string{
			"Cookie": sessionCookie,
		},
	)
	require.Equal(t, http.StatusNoContent, response.StatusCode)

	testUserAfterCancellation := RestoreAuthenticatedUserSession(t, testServer, sessionCookie)
	require.NotNil(t, testUserAfterCancellation.Subscription)
	require.NotNil(t, testUserAfterCancellation.Subscription.CanceledAt)
	require.Equal(
		t,
		model.SubscriptionCancellationReasonRequestedByUser,
		*testUserAfterCancellation.Subscription.CancellationReason,
	)
	require.Equal(t, "Free", testUserAfterCancellation.Subscription.Plan.DisplayName)

	return testUserAfterCancellation
}
