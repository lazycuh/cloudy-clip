package billing

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/require"
	data "github.com/cloudy-clip/api/test"
	"github.com/cloudy-clip/api/test/debug"
	test "github.com/cloudy-clip/api/test/utils"
)

func TestBillingInfoApi(t1 *testing.T) {
	test.Integration(t1, func(testServer *httptest.Server) {
		t1.Run("1. get billing info for logged-in user", func(t2 *testing.T) {
			sessionCookie, _, _ := test.StartPaidPlan(t2, testServer, data.LitePlanMonthlyOfferingId)

			response, responseBody := test.SendGetRequest(
				t2,
				testServer,
				"/api/v1/billing/my/info",
				map[string]string{
					"Cookie": sessionCookie,
				},
			)

			require.Equal(t2, http.StatusOK, response.StatusCode)

			require.Equal(
				t2,
				debug.JsonParse(`
					{
						"countryCode": "US",
						"postalCode": "99301"
					}
				`),
				responseBody["payload"],
			)
		})

		t1.Run("2. return country code and postal code even when no payment has been made", func(t2 *testing.T) {
			sessionCookie := test.StartFreePlan(t2, testServer, data.FreePlanMonthlyOfferingId)

			response, responseBody := test.SendGetRequest(
				t2,
				testServer,
				"/api/v1/billing/my/info",
				map[string]string{
					"Cookie": sessionCookie,
				},
			)

			require.Equal(t2, http.StatusOK, response.StatusCode)
			require.Equal(
				t2,
				debug.JsonParse(`
					{
						"countryCode": "US",
						"postalCode": "99301"
					}
				`),
				responseBody["payload"],
			)
		})

		t1.Run("3. return 404 when no billing info is found", func(t2 *testing.T) {
			sessionCookie, _ := test.CreateAndLoginUser(t2, testServer)

			response, _ := test.SendGetRequest(
				t2,
				testServer,
				"/api/v1/billing/my/info",
				map[string]string{
					"Cookie": sessionCookie,
				},
			)

			require.Equal(t2, http.StatusNotFound, response.StatusCode)
		})
	})

}
