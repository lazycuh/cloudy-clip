package test

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/require"
)

func GetPayments(t *testing.T, testServer *httptest.Server, sessionCookie string, offset, limit int) ([]any, int) {
	getPaymentsResponse, getPaymentResponseBody := SendGetRequest(
		t,
		testServer,
		fmt.Sprintf("/api/v1/billing/my/payments?offset=%v&limit=%v", offset, limit),
		map[string]string{
			"Cookie": sessionCookie,
		},
	)
	require.Equal(t, http.StatusOK, getPaymentsResponse.StatusCode)

	return GetValueFromMap(getPaymentResponseBody, "payload", "page").([]any),
		int(GetValueFromMap(getPaymentResponseBody, "payload", "total").(float64))
}
