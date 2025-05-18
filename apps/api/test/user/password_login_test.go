package user

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"regexp"
	"strings"
	"testing"
	"time"

	"github.com/brianvoe/gofakeit/v7"
	"github.com/h2non/gock"
	"github.com/stretchr/testify/require"
	"github.com/cloudy-clip/api/internal/common/environment"
	"github.com/cloudy-clip/api/internal/common/exception"
	"github.com/cloudy-clip/api/internal/common/http/middleware/turnstile"
	"github.com/cloudy-clip/api/internal/user"
	"github.com/cloudy-clip/api/internal/user/dto"
	"github.com/cloudy-clip/api/internal/user/model"
	data "github.com/cloudy-clip/api/test"

	test "github.com/cloudy-clip/api/test/utils"
)

func TestPasswordLoginEndpoint(t1 *testing.T) {
	test.Integration(t1, func(testServer *httptest.Server) {
		const endpointToTest = "/api/v1/users/me/sessions"

		sendRequestToEndpointBeingTested := func(
			t2 *testing.T,
			requestPayload *dto.LoginRequestPayload,
		) (*http.Response, map[string]any) {
			return test.SendPostRequest(
				t2,
				testServer,
				endpointToTest,
				requestPayload,
				map[string]string{
					turnstile.TurnstileTokenHeader: "turnstile-token",
				},
			)
		}

		t1.Run("1. can log in and return authenticated user info", func(t2 *testing.T) {
			_, testUser := test.CreateAndLoginUser(t2, testServer)

			testUserModel := test.GetTestUserModelByEmail(t2, testUser.Email)

			testUserModel.Status = model.UserStatusActive
			testUserModel.StatusReason = model.UserStatusReasonNone

			test.UpdateTestUser(t2, testUserModel)

			response, responseBody := sendRequestToEndpointBeingTested(
				t2,
				&dto.LoginRequestPayload{
					Email:    testUser.Email,
					Password: data.NewUserPassword,
				},
			)

			require.Equal(t2, http.StatusOK, response.StatusCode)

			payload := responseBody["payload"].(map[string]any)

			require.Subset(
				t2,
				payload,
				map[string]any{
					"displayName":  testUser.DisplayName,
					"email":        testUser.Email,
					"provider":     "",
					"status":       "ACTIVE",
					"statusReason": "",
				},
			)

			_, err := time.Parse(time.RFC3339, payload["createdAt"].(string))
			require.NoError(
				t2,
				err,
				fmt.Sprintf("createdAt is not of valid format, it was %v", payload["createdAt"].(string)),
			)

			_, err = time.Parse(time.RFC3339, payload["lastLoggedInAt"].(string))
			require.NoError(
				t2,
				err,
				fmt.Sprintf("lastLoggedInAt is not of valid format, it was %v", payload["lastLoggedInAt"].(string)),
			)

			_, err = time.Parse(time.RFC3339, payload["updatedAt"].(string))
			require.NoError(
				t2,
				err,
				fmt.Sprintf("updatedAt is not of valid format, it was %v", payload["updatedAt"].(string)),
			)

			require.Nil(t2, payload["userId"], "userId is not nil")
			require.Nil(t2, payload["password"], "password is not nil")
			require.Nil(t2, payload["salt"], "salt is not nil")
		})

		t1.Run("2. returns 400 when email is missing or empty", func(t2 *testing.T) {
			response, responseBody := sendRequestToEndpointBeingTested(
				t2,
				&dto.LoginRequestPayload{
					Password: "NotNeeded2024",
				},
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
						"email": "missing or empty",
					},
				},
			)
		})

		t1.Run("3. returns 400 when email is of valid format", func(t2 *testing.T) {
			response, responseBody := sendRequestToEndpointBeingTested(
				t2,
				&dto.LoginRequestPayload{
					Email:    "hello.world",
					Password: "HelloWorld2024",
				},
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

		t1.Run("4. returns 400 when password is missing or empty", func(t2 *testing.T) {
			response, responseBody := sendRequestToEndpointBeingTested(
				t2,
				&dto.LoginRequestPayload{
					Email: gofakeit.Email(),
				},
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
						"password": "missing or empty",
					},
				},
			)
		})

		t1.Run("5. includes current attempt and remaining attempt count when an incorrect password is provided", func(t2 *testing.T) {
			_, testUser := test.CreateAndLoginUser(t2, testServer)

			response, responseBody := sendRequestToEndpointBeingTested(
				t2,
				&dto.LoginRequestPayload{
					Email:    testUser.Email,
					Password: "WrongPassword",
				},
			)

			require.Equal(t2, http.StatusUnauthorized, response.StatusCode)

			require.Equal(
				t2,
				"email or password was incorrect",
				responseBody["message"],
			)

			require.Subset(
				t2,
				responseBody["payload"],
				map[string]any{
					"code": "IncorrectEmailOrPasswordException",
					"extra": map[string]any{
						"currentLoginAttempt":     float64(1),
						"maxLoginAttemptsAllowed": float64(user.MaxLoginAttemptsAllowed),
					},
				},
			)
		})

		t1.Run("6. returns 400 when turnstile token header is not present", func(t2 *testing.T) {
			response, responseBody := test.SendPostRequest(
				t2,
				testServer,
				endpointToTest,
				&dto.LoginRequestPayload{},
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

		t1.Run("7. returns 400 when turnstile token header is empty", func(t2 *testing.T) {
			response, responseBody := test.SendPostRequest(
				t2,
				testServer,
				endpointToTest,
				&dto.LoginRequestPayload{},
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

		t1.Run("8. returns 401 and no runtime error when no user can be found with provided email", func(t2 *testing.T) {
			response, responseBody := sendRequestToEndpointBeingTested(
				t2,
				&dto.LoginRequestPayload{
					Email:    gofakeit.Email(),
					Password: "HelloWorld2024",
				},
			)

			require.Equal(t2, http.StatusUnauthorized, response.StatusCode)

			require.Equal(
				t2,
				"email or password was incorrect",
				responseBody["message"],
			)

			require.Subset(
				t2,
				responseBody["payload"],
				map[string]any{
					"code": "IncorrectEmailOrPasswordException",
				},
			)
		})

		t1.Run("9. returns 403 and blocks users if logging in fails 5 times", func(t2 *testing.T) {
			_, testUser := test.CreateAndLoginUser(t2, testServer)

			gock.New("https://api.resend.com").
				Post("/emails").
				AddMatcher(test.CreateRequestBodyMatcherFunc(func(requestBody map[string]any) {
					require.Equal(t2, []any{testUser.Email}, requestBody["to"])
					require.Equal(t2, "Your account has been blocked", requestBody["subject"])
					require.Equal(t2, "Cloudy Clip <security-alerts@cloudyclip.com>", requestBody["from"])
					require.Empty(t2, requestBody["text"])

					htmlBody := requestBody["html"]
					require.NotContains(t2, "{{.HostName}}", htmlBody)
					require.Contains(
						t2,
						htmlBody,
						environment.Config.AccessControlAllowOrigin+"/images/cloudy-clip-bg-transparent.png",
					)

					require.NotContains(t2, "{{.UserDisplayName}}", htmlBody)
					require.Contains(t2, htmlBody, "Hi "+testUser.DisplayName+",")

					require.Regexp(
						t2,
						regexp.MustCompile(`.*We've blocked further access to your account due to multiple\s+unsuccessful login attempts\.`),
						htmlBody,
					)

					require.Regexp(
						t2,
						regexp.MustCompile(`.*For security reasons, our system automatically locks\s+accounts after a certain number of failed login attempts to\s+protect your information from unauthorized access\.`),
						htmlBody,
					)

					require.Regexp(
						t2,
						regexp.MustCompile(`.*To unlock your account, please click on the following link\s+to begin the password reset process:`),
						htmlBody,
					)

					require.Contains(
						t2,
						htmlBody,
						`href="`+environment.Config.AccessControlAllowOrigin+"/account/reset"+`"`,
					)

					require.Contains(t2, htmlBody, environment.Config.AccessControlAllowOrigin+"/account/reset")

					require.Contains(t2, htmlBody, "<strong>Important security tips:</strong>")

					require.Regexp(
						t2,
						regexp.MustCompile(`.*Choose a strong password that is unique and difficult to\s+guess\.`),
						htmlBody,
					)

					require.Regexp(
						t2,
						regexp.MustCompile(`.*Avoid using personal information like your name,\s+birthday, or common words in your password\.`),
						htmlBody,
					)

					require.Regexp(
						t2,
						regexp.MustCompile(`.*Use a combination of uppercase and lowercase letters,\s+numbers, and symbols\.`),
						htmlBody,
					)

					require.Regexp(
						t2,
						regexp.MustCompile(`.*If you did not attempt to log in to your account recently,\s+or if you continue to experience issues after resetting your\s+password, please contact our support team immediately at`),
						htmlBody,
					)

					require.Contains(
						t2,
						htmlBody,
						`mailto:heretohelp@cloudyclip.com?subject=%5BTrade%20Timeline%5D%20Suspicious%20activity%20on%20my%20account&body=Account%20email:%20`+testUser.Email+`%0ASomeone%20was%20trying%20to%20log%20into%20my%20account.%20Please%20investigate%20this%20matter%20and%20take%20appropriate%20action.`,
					)

					require.Contains(t2, htmlBody, "heretohelp@cloudyclip.com.")

					require.Contains(t2, htmlBody, "Thank you,")
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

			for range 4 {
				_, _ = sendRequestToEndpointBeingTested(
					t2,
					&dto.LoginRequestPayload{
						Email:    testUser.Email,
						Password: "WrongPassword",
					},
				)
			}

			response, responseBody := sendRequestToEndpointBeingTested(
				t2,
				&dto.LoginRequestPayload{
					Email:    testUser.Email,
					Password: "WrongPassword",
				},
			)

			require.Equal(t2, http.StatusForbidden, response.StatusCode)

			require.Equal(
				t2,
				"user is blocked",
				responseBody["message"],
			)

			require.Subset(
				t2,
				responseBody["payload"],
				map[string]any{
					"code": "UserIsBlockedException",
					"extra": map[string]any{
						"reason": "too many failed login attempts",
					},
				},
			)
		})

		t1.Run("10. blocks users if they have not verified their email past the grace period", func(t2 *testing.T) {
			_, testUser := test.CreateAndLoginUser(t2, testServer)

			testUserModel := test.GetTestUserModelByEmail(t2, testUser.Email)

			testUserModel.CreatedAt = testUserModel.CreatedAt.Add(
				-time.Duration(user.VerificationGracePeriodInDays+10) * time.Hour * 24,
			)

			test.UpdateTestUser(t2, testUserModel)

			gock.New("https://api.resend.com").
				Post("/emails").
				AddMatcher(test.CreateRequestBodyMatcherFunc(func(requestBody map[string]any) {
					require.Equal(t2, []any{testUser.Email}, requestBody["to"])
					require.Equal(t2, "Your account has been permanently disabled", requestBody["subject"])
					require.Equal(t2, "Cloudy Clip <security-alerts@cloudyclip.com>", requestBody["from"])
					require.Empty(t2, requestBody["text"])

					htmlBody := requestBody["html"]
					require.NotContains(t2, "{{.HostName}}", htmlBody)
					require.Contains(
						t2,
						htmlBody,
						environment.Config.AccessControlAllowOrigin+"/images/cloudy-clip-bg-transparent.png",
					)

					require.NotContains(t2, "{{.UserDisplayName}}", htmlBody)
					require.Contains(t2, htmlBody, "Hi "+testUser.DisplayName+",")

					require.Regexp(
						t2,
						regexp.MustCompile(`.*Your Cloudy Clip account has been permanently disabled\s+because the email address, `),
						htmlBody,
					)

					require.Contains(t2, htmlBody, `, `+testUser.Email+`, was not verified`)

					require.Regexp(t2, regexp.MustCompile(`.*was not verified\s+within the allowed time\.`), htmlBody)

					require.Regexp(
						t2,
						regexp.MustCompile(`.*Unverified accounts are automatically closed for security\s+reasons\. You can no longer log in or access account data\.`),
						htmlBody,
					)

					require.Regexp(
						t2,
						regexp.MustCompile(`.*Generally, this cannot be reversed\. If you would like us to\s+reconsider our decision, please email us at`),
						htmlBody,
					)

					require.Contains(
						t2,
						htmlBody,
						`mailto:heretohelp@cloudyclip.com?subject=%5BTrade%20Timeline%5D%20Unverified%20account%20disablement%20reversal&body=Account%20email%20=%20`+testUser.Email+`%0A%0A`,
					)

					require.Contains(t2, htmlBody, `heretohelp@cloudyclip.com`)

					require.Regexp(
						t2,
						regexp.MustCompile(`.*with a detailed explanation of why you could not verify your\s+email address within the allowed time frame\.`),
						htmlBody,
					)

					require.Regexp(
						t2,
						regexp.MustCompile(`.*If you wish to use our services, please create a new account\s+with a valid email and verify it promptly\.`),
						htmlBody,
					)

					require.Contains(t2, htmlBody, "Thank you for your understanding,")
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

			response, responseBody := sendRequestToEndpointBeingTested(
				t2,
				&dto.LoginRequestPayload{
					Email:    testUser.Email,
					Password: data.NewUserPassword,
				},
			)

			require.Equal(t2, http.StatusForbidden, response.StatusCode)

			require.Equal(
				t2,
				"user is blocked",
				responseBody["message"],
			)

			require.Subset(
				t2,
				responseBody["payload"],
				map[string]any{
					"code": "UserIsBlockedException",
					"extra": map[string]any{
						"reason":            "unverified email",
						"gracePeriodInDays": float64(user.VerificationGracePeriodInDays),
					},
				},
			)
		})

		t1.Run("11. prevents blocked users from logging in", func(t2 *testing.T) {
			_, testUser := test.CreateAndLoginUser(t2, testServer)

			testUserModel := test.GetTestUserModelByEmail(t2, testUser.Email)

			testUserModel.Status = model.UserStatusBlocked
			testUserModel.StatusReason = model.UserStatusReasonTooManyFailedLoginAttempts

			test.UpdateTestUser(t2, testUserModel)

			response, responseBody := sendRequestToEndpointBeingTested(
				t2,
				&dto.LoginRequestPayload{
					Email:    testUser.Email,
					Password: data.NewUserPassword,
				},
			)

			require.Equal(t2, http.StatusForbidden, response.StatusCode)

			require.Equal(
				t2,
				"user is blocked",
				responseBody["message"],
			)

			require.Subset(
				t2,
				responseBody["payload"],
				map[string]any{
					"code": "UserIsBlockedException",
					"extra": map[string]any{
						"reason": "too many failed login attempts",
					},
				},
			)
		})

		t1.Run("12. users with inactive status can log in, then their status is changed to active", func(t2 *testing.T) {
			_, testUser := test.CreateAndLoginUser(t2, testServer)

			testUserModelBefore := test.GetTestUserModelByEmail(t2, testUser.Email)

			testUserModelBefore.Status = model.UserStatusInactive
			testUserModelBefore.StatusReason = model.UserStatusReasonNone

			test.UpdateTestUser(t2, testUserModelBefore)

			response, _ := sendRequestToEndpointBeingTested(
				t2,
				&dto.LoginRequestPayload{
					Email:    testUser.Email,
					Password: data.NewUserPassword,
				},
			)

			require.Equal(t2, http.StatusOK, response.StatusCode)

			testUserModelAfter := test.GetTestUserModelByEmail(t2, testUser.Email)

			require.Equal(t2, model.UserStatusActive, testUserModelAfter.Status)
			require.Equal(t2, model.UserStatusReasonNone, testUserModelAfter.StatusReason)
		})

		t1.Run("13. prevents permanently blocked users from logging in", func(t2 *testing.T) {
			_, testUser := test.CreateAndLoginUser(t2, testServer)

			testUserModel := test.GetTestUserModelByEmail(t2, testUser.Email)

			testUserModel.Status = model.UserStatusPermanentlyBlocked
			testUserModel.StatusReason = model.UserStatusReasonTooManyFailedLoginAttempts

			test.UpdateTestUser(t2, testUserModel)

			response, responseBody := sendRequestToEndpointBeingTested(
				t2,
				&dto.LoginRequestPayload{
					Email:    testUser.Email,
					Password: data.NewUserPassword,
				},
			)

			require.Equal(t2, http.StatusForbidden, response.StatusCode)

			require.Equal(
				t2,
				"user is blocked",
				responseBody["message"],
			)

			require.Subset(
				t2,
				responseBody["payload"],
				map[string]any{
					"code": "UserIsBlockedException",
					"extra": map[string]any{
						"reason": "too many failed login attempts",
					},
				},
			)
		})

		t1.Run("14. unverified users can log in as long as they are still within the grace period", func(t2 *testing.T) {
			_, testUser := test.CreateAndLoginUser(t2, testServer)

			response, responseBody := sendRequestToEndpointBeingTested(
				t2,
				&dto.LoginRequestPayload{
					Email:    testUser.Email,
					Password: data.NewUserPassword,
				},
			)

			require.Equal(t2, http.StatusOK, response.StatusCode)

			payload := responseBody["payload"].(map[string]any)

			require.Subset(
				t2,
				payload,
				map[string]any{
					"displayName":  testUser.DisplayName,
					"email":        testUser.Email,
					"provider":     "",
					"status":       "UNVERIFIED",
					"statusReason": "",
				},
			)

			testUserModel := test.GetTestUserModelByEmail(t2, testUser.Email)

			require.Equal(t2, model.UserStatusUnverified, testUserModel.Status)
			require.Equal(t2, model.UserStatusReasonNone, testUserModel.StatusReason)
		})

		t1.Run("15. returns 400 when email has more than 64 characters", func(t2 *testing.T) {
			response, responseBody := sendRequestToEndpointBeingTested(
				t2,
				&dto.LoginRequestPayload{
					Email:    strings.Repeat("e", 65) + "@example.com",
					Password: "HelloWorld2024",
				},
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

		t1.Run("16. returns 400 when password has more than 64 characters", func(t2 *testing.T) {
			response, responseBody := sendRequestToEndpointBeingTested(
				t2,
				&dto.LoginRequestPayload{
					Email:    gofakeit.Email(),
					Password: "HelloWorld2024" + strings.Repeat("p", 53),
				},
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
						"password": "must contain at most 64 characters",
					},
				},
			)
		})
	})
}
