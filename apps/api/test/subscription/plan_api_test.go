package subscription

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/require"
	test "github.com/cloudy-clip/api/test/utils"
)

func TestPlanApiEndpoints(t1 *testing.T) {
	test.Integration(t1, func(testServer *httptest.Server) {
		const endpointPrefix = "/api/v1/plans"

		sendGetRequestToEndpoint := func(t2 *testing.T, endpoint string) (*http.Response, map[string]any) {
			return test.SendGetRequest(
				t2,
				testServer,
				endpoint,
				make(map[string]string),
			)
		}

		t1.Run("1. returns all plans and their associated entitlements", func(t2 *testing.T) {
			response, responseBody := sendGetRequestToEndpoint(t2, endpointPrefix)

			require.Equal(t2, http.StatusOK, response.StatusCode)

			payload := responseBody["payload"].([]any)

			var expectedPayload []any
			_ = json.Unmarshal([]byte(`
				[
					{
						"planId": "01J7EVJ6F4K87YJVX9JE7ZSZED",
						"displayName": "Free",
						"entitlements": [
							{
								"isRestricted": true,
								"type": "WORD_COUNT",
								"quantity": 250
							},
							{
								"isRestricted": true,
								"type": "IMAGE_UPLOAD",
								"quantity": 0
							},
							{
								"isRestricted": true,
								"type": "RETENTION_PERIOD",
								"quantity": 30
							}
						],
						"offeringId": "01J9FAJGRYSF5Y1338HSE07SB8",
						"price": "0",
						"discountedPrice": "0",
						"renewedIn": "1m"
					},
					{
						"planId": "01J7EVJFS58YH6HSYNCDWJE4JW",
						"displayName": "Lite",
						"entitlements": [
							{
								"isRestricted": false,
								"type": "WORD_COUNT",
								"quantity": 0
							},
							{
								"isRestricted": false,
								"type": "IMAGE_UPLOAD",
								"quantity": 0
							},
							{
								"isRestricted": true,
								"type": "RETENTION_PERIOD",
								"quantity": 30
							}
						],
						"offeringId": "01J9FAJQBCAFBCG5ZV0JE1NDJA",
						"price": "199",
						"discountedPrice": "199",
						"renewedIn": "1m"
					},
					{
						"planId": "01J7EVJNRPXY17SESDS7DY65Y1",
						"displayName": "Essential",
						"entitlements": [
							{
								"isRestricted": false,
								"type": "WORD_COUNT",
								"quantity": 0
							},
							{
								"isRestricted": false,
								"type": "IMAGE_UPLOAD",
								"quantity": 0
							},
							{
								"isRestricted": false,
								"type": "RETENTION_PERIOD",
								"quantity": 0
							}
						],
						"offeringId": "01J9FAJY010PPGWYABP8VSSHCV",
						"price": "399",
						"discountedPrice": "399",
						"renewedIn": "1m"
					},
					{
						"planId": "01J7EVJ6F4K87YJVX9JE7ZSZED",
						"displayName": "Free",
						"entitlements": [
							{
								"isRestricted": true,
								"type": "WORD_COUNT",
								"quantity": 250
							},
							{
								"isRestricted": true,
								"type": "IMAGE_UPLOAD",
								"quantity": 0
							},
							{
								"isRestricted": true,
								"type": "RETENTION_PERIOD",
								"quantity": 30
							}
						],
						"offeringId": "01J9FNB8FZ2XT4NVF9BPQP7Q5G",
						"price": "0",
						"discountedPrice": "0",
						"renewedIn": "1y"
					},
					{
						"planId": "01J7EVJFS58YH6HSYNCDWJE4JW",
						"displayName": "Lite",
						"entitlements": [
							{
								"isRestricted": false,
								"type": "WORD_COUNT",
								"quantity": 0
							},
							{
								"isRestricted": false,
								"type": "IMAGE_UPLOAD",
								"quantity": 0
							},
							{
								"isRestricted": true,
								"type": "RETENTION_PERIOD",
								"quantity": 30
							}
						],
						"offeringId": "01J9FNBNXCHKKC8686BDM19C59",
						"price": "2388",
						"discountedPrice": "1990",
						"renewedIn": "1y"
					},
					{
						"planId": "01J7EVJNRPXY17SESDS7DY65Y1",
						"displayName": "Essential",
						"entitlements": [
							{
								"isRestricted": false,
								"type": "WORD_COUNT",
								"quantity": 0
							},
							{
								"isRestricted": false,
								"type": "IMAGE_UPLOAD",
								"quantity": 0
							},
							{
								"isRestricted": false,
								"type": "RETENTION_PERIOD",
								"quantity": 0
							}
						],
						"offeringId": "01J9FNBYVG59GCHESE64WTG30W",
						"price": "4788",
						"discountedPrice": "3990",
						"renewedIn": "1y"
					}
				]
			`), &expectedPayload)

			require.ElementsMatch(t2, expectedPayload, payload)
		})
	})
}
