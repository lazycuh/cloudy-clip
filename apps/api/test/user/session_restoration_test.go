package user

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/require"
	"github.com/cloudy-clip/api/internal/user"
	"github.com/cloudy-clip/api/internal/user/model"
	test "github.com/cloudy-clip/api/test/utils"
)

func TestSessionRestorationEndpoint(t1 *testing.T) {
	test.Integration(t1, func(testServer *httptest.Server) {
		const endpointToTest = "/api/v1/users/me/sessions/my"

		userRepository := user.NewUserRepository()

		t1.Run("1. returns 404 when no session ID cookie is found", func(t2 *testing.T) {
			_, _ = test.CreateAndLoginUser(t2, testServer)

			response, responseBody := test.SendGetRequest(
				t2,
				testServer,
				endpointToTest,
				nil,
			)

			require.Equal(t2, http.StatusNotFound, response.StatusCode)

			require.Equal(
				t2,
				"no existing session was found",
				responseBody["message"],
			)
		})

		t1.Run("2. can restore previous session", func(t2 *testing.T) {
			sessionCookie, authenticatedUser := test.CreateAndLoginUser(t2, testServer)

			response, responseBody := test.SendGetRequest(
				t2,
				testServer,
				endpointToTest,
				map[string]string{
					"Cookie": sessionCookie,
				},
			)

			require.Equal(t2, http.StatusOK, response.StatusCode)

			require.Subset(
				t2,
				responseBody["payload"],
				map[string]any{
					"email":       authenticatedUser.Email,
					"displayName": authenticatedUser.DisplayName,
				},
			)
		})

		t1.Run("3. returns 404 when session ID cookie is not valid", func(t2 *testing.T) {
			response, responseBody := test.SendGetRequest(
				t2,
				testServer,
				endpointToTest,
				map[string]string{
					user.SessionIdCookieName: "invalid-session-id",
				},
			)

			require.Equal(t2, http.StatusNotFound, response.StatusCode)

			require.Equal(
				t2,
				"no existing session was found",
				responseBody["message"],
			)
		})

		t1.Run("4. returns 404 when user IP is different from the one encoded in the session ID", func(t2 *testing.T) {
			sessionCookie, _ := test.CreateAndLoginUser(t2, testServer)

			response, _ := test.SendGetRequest(
				t2,
				testServer,
				endpointToTest,
				map[string]string{
					"Cookie": sessionCookie,
				},
			)

			require.Equal(t2, http.StatusOK, response.StatusCode)

			response, responseBody := test.SendGetRequest(
				t2,
				testServer,
				endpointToTest,
				map[string]string{
					user.SessionIdCookieName: test.GetCookieValueFromResponse(t2, response, user.SessionIdCookieName),
					"True-Client-IP":         "1.1.1.1",
					"X-Forwarded-For":        "1.1.1.1",
					"X-Real-IP":              "1.1.1.1",
				},
			)

			require.Equal(t2, http.StatusNotFound, response.StatusCode)

			require.Equal(
				t2,
				"no existing session was found",
				responseBody["message"],
			)
		})

		t1.Run("5. returns 404 when user has been blocked", func(t2 *testing.T) {
			sessionCookie, testUser := test.CreateAndLoginUser(t2, testServer)

			response, _ := test.SendGetRequest(
				t2,
				testServer,
				endpointToTest,
				map[string]string{
					"Cookie": sessionCookie,
				},
			)

			require.Equal(t2, http.StatusOK, response.StatusCode)

			testUserModel := test.GetTestUserModelByEmail(t2, testUser.Email)

			_ = userRepository.BlockUser(context.Background(), testUserModel, model.UserStatusReasonUnverifiedEmail)

			response, responseBody := test.SendGetRequest(
				t2,
				testServer,
				endpointToTest,
				map[string]string{
					user.SessionIdCookieName: test.GetCookieValueFromResponse(t2, response, user.SessionIdCookieName),
				},
			)

			require.Equal(t2, http.StatusNotFound, response.StatusCode)

			require.Equal(
				t2,
				"no existing session was found",
				responseBody["message"],
			)
		})

		t1.Run("6. returns 404 when user agent is different from the one encoded in the session ID", func(t2 *testing.T) {
			sessionCookie, _ := test.CreateAndLoginUser(t2, testServer)

			response, _ := test.SendGetRequest(
				t2,
				testServer,
				endpointToTest,
				map[string]string{
					"Cookie": sessionCookie,
				},
			)

			require.Equal(t2, http.StatusOK, response.StatusCode)

			response, responseBody := test.SendGetRequest(
				t2,
				testServer,
				endpointToTest,
				map[string]string{
					user.SessionIdCookieName: test.GetCookieValueFromResponse(t2, response, user.SessionIdCookieName),
					"User-Agent":             "Mozilla/5.0 (Linux; Android 13; SM-G981B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Mobile Safari/537.36",
				},
			)

			require.Equal(t2, http.StatusNotFound, response.StatusCode)

			require.Equal(
				t2,
				"no existing session was found",
				responseBody["message"],
			)
		})

	})
}
