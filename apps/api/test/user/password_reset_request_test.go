package user

import (
	"context"
	"net/http"
	"net/http/httptest"
	"regexp"
	"strings"
	"testing"
	"time"

	"github.com/brianvoe/gofakeit/v7"
	jet "github.com/go-jet/jet/v2/postgres"
	"github.com/h2non/gock"
	"github.com/jackc/pgx/v5"
	"github.com/stretchr/testify/require"
	"github.com/cloudy-clip/api/internal/common/database"
	"github.com/cloudy-clip/api/internal/common/database/.jet/table"
	"github.com/cloudy-clip/api/internal/common/environment"
	"github.com/cloudy-clip/api/internal/common/exception"
	"github.com/cloudy-clip/api/internal/common/http/middleware/turnstile"
	"github.com/cloudy-clip/api/internal/user"
	"github.com/cloudy-clip/api/internal/user/dto"
	"github.com/cloudy-clip/api/internal/user/model"
	test "github.com/cloudy-clip/api/test/utils"
)

func TestPasswordResetRequestEndpoint(t1 *testing.T) {
	test.Integration(t1, func(testServer *httptest.Server) {
		const endpointToTest = "/api/v1/users/me/reset/password"

		userRepository := user.NewUserRepository()

		requestPasswordReset := func(t *testing.T, email string) (*http.Response, map[string]any) {
			return test.SendPostRequest(
				t,
				testServer,
				endpointToTest,
				&dto.PasswordResetRequestPayload{
					Email: email,
				},
				map[string]string{
					turnstile.TurnstileTokenHeader: "turnstile-token",
				},
			)
		}

		t1.Run("1. returns 400 when email is missing or empty", func(t2 *testing.T) {
			response, responseBody := requestPasswordReset(t2, "")

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

		t1.Run("2. returns 400 when email is of valid format", func(t2 *testing.T) {
			response, responseBody := requestPasswordReset(t2, "hello.world")

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

		t1.Run("3. returns 400 when turnstile token header is not present", func(t2 *testing.T) {
			_, testUser := test.CreateAndLoginUser(t1, testServer)

			response, responseBody := test.SendPostRequest(
				t2,
				testServer,
				endpointToTest,
				&dto.PasswordResetRequestPayload{
					Email: testUser.Email,
				},
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

		t1.Run("4. returns 400 when turnstile token header is empty", func(t2 *testing.T) {
			_, testUser := test.CreateAndLoginUser(t1, testServer)

			response, responseBody := test.SendPostRequest(
				t2,
				testServer,
				endpointToTest,
				&dto.PasswordResetRequestPayload{
					Email: testUser.Email,
				},
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

		t1.Run("5. returns 204 and no runtime error when no user can be found with provided email", func(t2 *testing.T) {
			response, _ := requestPasswordReset(t2, gofakeit.Email())

			require.Equal(t2, http.StatusNoContent, response.StatusCode)
		})

		t1.Run("6. should not create a new code if one already exists and is active", func(t2 *testing.T) {
			_, testUser := test.CreateAndLoginUser(t2, testServer)

			test.MockSendingEmail()

			_ = database.UseTransaction(context.Background(), func(transaction pgx.Tx) error {
				responseBefore, _ := requestPasswordReset(t2, testUser.Email)
				require.Equal(t2, http.StatusNoContent, responseBefore.StatusCode)

				verificationCodeInfoBefore, err := userRepository.FindVerificationCodeInfoByUserIdAndType(
					context.Background(),
					transaction,
					testUser.UserId,
					model.VerificationTypePasswordReset,
				)
				require.NoError(t2, err, "failed to find password reset verification code")
				require.Equal(t2, testUser.UserId, verificationCodeInfoBefore.UserId)

				responseAfter, _ := requestPasswordReset(t2, testUser.Email)
				require.Equal(t2, http.StatusNoContent, responseAfter.StatusCode)

				verificationCodeInfoAfter, err := userRepository.FindVerificationCodeInfoByUserIdAndType(
					context.Background(),
					transaction,
					testUser.UserId,
					model.VerificationTypePasswordReset,
				)
				require.NoError(t2, err, "failed to find password reset verification code")
				require.Equal(t2, verificationCodeInfoBefore.UserId, verificationCodeInfoAfter.UserId)
				require.Equal(
					t2,
					verificationCodeInfoBefore.VerificationCodeId,
					verificationCodeInfoAfter.VerificationCodeId,
				)

				return nil
			})
		})

		t1.Run("7. should delete expired code before creating a new one", func(t2 *testing.T) {
			_, testUser := test.CreateAndLoginUser(t2, testServer)

			test.MockSendingEmail()

			_ = database.UseTransaction(context.Background(), func(transaction pgx.Tx) error {
				responseBefore, _ := requestPasswordReset(t2, testUser.Email)
				require.Equal(t2, http.StatusNoContent, responseBefore.StatusCode)

				verificationCodeInfoBefore, err := userRepository.FindVerificationCodeInfoByUserIdAndType(
					context.Background(),
					transaction,
					testUser.UserId,
					model.VerificationTypePasswordReset,
				)
				require.NoError(t2, err, "failed to find password reset verification code")

				verificationCodeInfoBefore.CreatedAt = verificationCodeInfoBefore.CreatedAt.Add(
					-time.Duration(24) * time.Hour,
				)

				updateBuilder := table.VerificationCodeTable.
					UPDATE(table.VerificationCodeTable.CreatedAt).
					SET(verificationCodeInfoBefore.CreatedAt).
					WHERE(table.VerificationCodeTable.VerificationCodeID.EQ(
						jet.String(verificationCodeInfoBefore.VerificationCodeId),
					))

				err = database.Exec(context.Background(), updateBuilder)
				require.NoError(t2, err, "failed to make code expired")

				test.MockSendingEmail()

				responseAfter, _ := requestPasswordReset(t2, testUser.Email)
				require.Equal(t2, http.StatusNoContent, responseAfter.StatusCode)

				_, err = userRepository.FindVerificationCodeInfoById(
					context.Background(),
					transaction,
					verificationCodeInfoBefore.VerificationCodeId,
				)
				require.Error(t2, err, "verification code should have been deleted")
				require.True(t2, database.IsEmptyResultError(err), "error should be 'no empty result'")

				verificationCodeInfoAfter, err := userRepository.FindVerificationCodeInfoByUserIdAndType(
					context.Background(),
					transaction,
					testUser.UserId,
					model.VerificationTypePasswordReset,
				)
				require.NoError(t2, err, "failed to find password reset verification code")

				require.Equal(t2, verificationCodeInfoBefore.UserId, verificationCodeInfoAfter.UserId)
				require.NotEqual(
					t2,
					verificationCodeInfoBefore.VerificationCodeId,
					verificationCodeInfoAfter.VerificationCodeId,
				)

				return nil
			})
		})

		t1.Run("8. returns 400 if login provider is not none", func(t2 *testing.T) {
			_, testUserBefore := test.CreateAndLoginUser(t2, testServer)
			testUserModelBefore := test.GetTestUserModelByEmail(t2, testUserBefore.Email)
			testUserModelBefore.Provider = model.Oauth2ProviderFacebook

			test.UpdateTestUser(t2, testUserModelBefore)

			response, responseBody := test.SendPostRequest(
				t2,
				testServer,
				endpointToTest,
				&dto.PasswordResetRequestPayload{
					Email: testUserBefore.Email,
				},
				map[string]string{
					turnstile.TurnstileTokenHeader: "turnstile-token",
				},
			)
			require.Equal(t2, http.StatusBadRequest, response.StatusCode)
			require.Equal(
				t2,
				"resetting password for oauth2 user is not allowed",
				responseBody["message"],
			)
			require.Subset(
				t2,
				responseBody["payload"],
				map[string]any{
					"code": "PasswordResetNotAllowedForOauth2UserException",
					"extra": map[string]any{
						"provider": "FACEBOOK",
					},
				},
			)
		})

		t1.Run("9. returns 400 when email has more than 64 characters", func(t2 *testing.T) {
			response, responseBody := requestPasswordReset(t2, strings.Repeat("a", 65)+"@gmail.com")

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

		t1.Run("10. sends email after creating password reset successfully", func(t2 *testing.T) {
			_, testUser := test.CreateAndLoginUser(t2, testServer)

			gock.New("https://api.resend.com").
				Post("/emails").
				AddMatcher(test.CreateRequestBodyMatcherFunc(func(requestBody map[string]any) {
					require.Equal(t2, []any{testUser.Email}, requestBody["to"])
					require.Equal(t2, "Password reset", requestBody["subject"])
					require.Equal(t2, "Cloudy Clip <security-alerts@cloudyclip.com>", requestBody["from"])
					require.Empty(t2, requestBody["text"])

					htmlBody := requestBody["html"]
					require.NotContains(t2, "{{.HostName}}", htmlBody)
					require.NotContains(t2, "{{.PasswordResetPath}}", htmlBody)
					require.Contains(t2, htmlBody, "Hi "+testUser.DisplayName+",")
					require.Contains(t2, htmlBody, "We've received a request to reset your password.")
					require.Contains(t2, htmlBody, "Please click the following link to set a new password:")
					require.Contains(
						t2,
						htmlBody,
						environment.Config.AccessControlAllowOrigin+"/account/reset/verification?code=",
					)
					require.Regexp(
						t2,
						regexp.MustCompile(`.*/account/reset/verification\?code=[A-Z0-9]+".*`),
						htmlBody,
					)
					require.Contains(t2, htmlBody, "Please note that this link will expire in 30 minutes.")
					require.Regexp(
						t2,
						regexp.MustCompile(`.*If you did not initiate this request, please ignore this\s+email\.`),
						htmlBody,
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

			response, _ := requestPasswordReset(t2, testUser.Email)

			require.Equal(t2, http.StatusNoContent, response.StatusCode)
		})
	})
}
