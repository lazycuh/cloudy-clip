package common

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/h2non/gock"
	"github.com/stretchr/testify/require"
	"github.com/cloudy-clip/api/internal/common/http/middleware/turnstile"
	"github.com/cloudy-clip/api/internal/user/dto"
	test "github.com/cloudy-clip/api/test/utils"
)

func TestTurnstileVerifierMiddleware(t1 *testing.T) {
	test.Integration(t1, func(testServer *httptest.Server) {
		sendRequest := func(t2 *testing.T, turnstileTokenValue *string) (*http.Response, map[string]any) {
			headers := make(map[string]string)

			if turnstileTokenValue == nil {
				headers = nil
			} else {
				headers[turnstile.TurnstileTokenHeader] = *turnstileTokenValue
			}

			return test.SendPostRequest(
				t2,
				testServer,
				"/api/v1/users",
				&dto.CreateUserRequestPayload{
					Email:       "nhuyvan@gmail.com",
					Password:    "HelloWorld2024",
					DisplayName: "Nhuy Van",
				},
				headers,
			)
		}

		t1.Run("1. returns 400 when turnstile token header is not present", func(t2 *testing.T) {
			turnstile.ClearCache()

			response, responseBody := sendRequest(t2, nil)

			require.Equal(t2, http.StatusBadRequest, response.StatusCode)

			require.Equal(
				t2,
				"failed to verify turnstile token",
				responseBody["message"],
			)

			require.Subset(
				t2,
				responseBody["payload"],
				map[string]any{
					"code": "ValidationException",
				},
			)
		})

		t1.Run("2. returns 400 when turnstile token header is empty", func(t2 *testing.T) {
			turnstile.ClearCache()

			turnstileTokenValue := ""

			response, responseBody := sendRequest(t2, &turnstileTokenValue)

			require.Equal(t2, http.StatusBadRequest, response.StatusCode)

			require.Equal(
				t2,
				"failed to verify turnstile token",
				responseBody["message"],
			)

			require.Subset(
				t2,
				responseBody["payload"],
				map[string]any{
					"code": "ValidationException",
				},
			)
		})

		t1.Run("3. returns 400 when turnstile token is not valid", func(t2 *testing.T) {
			turnstile.ClearCache()
			gock.New("https://challenges.cloudflare.com").
				Post("/turnstile/v0/siteverify").
				Reply(http.StatusOK).
				JSON(map[string]any{
					"success":     false,
					"error-codes": []any{"expected-1", "expected-2"},
				})

			gock.New(testServer.URL).
				EnableNetworking()

			defer gock.Off()

			turnstileTokenValue := "turnstile-token"

			response, responseBody := sendRequest(t2, &turnstileTokenValue)

			require.Equal(t2, http.StatusBadRequest, response.StatusCode)

			require.Equal(
				t2,
				"failed to verify turnstile token",
				responseBody["message"],
			)

			require.Subset(
				t2,
				responseBody["payload"],
				map[string]any{
					"code": "ValidationException",
					"extra": map[string]any{
						"cause": []any{"expected-1", "expected-2"},
					},
				},
			)
		})

		t1.Run("4. succeeds when turnstile token is OK", func(t2 *testing.T) {
			turnstile.ClearCache()

			turnstileTokenValue := "turnstile-token"

			test.MockSendingEmail()

			response, _ := sendRequest(t2, &turnstileTokenValue)

			require.Equal(t2, http.StatusCreated, response.StatusCode)
		})
	})
}
