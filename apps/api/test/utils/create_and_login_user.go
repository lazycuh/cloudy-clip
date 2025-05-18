package test

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/brianvoe/gofakeit/v7"
	"github.com/stretchr/testify/require"
	"github.com/cloudy-clip/api/internal/common/http/middleware/turnstile"
	"github.com/cloudy-clip/api/internal/common/jwt"
	"github.com/cloudy-clip/api/internal/user"
	"github.com/cloudy-clip/api/internal/user/dto"
	data "github.com/cloudy-clip/api/test"
	"github.com/cloudy-clip/api/test/debug"
)

func CreateAndLoginUser(t *testing.T, testServer *httptest.Server) (string, *TestUser) {
	createUserRequestPayload := &dto.CreateUserRequestPayload{
		Email:       gofakeit.Email(),
		Password:    data.NewUserPassword,
		DisplayName: gofakeit.Name(),
	}

	MockSendingEmail()

	userCreationResponse, _ := SendPostRequest(
		t,
		testServer,
		"/api/v1/users",
		createUserRequestPayload,
		map[string]string{
			turnstile.TurnstileTokenHeader: "turnstile-token",
		},
	)

	require.Equal(t, http.StatusCreated, userCreationResponse.StatusCode)

	response, responseBody := SendPostRequest(
		t,
		testServer,
		"/api/v1/users/me/sessions",
		&dto.LoginRequestPayload{
			Email:    createUserRequestPayload.Email,
			Password: createUserRequestPayload.Password,
		},
		map[string]string{
			turnstile.TurnstileTokenHeader: "turnstile-token",
		},
	)

	require.Equal(t, http.StatusOK, response.StatusCode)

	var authenticatedUser dto.AuthenticatedUser
	debug.JsonParseInto(responseBody["payload"], &authenticatedUser)

	return makeSessionCookie(
		GetCookieValueFromResponse(t, response, user.SessionIdCookieName),
		GetCookieValueFromResponse(t, response, jwt.JwtCookieName),
	), NewTestUser(&authenticatedUser)
}

func makeSessionCookie(sessionId, accessToken string) string {
	return fmt.Sprintf(
		"%s=%s; %s=%s",
		user.SessionIdCookieName,
		sessionId,
		jwt.JwtCookieName,
		accessToken,
	)
}
