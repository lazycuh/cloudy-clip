package user

import (
	"context"
	"net/http"
	"net/http/httptest"
	"regexp"
	"testing"

	"github.com/h2non/gock"
	"github.com/jackc/pgx/v5"
	"github.com/stretchr/testify/require"
	"github.com/cloudy-clip/api/internal/common/database"
	"github.com/cloudy-clip/api/internal/common/environment"
	"github.com/cloudy-clip/api/internal/common/http/middleware/turnstile"
	"github.com/cloudy-clip/api/internal/user"
	"github.com/cloudy-clip/api/internal/user/dto"
	"github.com/cloudy-clip/api/internal/user/model"

	test "github.com/cloudy-clip/api/test/utils"
)

func TestPasswordResetEndpoint(t1 *testing.T) {
	test.Integration(t1, func(testServer *httptest.Server) {
		const endpointToTest = "/api/v1/users/me/reset/password"

		userRepository := user.NewUserRepository()

		requestPasswordReset := func(t2 *testing.T, transaction pgx.Tx, testUser *test.TestUser) string {
			test.MockSendingEmail()

			passwordResetRequestResponse, _ := test.SendPostRequest(
				t2,
				testServer,
				endpointToTest,
				&dto.PasswordResetRequestPayload{
					Email: testUser.Email,
				},
				map[string]string{
					turnstile.TurnstileTokenHeader: "turnstile-token",
				},
			)
			require.Equal(t2, http.StatusNoContent, passwordResetRequestResponse.StatusCode)

			verificationCodeInfo, err := userRepository.FindVerificationCodeInfoByUserIdAndType(
				context.Background(),
				transaction,
				testUser.UserId,
				model.VerificationTypePasswordReset,
			)
			require.NoError(t2, err, "failed to find verification code")

			return verificationCodeInfo.VerificationCodeId
		}

		resetPassword := func(t2 *testing.T, code string, newPassword string) {
			response, _ := test.SendPatchRequest(
				t2,
				testServer,
				endpointToTest,
				&dto.ResetPasswordRequestPayload{
					Password:         newPassword,
					VerificationCode: code,
				},
				map[string]string{
					turnstile.TurnstileTokenHeader: "turnstile-token",
				},
			)

			require.Equal(t2, http.StatusNoContent, response.StatusCode)
		}

		t1.Run("1. returns 400 when turnstile token header is missing", func(t2 *testing.T) {
			response, responseBody := test.SendPatchRequest(t2, testServer, endpointToTest, nil, nil)

			require.Equal(t2, http.StatusBadRequest, response.StatusCode)
			require.Equal(t2, "failed to verify turnstile token", responseBody["message"])

			require.Subset(
				t2,
				responseBody["payload"],
				map[string]any{
					"code": "ValidationException",
				},
			)
		})

		t1.Run("2. returns 400 when turnstile token header is empty", func(t2 *testing.T) {
			response, responseBody := test.SendPatchRequest(
				t2,
				testServer,
				endpointToTest,
				nil,
				map[string]string{
					turnstile.TurnstileTokenHeader: "",
				},
			)

			require.Equal(t2, http.StatusBadRequest, response.StatusCode)
			require.Equal(t2, "failed to verify turnstile token", responseBody["message"])

			require.Subset(
				t2,
				responseBody["payload"],
				map[string]any{
					"code": "ValidationException",
				},
			)
		})

		t1.Run("3. returns 204 on success and sets user status to active if their status is blocked", func(t2 *testing.T) {
			_ = database.UseTransaction(context.Background(), func(transaction pgx.Tx) error {
				_, testUser := test.CreateAndLoginUser(t1, testServer)

				testUserBefore := test.GetTestUserModelByEmail(t2, testUser.Email)

				verificationCode := requestPasswordReset(t2, transaction, testUser)

				testUserBefore.Status = model.UserStatusBlocked
				testUserBefore.StatusReason = model.UserStatusReasonTooManyFailedLoginAttempts

				test.UpdateTestUser(t2, testUserBefore)

				testUserAfter := test.GetTestUserModelByEmail(t2, testUser.Email)
				require.Equal(t2, model.UserStatusBlocked, testUserAfter.Status)
				require.Equal(t2, model.UserStatusReasonTooManyFailedLoginAttempts, testUserAfter.StatusReason)

				test.MockSendingEmail()

				resetPassword(t2, verificationCode, "NewPassword2024")

				testUserAfter = test.GetTestUserModelByEmail(t2, testUser.Email)
				require.Equal(t2, model.UserStatusActive, testUserAfter.Status)
				require.Equal(t2, model.UserStatusReasonNone, testUserAfter.StatusReason)

				return nil
			})
		})

		t1.Run("4. returns 204 on success and does not set status to active if status is unverified", func(t2 *testing.T) {
			_ = database.UseTransaction(context.Background(), func(transaction pgx.Tx) error {
				_, testUser := test.CreateAndLoginUser(t1, testServer)

				testUserBefore := test.GetTestUserModelByEmail(t2, testUser.Email)

				require.Equal(t2, model.UserStatusUnverified, testUserBefore.Status)

				verificationCode := requestPasswordReset(t2, transaction, testUser)

				test.MockSendingEmail()

				resetPassword(t2, verificationCode, "NewPassword2024")

				testUserAfter := test.GetTestUserModelByEmail(t2, testUser.Email)
				require.Equal(t2, model.UserStatusUnverified, testUserAfter.Status)
				require.Equal(t2, model.UserStatusReasonNone, testUserAfter.StatusReason)

				return nil
			})
		})

		t1.Run("5. returns 204 on success and does not set status to active if status is permanently blocked", func(t2 *testing.T) {
			_ = database.UseTransaction(context.Background(), func(transaction pgx.Tx) error {
				_, testUser := test.CreateAndLoginUser(t1, testServer)

				testUserBefore := test.GetTestUserModelByEmail(t2, testUser.Email)

				verificationCode := requestPasswordReset(t2, transaction, testUser)

				testUserBefore.Status = model.UserStatusPermanentlyBlocked
				testUserBefore.StatusReason = model.UserStatusReasonTooManyFailedLoginAttempts

				test.UpdateTestUser(t2, testUserBefore)

				testUserAfter := test.GetTestUserModelByEmail(t2, testUser.Email)
				require.Equal(t2, model.UserStatusPermanentlyBlocked, testUserAfter.Status)
				require.Equal(t2, model.UserStatusReasonTooManyFailedLoginAttempts, testUserAfter.StatusReason)

				test.MockSendingEmail()

				resetPassword(t2, verificationCode, "NewPassword2024")

				testUserAfter = test.GetTestUserModelByEmail(t2, testUser.Email)
				require.Equal(t2, model.UserStatusPermanentlyBlocked, testUserAfter.Status)
				require.Equal(t2, model.UserStatusReasonTooManyFailedLoginAttempts, testUserAfter.StatusReason)

				return nil
			})
		})

		t1.Run("6. can log in after resetting password", func(t2 *testing.T) {
			_ = database.UseTransaction(context.Background(), func(transaction pgx.Tx) error {
				_, testUser := test.CreateAndLoginUser(t1, testServer)

				verificationCode := requestPasswordReset(t2, transaction, testUser)

				test.MockSendingEmail()

				resetPassword(t2, verificationCode, "NewPassword2024")

				loginResponse, _ := test.SendPostRequest(
					t2,
					testServer,
					"/api/v1/users/me/sessions",
					&dto.LoginRequestPayload{
						Password: "NewPassword2024",
						Email:    testUser.Email,
					},
					map[string]string{
						turnstile.TurnstileTokenHeader: "turnstile-token",
					},
				)

				require.Equal(t2, http.StatusOK, loginResponse.StatusCode)

				return nil
			})
		})

		t1.Run("7. sends password reset confirmation email", func(t2 *testing.T) {
			_ = database.UseTransaction(context.Background(), func(transaction pgx.Tx) error {
				_, testUser := test.CreateAndLoginUser(t1, testServer)

				verificationCode := requestPasswordReset(t2, transaction, testUser)

				gock.New("https://api.resend.com").
					Post("/emails").
					AddMatcher(test.CreateRequestBodyMatcherFunc(func(requestBody map[string]any) {
						require.Equal(t2, []any{testUser.Email}, requestBody["to"])
						require.Equal(t2, "Your password was reset", requestBody["subject"])
						require.Equal(t2, "Cloudy Clip <security-alerts@cloudyclip.com>", requestBody["from"])
						require.Empty(t2, requestBody["text"])

						htmlBody := requestBody["html"]
						require.NotContains(t2, "{{.HostName}}", htmlBody)
						require.Contains(t2, htmlBody, "Hi "+testUser.DisplayName+",")
						require.Regexp(
							t2,
							regexp.MustCompile(
								`.*This email confirms that your Cloudy Clip password has\s+been successfully reset.*`,
							),
							htmlBody,
						)
						require.Regexp(
							t2,
							regexp.MustCompile(
								`.*If you did not authorize this change, please report it\s+immediately by clicking the following link:.*`,
							),
							htmlBody,
						)
						require.Contains(t2, htmlBody, "Report suspicious activity")
						require.Contains(
							t2,
							htmlBody,
							"mailto:heretohelp@cloudyclip.com?subject=%5BTrade%20Timeline%5D%20Suspicious%20activity%20on%20my%20account&body=Account%20email:%20"+testUser.Email+"%0A%0AMy%20account%20password%20was%20reset%20without%20my%20authorization.%20Please%20investigate%20this%20matter%20and%20take%20appropriate%20action.%0A%0A",
						)
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

				resetPassword(t2, verificationCode, "NewPassword2024")

				return nil
			})
		})
	})
}
