package user

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"net/url"
	"testing"
	"time"

	"github.com/brianvoe/gofakeit/v7"
	"github.com/h2non/gock"
	"github.com/stretchr/testify/require"
	"github.com/cloudy-clip/api/internal/common/environment"
	"github.com/cloudy-clip/api/internal/common/http/middleware/turnstile"
	"github.com/cloudy-clip/api/internal/user"
	"github.com/cloudy-clip/api/internal/user/dto"
	data "github.com/cloudy-clip/api/test"
	test "github.com/cloudy-clip/api/test/utils"
	"golang.org/x/oauth2/google"
)

func TestGoogleLoginEndpoint(t1 *testing.T) {
	test.Integration(t1, func(testServer *httptest.Server) {
		t1.Run("1. returns correct authorization URL", func(t2 *testing.T) {
			response, responseBody := test.SendGetRequest(
				t2,
				testServer,
				"/api/v1/oauth2/google/url",
				map[string]string{
					turnstile.TurnstileTokenHeader: "turnstile-token",
				},
			)

			require.Equal(t2, 200, response.StatusCode)

			googleAuthUrl, err := url.Parse(responseBody["payload"].(string))
			if err != nil {
				panic(err)
			}

			require.Contains(
				t2,
				googleAuthUrl.String(),
				google.Endpoint.AuthURL,
			)

			require.Equal(
				t2,
				environment.Config.Oauth2GoogleClientId,
				googleAuthUrl.Query().Get("client_id"),
			)

			redirectUri, err := url.PathUnescape(googleAuthUrl.Query().Get("redirect_uri"))
			if err != nil {
				panic(err)
			}
			require.Equal(
				t2,
				fmt.Sprintf("%s/login/oauth2/google", environment.Config.AccessControlAllowOrigin),
				redirectUri,
			)

			scope, err := url.PathUnescape(googleAuthUrl.Query().Get("scope"))
			if err != nil {
				panic(err)
			}
			require.Equal(
				t2,
				"https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile openid",
				scope,
			)

			require.NotEmpty(
				t2,
				googleAuthUrl.Query().Get("state"),
			)

			require.Equal(
				t2,
				googleAuthUrl.Query().Get("state"),
				test.GetCookieValueFromResponse(t2, response, user.Oauth2StateCookieName),
			)
		})

		t1.Run("2. returns 400 when turnstile token header is not present", func(t2 *testing.T) {
			response, responseBody := test.SendGetRequest(
				t2,
				testServer,
				"/api/v1/oauth2/google/url",
				nil,
			)

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

		t1.Run("3. returns 400 when turnstile token header is empty", func(t2 *testing.T) {
			response, responseBody := test.SendGetRequest(
				t2,
				testServer,
				"/api/v1/oauth2/google/url",
				map[string]string{
					turnstile.TurnstileTokenHeader: "",
				},
			)

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

		t1.Run("4. returns 500 when state query param does not match what's in the state cookie", func(t2 *testing.T) {
			response, responseBody := test.SendPostRequest(
				t2,
				testServer,
				"/api/v1/oauth2/google/me/sessions?code=code&state=state",
				nil,
				map[string]string{
					"Cookie": fmt.Sprintf("%s=state-cookie", user.Oauth2StateCookieName),
				},
			)

			require.Equal(t2, http.StatusInternalServerError, response.StatusCode)

			require.Equal(
				t2,
				"failed to log in with google",
				responseBody["message"],
			)
		})

		t1.Run("5. returns 500 when exchanging auth code for access token fails", func(t2 *testing.T) {
			gock.New(google.Endpoint.TokenURL).
				Post("").
				Reply(http.StatusInternalServerError).
				BodyString("")

			response, responseBody := test.SendPostRequest(
				t2,
				testServer,
				"/api/v1/oauth2/google/me/sessions?code=code&state=state",
				nil,
				map[string]string{
					"Cookie": fmt.Sprintf("%s=state", user.Oauth2StateCookieName),
				},
			)

			require.Equal(t2, http.StatusInternalServerError, response.StatusCode)

			require.Equal(
				t2,
				"failed to log in with google",
				responseBody["message"],
			)
		})

		t1.Run("6. log in user and create new user if this is the first login", func(t2 *testing.T) {
			gock.New(google.Endpoint.TokenURL).
				Post("").
				Reply(http.StatusOK).
				SetHeader("Content-Type", "application/x-www-form-urlencoded").
				BodyString(
					fmt.Sprintf(
						"access_token=access-token&token_type=bearer&refresh_token=refresh-token&expires_in=%d",
						time.Now().Add(time.Duration(1)*time.Hour).Unix(),
					),
				)

			userEmail := gofakeit.Email()
			userDisplayName := gofakeit.Name()

			gock.New("https://www.googleapis.com/oauth2/v2/userinfo").
				Reply(http.StatusOK).
				JSON(map[string]any{
					"email":          userEmail,
					"name":           userDisplayName,
					"verified_email": true,
				})

			response, responseBody := test.SendPostRequest(
				t2,
				testServer,
				"/api/v1/oauth2/google/me/sessions?code=code&state=state",
				nil,
				map[string]string{
					"Cookie": fmt.Sprintf("%s=state", user.Oauth2StateCookieName),
				},
			)

			require.Equal(t2, http.StatusOK, response.StatusCode)

			testUserModel := test.GetTestUserModelByEmail(t2, userEmail)

			require.Equal(
				t2,
				userEmail,
				testUserModel.Email,
			)

			require.Subset(
				t2,
				responseBody["payload"],
				map[string]any{
					"email":        userEmail,
					"displayName":  userDisplayName,
					"provider":     "GOOGLE",
					"status":       "ACTIVE",
					"statusReason": "",
				},
			)
		})

		t1.Run("7. should not create new user if this is not the first login", func(t2 *testing.T) {
			userEmail := gofakeit.Email()
			userDisplayName := gofakeit.Name()

			login := func() {
				gock.New(google.Endpoint.TokenURL).
					Post("").
					Reply(http.StatusOK).
					SetHeader("Content-Type", "application/x-www-form-urlencoded").
					BodyString(
						fmt.Sprintf(
							"access_token=access-token&token_type=bearer&refresh_token=refresh-token&expires_in=%d",
							time.Now().Add(time.Duration(1)*time.Hour).Unix(),
						),
					)

				gock.New("https://www.googleapis.com/oauth2/v2/userinfo").
					Reply(http.StatusOK).
					JSON(map[string]any{
						"email":          userEmail,
						"name":           userDisplayName,
						"verified_email": true,
					})

				response, _ := test.SendPostRequest(
					t2,
					testServer,
					"/api/v1/oauth2/google/me/sessions?code=code&state=state",
					nil,
					map[string]string{
						"Cookie": fmt.Sprintf("%s=state", user.Oauth2StateCookieName),
					},
				)

				require.Equal(t2, http.StatusOK, response.StatusCode)
			}

			login()
			testUserModelForFirstLogin := test.GetTestUserModelByEmail(t2, userEmail)

			login()
			testUserModelForSecondLogin := test.GetTestUserModelByEmail(t2, userEmail)

			require.Equal(t2, testUserModelForFirstLogin.Email, testUserModelForSecondLogin.Email)
			require.Equal(t2, testUserModelForFirstLogin.UserID, testUserModelForSecondLogin.UserID)
			require.Equal(t2, testUserModelForFirstLogin.CreatedAt.Unix(), testUserModelForSecondLogin.CreatedAt.Unix())
		})

		t1.Run("8. should set user status to unverified if their google's email is not verified", func(t2 *testing.T) {
			gock.New(google.Endpoint.TokenURL).
				Post("").
				Reply(http.StatusOK).
				SetHeader("Content-Type", "application/x-www-form-urlencoded").
				BodyString(
					fmt.Sprintf(
						"access_token=access-token&token_type=bearer&refresh_token=refresh-token&expires_in=%d",
						time.Now().Add(time.Duration(1)*time.Hour).Unix(),
					),
				)

			userEmail := gofakeit.Email()
			userDisplayName := gofakeit.Name()

			gock.New("https://www.googleapis.com/oauth2/v2/userinfo").
				Reply(http.StatusOK).
				JSON(map[string]any{
					"email":          userEmail,
					"name":           userDisplayName,
					"verified_email": false,
				})

			response, responseBody := test.SendPostRequest(
				t2,
				testServer,
				"/api/v1/oauth2/google/me/sessions?code=code&state=state",
				nil,
				map[string]string{
					"Cookie": fmt.Sprintf("%s=state", user.Oauth2StateCookieName),
				},
			)

			require.Equal(t2, http.StatusOK, response.StatusCode)

			testUserModel := test.GetTestUserModelByEmail(t2, userEmail)

			require.Equal(
				t2,
				userEmail,
				testUserModel.Email,
			)

			require.Subset(
				t2,
				responseBody["payload"],
				map[string]any{
					"email":        userEmail,
					"displayName":  userDisplayName,
					"provider":     "GOOGLE",
					"status":       "UNVERIFIED",
					"statusReason": "",
				},
			)
		})

		t1.Run("9. return 400 if logging in using username and password", func(t2 *testing.T) {
			userEmail := gofakeit.Email()
			userDisplayName := gofakeit.Name()

			gock.New(google.Endpoint.TokenURL).
				Post("").
				Reply(http.StatusOK).
				SetHeader("Content-Type", "application/x-www-form-urlencoded").
				BodyString(
					fmt.Sprintf(
						"access_token=access-token&token_type=bearer&refresh_token=refresh-token&expires_in=%d",
						time.Now().Add(time.Duration(1)*time.Hour).Unix(),
					),
				)

			gock.New("https://www.googleapis.com/oauth2/v2/userinfo").
				Reply(http.StatusOK).
				JSON(map[string]any{
					"email":          userEmail,
					"name":           userDisplayName,
					"verified_email": true,
				})

			response, _ := test.SendPostRequest(
				t2,
				testServer,
				"/api/v1/oauth2/google/me/sessions?code=code&state=state",
				nil,
				map[string]string{
					"Cookie": fmt.Sprintf("%s=state", user.Oauth2StateCookieName),
				},
			)

			require.Equal(t2, http.StatusOK, response.StatusCode)

			loginResponse, loginResponseBody := test.SendPostRequest(
				t2,
				testServer,
				"/api/v1/users/me/sessions",
				&dto.LoginRequestPayload{
					Email:    userEmail,
					Password: data.NewUserPassword,
				},
				map[string]string{
					turnstile.TurnstileTokenHeader: "turnstile-token",
				},
			)

			require.Equal(t2, http.StatusBadRequest, loginResponse.StatusCode)

			loginResponseBodyPayload := loginResponseBody["payload"].(map[string]any)

			require.Equal(
				t2,
				"oauth2 user cannot log in with email and password",
				loginResponseBody["message"],
			)
			require.Equal(t2, "EmailPasswordLoginNotAllowedForOauth2UserException", loginResponseBodyPayload["code"])
			require.Equal(
				t2,
				map[string]any{
					"provider": "GOOGLE",
					"email":    userEmail,
				},
				loginResponseBodyPayload["extra"],
			)
		})

		t1.Run("10. return 400 if user has already logged in with a different oauth2 provider before", func(t2 *testing.T) {
			userEmail := gofakeit.Email()
			userDisplayName := gofakeit.Name()

			gock.New(user.DiscordTokenUrl).
				Post("").
				Reply(http.StatusOK).
				SetHeader("Content-Type", "application/x-www-form-urlencoded").
				BodyString(
					fmt.Sprintf(
						"access_token=access-token&token_type=bearer&refresh_token=refresh-token&expires_in=%d",
						time.Now().Add(time.Duration(1)*time.Hour).Unix(),
					),
				)

			gock.New("https://discord.com").
				Get("/api/v10/users/@me").
				Reply(http.StatusOK).
				JSON(map[string]any{
					"email":       userEmail,
					"global_name": userDisplayName,
				})

			discordLoginResponse, _ := test.SendPostRequest(
				t2,
				testServer,
				"/api/v1/oauth2/discord/me/sessions?code=code&state=state",
				nil,
				map[string]string{
					"Cookie": fmt.Sprintf("%s=state", user.Oauth2StateCookieName),
				},
			)

			require.Equal(t2, http.StatusOK, discordLoginResponse.StatusCode)

			gock.New(google.Endpoint.TokenURL).
				Post("").
				Reply(http.StatusOK).
				SetHeader("Content-Type", "application/x-www-form-urlencoded").
				BodyString(
					fmt.Sprintf(
						"access_token=access-token&token_type=bearer&refresh_token=refresh-token&expires_in=%d",
						time.Now().Add(time.Duration(1)*time.Hour).Unix(),
					),
				)

			gock.New("https://www.googleapis.com/oauth2/v2/userinfo").
				Reply(http.StatusOK).
				JSON(map[string]any{
					"email":          userEmail,
					"name":           userDisplayName,
					"verified_email": true,
				})

			googleLoginResponse, googleLoginResponseBody := test.SendPostRequest(
				t2,
				testServer,
				"/api/v1/oauth2/google/me/sessions?code=code&state=state",
				nil,
				map[string]string{
					"Cookie": fmt.Sprintf("%s=state", user.Oauth2StateCookieName),
				},
			)

			require.Equal(t2, http.StatusBadRequest, googleLoginResponse.StatusCode)

			googleLoginResponseBodyPayload := googleLoginResponseBody["payload"].(map[string]any)

			require.Equal(
				t2,
				"oauth2 login is not allowed",
				googleLoginResponseBody["message"],
			)
			require.Equal(t2, "Oauth2LoginNotAllowedException", googleLoginResponseBodyPayload["code"])
			require.Equal(
				t2,
				map[string]any{
					"provider": "DISCORD",
					"email":    userEmail,
				},
				googleLoginResponseBodyPayload["extra"],
			)
		})
	})
}
