package test

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/require"
)

func VerifyTaskStatus(
	t *testing.T,
	testServer *httptest.Server,
	sessionCookie string,
	taskId string,
	expectedStatus string,
) {
	response, responseBody := SendGetRequest(
		t,
		testServer,
		"/api/v1/tasks/"+taskId,
		map[string]string{
			"Cookie": sessionCookie,
		},
	)

	require.Equal(t, http.StatusOK, response.StatusCode)
	require.Equal(t, expectedStatus, GetValueFromMap(responseBody, "payload", "status").(string))
}
