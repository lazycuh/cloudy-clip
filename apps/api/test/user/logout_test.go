package user

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"slices"
	"testing"

	"github.com/stretchr/testify/require"
	"github.com/cloudy-clip/api/internal/common/http/middleware/turnstile"
	"github.com/cloudy-clip/api/internal/common/jwt"
	"github.com/cloudy-clip/api/internal/user"
	test "github.com/cloudy-clip/api/test/utils"
)

func TestLogoutEndpoint(t1 *testing.T) {
	test.Integration(t1, func(testServer *httptest.Server) {
		const endpointToTest = "/api/v1/users/me/sessions/my"

		sessionCookie, _ := test.CreateAndLoginUser(t1, testServer)

		t1.Run("1. returns 401 when jwt cookie is missing", func(t2 *testing.T) {
			response, responseBody := test.SendDeleteRequest(
				t2,
				testServer,
				endpointToTest,
				map[string]string{
					turnstile.TurnstileTokenHeader: "turnstile-token",
					"Cookie": fmt.Sprintf(
						"%s=%s",
						user.SessionIdCookieName,
						"sessionId",
					),
				},
			)

			require.Equal(t2, http.StatusUnauthorized, response.StatusCode)

			require.Equal(
				t2,
				"jwt is missing or empty",
				responseBody["message"],
			)

			require.Subset(
				t2,
				responseBody["payload"],
				map[string]any{
					"code": "UnauthorizedException",
				},
			)
		})

		t1.Run("2. returns 401 when jwt cookie is invalid", func(t2 *testing.T) {
			response, responseBody := test.SendDeleteRequest(
				t2,
				testServer,
				endpointToTest,
				map[string]string{
					turnstile.TurnstileTokenHeader: "turnstile-token",
					"Cookie": fmt.Sprintf(
						"%s=%s; %s=%s",
						user.SessionIdCookieName,
						"sessionId",
						jwt.JwtCookieName,
						"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c",
					),
				},
			)

			require.Equal(t2, http.StatusUnauthorized, response.StatusCode)

			require.Equal(
				t2,
				"failed to verify jwt",
				responseBody["message"],
			)

			require.Subset(
				t2,
				responseBody["payload"],
				map[string]any{
					"code": "UnauthorizedException",
				},
			)
		})

		t1.Run("3. returns 204 success", func(t2 *testing.T) {
			response, _ := test.SendDeleteRequest(
				t2,
				testServer,
				endpointToTest,
				map[string]string{
					turnstile.TurnstileTokenHeader: "turnstile-token",
					"Cookie":                       sessionCookie,
				},
			)

			require.Equal(t2, http.StatusNoContent, response.StatusCode)

			sessionIdCookieIndex := slices.IndexFunc(response.Cookies(), func(cookie *http.Cookie) bool {
				return cookie.Name == user.SessionIdCookieName
			})

			require.Equal(
				t2,
				1,
				sessionIdCookieIndex,
				"no session ID cookie was found",
			)

			require.Empty(
				t2,
				response.Cookies()[sessionIdCookieIndex].Value,
			)

		})
	})
}
