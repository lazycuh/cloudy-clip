package user

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"regexp"
	"strings"
	"testing"

	"github.com/brianvoe/gofakeit/v7"
	"github.com/h2non/gock"
	"github.com/stretchr/testify/require"
	"github.com/cloudy-clip/api/internal/common/environment"
	"github.com/cloudy-clip/api/internal/common/exception"
	"github.com/cloudy-clip/api/internal/common/http/middleware/turnstile"
	"github.com/cloudy-clip/api/internal/common/jwt"
	"github.com/cloudy-clip/api/internal/user/dto"
	data "github.com/cloudy-clip/api/test"

	test "github.com/cloudy-clip/api/test/utils"
)

func TestPartialUserUpdateEndpoint(t1 *testing.T) {
	test.Integration(t1, func(testServer *httptest.Server) {
		const userUpdateEndpoint = "/api/v1/users/me"

		updateUser := func(
			t2 *testing.T,
			requestPayload *dto.PatchUserRequestPayload,
			sessionCookie string,
		) (*http.Response, map[string]any) {
			return test.SendPatchRequest(
				t2,
				testServer,
				userUpdateEndpoint,
				requestPayload,
				map[string]string{
					turnstile.TurnstileTokenHeader: "turnstile-token",
					"Cookie":                       sessionCookie,
				},
			)
		}

		t1.Run("1. can update email", func(t2 *testing.T) {
			sessionCookie, testUser := test.CreateAndLoginUser(t1, testServer)

			testUserModelBefore := test.GetTestUserModelByEmail(t2, testUser.Email)

			require.Equal(t2, testUser.Email, testUserModelBefore.Email)

			newEmail := gofakeit.Email()

			gock.New("https://api.resend.com").
				Post("/emails").
				AddMatcher(test.CreateRequestBodyMatcherFunc(func(requestBody map[string]any) {
					require.Equal(t2, []any{testUserModelBefore.Email}, requestBody["to"])
					require.Equal(t2, "Your account was updated", requestBody["subject"])
					require.Equal(t2, "Cloudy Clip <security-alerts@cloudyclip.com>", requestBody["from"])
					require.Empty(t2, requestBody["text"])

					htmlBody := requestBody["html"]
					require.NotContains(t2, "{{.HostName}}", htmlBody)
					require.Contains(
						t2,
						htmlBody,
						environment.Config.AccessControlAllowOrigin+"/images/cloudy-clip-bg-transparent.png",
					)
					require.Contains(t2, htmlBody, "Hi "+testUserModelBefore.DisplayName+",")
					require.Regexp(
						t2,
						regexp.MustCompile(`.*This email confirms that your Cloudy Clip account has\s+been successfully updated\.`),
						htmlBody,
					)
					require.Contains(t2, htmlBody, "The following information was updated on your account:")
					require.NotContains(t2, htmlBody, "<strong>Display name</strong>:")
					require.Contains(t2, htmlBody, "<strong>Email</strong>:")
					require.Contains(t2, htmlBody, "<em>"+testUserModelBefore.Email+"</em>")
					require.Contains(t2, htmlBody, "was changed to")
					require.Contains(t2, htmlBody, "<em>"+newEmail+"</em>")
					require.NotContains(t2, htmlBody, "<strong>Password</strong>")
					require.Contains(t2, htmlBody, "The Cloudy Clip Team")
					require.Contains(t2, htmlBody, "If you did not authorize this change, please report it")
					require.Contains(t2, htmlBody, "immediately by clicking the following link:")
					require.Contains(
						t2,
						htmlBody,
						`href="mailto:heretohelp@cloudyclip.com?subject=%5BTrade%20Timeline%5D%20Suspicious%20activity%20on%20my%20account&body=Account%20email:%20`+testUserModelBefore.Email+`%0A%0AMy%20account%20info%20was%20updated%20without%20my%20authorization.%20Please%20investigate%20this%20matter%20and%20take%20appropriate%20action.%0A%0A"`,
					)
					require.Contains(t2, htmlBody, "Report suspicious activity")
					require.Contains(t2, htmlBody, "The Cloudy Clip Team")
					require.Contains(t2, htmlBody, "Terms of Service")
					require.Contains(
						t2,
						htmlBody,
						environment.Config.AccessControlAllowOrigin+"/policies/terms-of-service",
					)
					require.Contains(t2, htmlBody, "Privacy Policy")
					require.Contains(t2, htmlBody, "|")
					require.Contains(
						t2,
						htmlBody,
						environment.Config.AccessControlAllowOrigin+"/policies/privacy-policy",
					)
				})).
				Reply(http.StatusOK).
				JSON(map[string]any{})

			gock.New("https://api.resend.com").
				Post("/emails").
				AddMatcher(test.CreateRequestBodyMatcherFunc(func(requestBody map[string]any) {
					require.Equal(t2, []any{newEmail}, requestBody["to"])
					require.Equal(t2, "Account update confirmation", requestBody["subject"])
					require.Equal(t2, "Cloudy Clip <security-alerts@cloudyclip.com>", requestBody["from"])
					require.Empty(t2, requestBody["text"])

					htmlBody := requestBody["html"]
					require.NotContains(t2, "{{.HostName}}", htmlBody)
					require.Contains(
						t2,
						htmlBody,
						environment.Config.AccessControlAllowOrigin+"/images/cloudy-clip-bg-transparent.png",
					)
					require.Contains(t2, htmlBody, "Hi "+testUserModelBefore.DisplayName+",")
					require.Regexp(
						t2,
						regexp.MustCompile(`.*This email confirms that your Cloudy Clip account has\s+been successfully updated\..*`),
						htmlBody,
					)
					require.Contains(t2, htmlBody, "The following information was updated on your account:")
					require.NotContains(t2, htmlBody, "<strong>Display name</strong>:")
					require.Contains(t2, htmlBody, "<strong>Email</strong>:")
					require.Contains(t2, htmlBody, "<em>"+testUserModelBefore.Email+"</em>")
					require.Contains(t2, htmlBody, "was changed to")
					require.Contains(t2, htmlBody, "<em>"+newEmail+"</em>")
					require.NotContains(t2, htmlBody, "<strong>Password</strong>")
					require.Contains(t2, htmlBody, "The Cloudy Clip Team")
					require.Contains(t2, htmlBody, "If you did not authorize this change, please report it")
					require.Contains(t2, htmlBody, "immediately by clicking the following link:")
					require.Contains(
						t2,
						htmlBody,
						`href="mailto:heretohelp@cloudyclip.com?subject=%5BTrade%20Timeline%5D%20Unauthorized%20usage%20of%20email&body=My%20email%20address%20is%20`+newEmail+`.%0A%0AI%20don't%20have%20an%20account%20with%20Trade%20Timeline,%20someone%20is%20trying%20to%20use%20my%20email%20for%20an%20account%20on%20your%20site%20without%20my%20authorization.%20Please%20investigate%20this%20matter%20and%20take%20appropriate%20action.%0A%0A"`,
					)
					require.Contains(t2, htmlBody, "Report suspicious activity")
					require.Contains(t2, htmlBody, "The Cloudy Clip Team")
					require.Contains(t2, htmlBody, "Terms of Service")
					require.Contains(
						t2,
						htmlBody,
						environment.Config.AccessControlAllowOrigin+"/policies/terms-of-service",
					)
					require.Contains(t2, htmlBody, "Privacy Policy")
					require.Contains(t2, htmlBody, "|")
					require.Contains(
						t2,
						htmlBody,
						environment.Config.AccessControlAllowOrigin+"/policies/privacy-policy",
					)
				})).
				Reply(http.StatusOK).
				JSON(map[string]any{})

			response, _ := updateUser(
				t2,
				&dto.PatchUserRequestPayload{
					Email:           newEmail,
					CurrentPassword: data.NewUserPassword,
				},
				sessionCookie,
			)

			testUserModelAfter := test.GetTestUserModelByEmail(t2, newEmail)

			require.Equal(t2, http.StatusNoContent, response.StatusCode)
			require.NotEqual(t2, testUserModelBefore.Email, testUserModelAfter.Email)
		})

		t1.Run("2. can update password and log in with new password", func(t2 *testing.T) {
			sessionCookie, testUser := test.CreateAndLoginUser(t1, testServer)

			testUserModelBefore := test.GetTestUserModelByEmail(t2, testUser.Email)

			gock.New("https://api.resend.com").
				Post("/emails").
				AddMatcher(test.CreateRequestBodyMatcherFunc(func(requestBody map[string]any) {
					require.Equal(t2, []any{testUserModelBefore.Email}, requestBody["to"])
					require.Equal(t2, "Your account was updated", requestBody["subject"])
					require.Equal(t2, "Cloudy Clip <security-alerts@cloudyclip.com>", requestBody["from"])
					require.Empty(t2, requestBody["text"])

					htmlBody := requestBody["html"]
					require.NotContains(t2, "{{.HostName}}", htmlBody)
					require.Contains(
						t2,
						htmlBody,
						environment.Config.AccessControlAllowOrigin+"/images/cloudy-clip-bg-transparent.png",
					)
					require.Contains(t2, htmlBody, "Hi "+testUserModelBefore.DisplayName+",")
					require.Regexp(
						t2,
						regexp.MustCompile(`.*This email confirms that your Cloudy Clip account has\s+been successfully updated\..*`),
						htmlBody,
					)
					require.Contains(t2, htmlBody, "The following information was updated on your account:")
					require.NotContains(t2, htmlBody, "<strong>Display name</strong>:")
					require.NotContains(t2, htmlBody, "<strong>Email</strong>:")
					require.Contains(t2, htmlBody, "<strong>Password</strong>")
					require.Contains(t2, htmlBody, "The Cloudy Clip Team")
					require.Contains(t2, htmlBody, "If you did not authorize this change, please report it")
					require.Contains(t2, htmlBody, "immediately by clicking the following link:")
					require.Contains(
						t2,
						htmlBody,
						`href="mailto:heretohelp@cloudyclip.com?subject=%5BTrade%20Timeline%5D%20Suspicious%20activity%20on%20my%20account&body=Account%20email:%20`+testUserModelBefore.Email+`%0A%0AMy%20account%20info%20was%20updated%20without%20my%20authorization.%20Please%20investigate%20this%20matter%20and%20take%20appropriate%20action.%0A%0A"`,
					)
					require.Contains(t2, htmlBody, "Report suspicious activity")
					require.Contains(t2, htmlBody, "The Cloudy Clip Team")
					require.Contains(t2, htmlBody, "Terms of Service")
					require.Contains(
						t2,
						htmlBody,
						environment.Config.AccessControlAllowOrigin+"/policies/terms-of-service",
					)
					require.Contains(t2, htmlBody, "Privacy Policy")
					require.Contains(t2, htmlBody, "|")
					require.Contains(
						t2,
						htmlBody,
						environment.Config.AccessControlAllowOrigin+"/policies/privacy-policy",
					)
				})).
				Reply(http.StatusOK).
				JSON(map[string]any{})

			newPassword := "NewPassword1111"
			response, _ := updateUser(
				t2,
				&dto.PatchUserRequestPayload{
					NewPassword:     newPassword,
					CurrentPassword: data.NewUserPassword,
				},
				sessionCookie,
			)
			require.Equal(t2, http.StatusNoContent, response.StatusCode)

			testUserModelAfter := test.GetTestUserModelByEmail(t2, testUser.Email)
			require.NotEqual(t2, testUserModelBefore.Password, testUserModelAfter.Password)
			require.NotEqual(t2, newPassword, testUserModelAfter.Password)
			require.Equal(t2, testUserModelBefore.Salt, testUserModelAfter.Salt)

			login := func(email string, password string) *http.Response {
				response, _ := test.SendPostRequest(
					t2,
					testServer,
					"/api/v1/users/me/sessions",
					&dto.LoginRequestPayload{
						Email:    email,
						Password: password,
					},
					map[string]string{
						turnstile.TurnstileTokenHeader: "turnstile-token",
					},
				)

				return response
			}

			response1 := login(testUser.Email, data.NewUserPassword)
			require.Equal(t2, http.StatusUnauthorized, response1.StatusCode)

			response2 := login(testUser.Email, newPassword)
			require.Equal(t2, http.StatusOK, response2.StatusCode)
		})

		t1.Run("3. can update display name", func(t2 *testing.T) {
			sessionCookie, testUser := test.CreateAndLoginUser(t1, testServer)

			testUserModelBefore := test.GetTestUserModelByEmail(t2, testUser.Email)

			require.Equal(t2, testUser.DisplayName, testUserModelBefore.DisplayName)

			gock.New("https://api.resend.com").
				Post("/emails").
				AddMatcher(test.CreateRequestBodyMatcherFunc(func(requestBody map[string]any) {
					require.Equal(t2, []any{testUserModelBefore.Email}, requestBody["to"])
					require.Equal(t2, "Your account was updated", requestBody["subject"])
					require.Equal(t2, "Cloudy Clip <security-alerts@cloudyclip.com>", requestBody["from"])
					require.Empty(t2, requestBody["text"])

					htmlBody := requestBody["html"]
					require.NotContains(t2, "{{.HostName}}", htmlBody)
					require.Contains(
						t2,
						htmlBody,
						environment.Config.AccessControlAllowOrigin+"/images/cloudy-clip-bg-transparent.png",
					)
					require.Contains(t2, htmlBody, "Hi "+testUserModelBefore.DisplayName+",")
					require.Regexp(
						t2,
						regexp.MustCompile(`.*This email confirms that your Cloudy Clip account has\s+been successfully updated\..*`),
						htmlBody,
					)
					require.Contains(t2, htmlBody, "The following information was updated on your account:")
					require.Contains(t2, htmlBody, "<strong>Display name</strong>:")
					require.Contains(t2, htmlBody, "<em>"+testUserModelBefore.DisplayName+"</em>")
					require.Contains(t2, htmlBody, "was changed to")
					require.Contains(t2, htmlBody, "<em>Lazy Cuh</em>")
					require.NotContains(t2, htmlBody, "<strong>Email</strong>:")
					require.NotContains(t2, htmlBody, "<strong>Password</strong>")
					require.Contains(t2, htmlBody, "The Cloudy Clip Team")
					require.Contains(t2, htmlBody, "If you did not authorize this change, please report it")
					require.Contains(t2, htmlBody, "immediately by clicking the following link:")
					require.Contains(
						t2,
						htmlBody,
						`href="mailto:heretohelp@cloudyclip.com?subject=%5BTrade%20Timeline%5D%20Suspicious%20activity%20on%20my%20account&body=Account%20email:%20`+testUserModelBefore.Email+`%0A%0AMy%20account%20info%20was%20updated%20without%20my%20authorization.%20Please%20investigate%20this%20matter%20and%20take%20appropriate%20action.%0A%0A"`,
					)
					require.Contains(t2, htmlBody, "Report suspicious activity")
					require.Contains(t2, htmlBody, "The Cloudy Clip Team")
					require.Contains(t2, htmlBody, "Terms of Service")
					require.Contains(
						t2,
						htmlBody,
						environment.Config.AccessControlAllowOrigin+"/policies/terms-of-service",
					)
					require.Contains(t2, htmlBody, "Privacy Policy")
					require.Contains(t2, htmlBody, "|")
					require.Contains(
						t2,
						htmlBody,
						environment.Config.AccessControlAllowOrigin+"/policies/privacy-policy",
					)
				})).
				Reply(http.StatusOK).
				JSON(map[string]any{})

			response, _ := updateUser(
				t2,
				&dto.PatchUserRequestPayload{
					DisplayName:     "Lazy Cuh",
					CurrentPassword: data.NewUserPassword,
				},
				sessionCookie,
			)
			require.Equal(t2, http.StatusNoContent, response.StatusCode)

			testUserModelAfter := test.GetTestUserModelByEmail(t2, testUser.Email)
			require.NotEqual(t2, testUserModelBefore.DisplayName, testUserModelAfter.DisplayName)
		})

		t1.Run("4. returns 204 when no change is provided", func(t2 *testing.T) {
			sessionCookie, testUser := test.CreateAndLoginUser(t1, testServer)

			testUserModelBefore := test.GetTestUserModelByEmail(t2, testUser.Email)

			require.Equal(t2, testUser.DisplayName, testUserModelBefore.DisplayName)

			response, _ := updateUser(
				t2,
				&dto.PatchUserRequestPayload{
					CurrentPassword: data.NewUserPassword,
				},
				sessionCookie,
			)
			require.Equal(t2, http.StatusNoContent, response.StatusCode)

			testUserModelAfter := test.GetTestUserModelByEmail(t2, testUser.Email)

			require.Equal(t2, testUserModelBefore.Email, testUserModelAfter.Email)
			require.Equal(t2, testUserModelBefore.DisplayName, testUserModelAfter.DisplayName)
			require.Equal(t2, testUserModelBefore.Password, testUserModelAfter.Password)
		})

		t1.Run("5. returns 400 when current password is not correct", func(t2 *testing.T) {
			sessionCookie, testUser := test.CreateAndLoginUser(t1, testServer)

			testUserModelBefore := test.GetTestUserModelByEmail(t2, testUser.Email)

			require.Equal(t2, testUser.Email, testUserModelBefore.Email)

			response, responseBody := updateUser(
				t2,
				&dto.PatchUserRequestPayload{
					Email:           gofakeit.Email(),
					CurrentPassword: "WrongPassword",
				},
				sessionCookie,
			)
			require.Equal(t2, http.StatusBadRequest, response.StatusCode)

			testUserModelAfter := test.GetTestUserModelByEmail(t2, testUser.Email)
			require.Equal(t2, testUserModelBefore.Email, testUserModelAfter.Email)
			require.Equal(t2, "current password was not correct", responseBody["message"])
		})

		t1.Run("6. returns 400 when email is of invalid format", func(t2 *testing.T) {
			sessionCookie, _ := test.CreateAndLoginUser(t1, testServer)

			response, responseBody := updateUser(
				t2,
				&dto.PatchUserRequestPayload{
					Email:           "hello.world",
					CurrentPassword: data.NewUserPassword,
				},
				sessionCookie,
			)

			require.Equal(t2, http.StatusBadRequest, response.StatusCode)

			require.Equal(
				t2,
				exception.DefaultValidationExceptionMessage,
				responseBody["message"],
			)

			require.Subset(
				t2,
				responseBody["payload"],
				map[string]any{
					"code": "ValidationException",
					"extra": map[string]any{
						"email": "invalid email",
					},
				},
			)
		})

		t1.Run("7. returns 400 when email has more than 64 characters", func(t2 *testing.T) {
			sessionCookie, _ := test.CreateAndLoginUser(t1, testServer)

			response, responseBody := updateUser(
				t2,
				&dto.PatchUserRequestPayload{
					Email:           fmt.Sprintf("%s@gmail.com", strings.Repeat("a", 64)),
					CurrentPassword: data.NewUserPassword,
				},
				sessionCookie,
			)

			require.Equal(t2, http.StatusBadRequest, response.StatusCode)

			require.Equal(
				t2,
				exception.DefaultValidationExceptionMessage,
				responseBody["message"],
			)

			require.Subset(
				t2,
				responseBody["payload"],
				map[string]any{
					"code": "ValidationException",
					"extra": map[string]any{
						"email": "must contain at most 64 characters",
					},
				},
			)
		})

		t1.Run("8. returns 400 when displayName has more than 32 characters", func(t2 *testing.T) {
			sessionCookie, _ := test.CreateAndLoginUser(t1, testServer)

			response, responseBody := updateUser(
				t2,
				&dto.PatchUserRequestPayload{
					DisplayName:     strings.Repeat("a", 33),
					CurrentPassword: data.NewUserPassword,
				},
				sessionCookie,
			)

			require.Equal(t2, http.StatusBadRequest, response.StatusCode)

			require.Equal(
				t2,
				exception.DefaultValidationExceptionMessage,
				responseBody["message"],
			)

			require.Subset(
				t2,
				responseBody["payload"],
				map[string]any{
					"code": "ValidationException",
					"extra": map[string]any{
						"displayName": "must contain at most 32 characters",
					},
				},
			)
		})

		t1.Run("10. returns 400 when new password has more than 64 characters", func(t2 *testing.T) {
			sessionCookie, _ := test.CreateAndLoginUser(t1, testServer)

			response, responseBody := updateUser(
				t2,
				&dto.PatchUserRequestPayload{
					NewPassword:     "NewPassword2024" + strings.Repeat("a", 64-15+1),
					CurrentPassword: data.NewUserPassword,
				},
				sessionCookie,
			)

			require.Equal(t2, http.StatusBadRequest, response.StatusCode)

			require.Equal(
				t2,
				exception.DefaultValidationExceptionMessage,
				responseBody["message"],
			)

			require.Subset(
				t2,
				responseBody["payload"],
				map[string]any{
					"code": "ValidationException",
					"extra": map[string]any{
						"newPassword": "must contain at most 64 characters",
					},
				},
			)
		})

		t1.Run("11. returns 400 when new password has fewer than 8 characters", func(t2 *testing.T) {
			sessionCookie, _ := test.CreateAndLoginUser(t1, testServer)

			response, responseBody := updateUser(
				t2,
				&dto.PatchUserRequestPayload{
					NewPassword:     "Aa1",
					CurrentPassword: data.NewUserPassword,
				},
				sessionCookie,
			)

			require.Equal(t2, http.StatusBadRequest, response.StatusCode)

			require.Equal(
				t2,
				exception.DefaultValidationExceptionMessage,
				responseBody["message"],
			)

			require.Subset(
				t2,
				responseBody["payload"],
				map[string]any{
					"code": "ValidationException",
					"extra": map[string]any{
						"newPassword": "must contain at least 8 characters",
					},
				},
			)
		})

		t1.Run("12. returns 400 when new password does not contain mixed case", func(t2 *testing.T) {
			sessionCookie, _ := test.CreateAndLoginUser(t1, testServer)

			response, responseBody := updateUser(
				t2,
				&dto.PatchUserRequestPayload{
					NewPassword:     "hello.world.2024",
					CurrentPassword: data.NewUserPassword,
				},
				sessionCookie,
			)

			require.Equal(t2, http.StatusBadRequest, response.StatusCode)

			require.Equal(
				t2,
				exception.DefaultValidationExceptionMessage,
				responseBody["message"],
			)

			require.Subset(
				t2,
				responseBody["payload"],
				map[string]any{
					"code": "ValidationException",
					"extra": map[string]any{
						"newPassword": "must contain uppercase and lowercase characters",
					},
				},
			)
		})

		t1.Run("13. returns 400 when new password does not contain at least one number", func(t2 *testing.T) {
			sessionCookie, _ := test.CreateAndLoginUser(t1, testServer)

			response, responseBody := updateUser(
				t2,
				&dto.PatchUserRequestPayload{
					NewPassword:     "HelloWorld",
					CurrentPassword: data.NewUserPassword,
				},
				sessionCookie,
			)

			require.Equal(t2, http.StatusBadRequest, response.StatusCode)

			require.Equal(
				t2,
				exception.DefaultValidationExceptionMessage,
				responseBody["message"],
			)

			require.Subset(
				t2,
				responseBody["payload"],
				map[string]any{
					"code": "ValidationException",
					"extra": map[string]any{
						"newPassword": "must contain at least one number",
					},
				},
			)
		})

		t1.Run("14. returns 400 when turnstile token header is not present", func(t2 *testing.T) {
			sessionCookie, _ := test.CreateAndLoginUser(t1, testServer)

			response, responseBody := test.SendPatchRequest(
				t2,
				testServer,
				userUpdateEndpoint,
				&dto.PatchUserRequestPayload{
					NewPassword:     "HelloWorld",
					CurrentPassword: data.NewUserPassword,
				},
				map[string]string{
					"Cookie": fmt.Sprintf(
						"%s=%s",
						jwt.JwtCookieName,
						sessionCookie,
					),
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

		t1.Run("15. returns 400 when turnstile token header is empty", func(t2 *testing.T) {
			sessionCookie, _ := test.CreateAndLoginUser(t1, testServer)

			response, responseBody := test.SendPatchRequest(
				t2,
				testServer,
				userUpdateEndpoint,
				&dto.PatchUserRequestPayload{
					NewPassword:     "HelloWorld",
					CurrentPassword: data.NewUserPassword,
				},
				map[string]string{
					turnstile.TurnstileTokenHeader: "",
					"Cookie": fmt.Sprintf(
						"%s=%s",
						jwt.JwtCookieName,
						sessionCookie,
					),
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

		t1.Run("16. returns 401 when jwt cookie is missing", func(t2 *testing.T) {
			response, responseBody := test.SendPatchRequest(
				t2,
				testServer,
				userUpdateEndpoint,
				&dto.PatchUserRequestPayload{
					NewPassword:     "HelloWorld",
					CurrentPassword: data.NewUserPassword,
				},
				map[string]string{
					turnstile.TurnstileTokenHeader: "turnstile-token",
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

		t1.Run("17. returns 401 when jwt cookie is invalid", func(t2 *testing.T) {
			response, responseBody := test.SendPatchRequest(
				t2,
				testServer,
				userUpdateEndpoint,
				&dto.PatchUserRequestPayload{
					NewPassword:     "HelloWorld",
					CurrentPassword: data.NewUserPassword,
				},
				map[string]string{
					turnstile.TurnstileTokenHeader: "turnstile-token",
					"Cookie": fmt.Sprintf(
						"%s=%s",
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

		t1.Run("18. can update every field together", func(t2 *testing.T) {
			sessionCookie, testUser := test.CreateAndLoginUser(t1, testServer)

			testUserModelBefore := test.GetTestUserModelByEmail(t2, testUser.Email)

			require.Equal(t2, testUser.Email, testUserModelBefore.Email)

			newEmail := gofakeit.Email()
			newDisplayName := gofakeit.Name()

			gock.New("https://api.resend.com").
				Post("/emails").
				AddMatcher(test.CreateRequestBodyMatcherFunc(func(requestBody map[string]any) {
					require.Equal(t2, []any{testUserModelBefore.Email}, requestBody["to"])
					require.Equal(t2, "Your account was updated", requestBody["subject"])
					require.Equal(t2, "Cloudy Clip <security-alerts@cloudyclip.com>", requestBody["from"])
					require.Empty(t2, requestBody["text"])

					htmlBody := requestBody["html"]
					require.NotContains(t2, "{{.HostName}}", htmlBody)
					require.Contains(
						t2,
						htmlBody,
						environment.Config.AccessControlAllowOrigin+"/images/cloudy-clip-bg-transparent.png",
					)
					require.Contains(t2, htmlBody, "Hi "+testUserModelBefore.DisplayName+",")
					require.Regexp(
						t2,
						regexp.MustCompile(`.*This email confirms that your Cloudy Clip account has\s+been successfully updated\..*`),
						htmlBody,
					)
					require.Contains(t2, htmlBody, "The following information was updated on your account:")
					require.Contains(t2, htmlBody, "<strong>Display name</strong>:")
					require.Contains(t2, htmlBody, "<em>"+testUserModelBefore.DisplayName+"</em>")
					require.Contains(t2, htmlBody, "was changed to")
					require.Contains(t2, htmlBody, "<em>"+newDisplayName+"</em>")
					require.Contains(t2, htmlBody, "<strong>Email</strong>:")
					require.Contains(t2, htmlBody, "<em>"+testUserModelBefore.Email+"</em>")
					require.Contains(t2, htmlBody, "was changed to")
					require.Contains(t2, htmlBody, "<em>"+newEmail+"</em>")
					require.Contains(t2, htmlBody, "<strong>Password</strong>")
					require.Contains(t2, htmlBody, "The Cloudy Clip Team")
					require.Contains(t2, htmlBody, "If you did not authorize this change, please report it")
					require.Contains(t2, htmlBody, "immediately by clicking the following link:")
					require.Contains(
						t2,
						htmlBody,
						`href="mailto:heretohelp@cloudyclip.com?subject=%5BTrade%20Timeline%5D%20Suspicious%20activity%20on%20my%20account&body=Account%20email:%20`+testUserModelBefore.Email+`%0A%0AMy%20account%20info%20was%20updated%20without%20my%20authorization.%20Please%20investigate%20this%20matter%20and%20take%20appropriate%20action.%0A%0A"`,
					)
					require.Contains(t2, htmlBody, "Report suspicious activity")
					require.Contains(t2, htmlBody, "The Cloudy Clip Team")
					require.Contains(t2, htmlBody, "Terms of Service")
					require.Contains(
						t2,
						htmlBody,
						environment.Config.AccessControlAllowOrigin+"/policies/terms-of-service",
					)
					require.Contains(t2, htmlBody, "Privacy Policy")
					require.Contains(t2, htmlBody, "|")
					require.Contains(
						t2,
						htmlBody,
						environment.Config.AccessControlAllowOrigin+"/policies/privacy-policy",
					)
				})).
				Reply(http.StatusOK).
				JSON(map[string]any{})

			gock.New("https://api.resend.com").
				Post("/emails").
				AddMatcher(test.CreateRequestBodyMatcherFunc(func(requestBody map[string]any) {
					require.Equal(t2, []any{newEmail}, requestBody["to"])
					require.Equal(t2, "Account update confirmation", requestBody["subject"])
					require.Equal(t2, "Cloudy Clip <security-alerts@cloudyclip.com>", requestBody["from"])
					require.Empty(t2, requestBody["text"])

					htmlBody := requestBody["html"]
					require.NotContains(t2, "{{.HostName}}", htmlBody)
					require.Contains(
						t2,
						htmlBody,
						environment.Config.AccessControlAllowOrigin+"/images/cloudy-clip-bg-transparent.png",
					)
					require.Contains(t2, htmlBody, "Hi "+newDisplayName+",")
					require.Regexp(
						t2,
						regexp.MustCompile(`.*This email confirms that your Cloudy Clip account has\s+been successfully updated\..*`),
						htmlBody,
					)
					require.Contains(t2, htmlBody, "The following information was updated on your account:")
					require.Contains(t2, htmlBody, "<strong>Display name</strong>:")
					require.Contains(t2, htmlBody, "<em>"+testUserModelBefore.DisplayName+"</em>")
					require.Contains(t2, htmlBody, "was changed to")
					require.Contains(t2, htmlBody, "<em>"+newDisplayName+"</em>")
					require.Contains(t2, htmlBody, "<strong>Email</strong>:")
					require.Contains(t2, htmlBody, "<em>"+testUserModelBefore.Email+"</em>")
					require.Contains(t2, htmlBody, "was changed to")
					require.Contains(t2, htmlBody, "<em>"+newEmail+"</em>")
					require.Contains(t2, htmlBody, "<strong>Password</strong>")
					require.Contains(t2, htmlBody, "The Cloudy Clip Team")
					require.Contains(t2, htmlBody, "If you did not authorize this change, please report it")
					require.Contains(t2, htmlBody, "immediately by clicking the following link:")
					require.Contains(
						t2,
						htmlBody,
						`href="mailto:heretohelp@cloudyclip.com?subject=%5BTrade%20Timeline%5D%20Unauthorized%20usage%20of%20email&body=My%20email%20address%20is%20`+newEmail+`.%0A%0AI%20don't%20have%20an%20account%20with%20Trade%20Timeline,%20someone%20is%20trying%20to%20use%20my%20email%20for%20an%20account%20on%20your%20site%20without%20my%20authorization.%20Please%20investigate%20this%20matter%20and%20take%20appropriate%20action.%0A%0A"`,
					)
					require.Contains(t2, htmlBody, "Report suspicious activity")
					require.Contains(t2, htmlBody, "The Cloudy Clip Team")
					require.Contains(t2, htmlBody, "Terms of Service")
					require.Contains(
						t2,
						htmlBody,
						environment.Config.AccessControlAllowOrigin+"/policies/terms-of-service",
					)
					require.Contains(t2, htmlBody, "Privacy Policy")
					require.Contains(t2, htmlBody, "|")
					require.Contains(
						t2,
						htmlBody,
						environment.Config.AccessControlAllowOrigin+"/policies/privacy-policy",
					)
				})).
				Reply(http.StatusOK).
				JSON(map[string]any{})

			const newPassword = "NewPassword2025"

			response, _ := updateUser(
				t2,
				&dto.PatchUserRequestPayload{
					Email:           newEmail,
					DisplayName:     newDisplayName,
					NewPassword:     newPassword,
					CurrentPassword: data.NewUserPassword,
				},
				sessionCookie,
			)

			testUserModelAfter := test.GetTestUserModelByEmail(t2, newEmail)

			require.Equal(t2, http.StatusNoContent, response.StatusCode)
			require.NotEqual(t2, testUserModelBefore.Email, testUserModelAfter.Email)
			require.NotEqual(t2, testUserModelBefore.DisplayName, testUserModelAfter.DisplayName)
			require.NotEqual(t2, testUserModelBefore.Password, testUserModelAfter.Password)
			require.NotEqual(t2, newPassword, testUserModelAfter.Password)
			require.Equal(t2, testUserModelBefore.Salt, testUserModelAfter.Salt)
		})

	})
}
