package user

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	jet "github.com/go-jet/jet/v2/postgres"
	"github.com/jackc/pgx/v5"
	"github.com/stretchr/testify/require"
	"github.com/cloudy-clip/api/internal/common/database"
	"github.com/cloudy-clip/api/internal/common/database/.jet/table"
	"github.com/cloudy-clip/api/internal/common/http/middleware/turnstile"
	"github.com/cloudy-clip/api/internal/common/jwt"
	"github.com/cloudy-clip/api/internal/user"
	"github.com/cloudy-clip/api/internal/user/model"
	test "github.com/cloudy-clip/api/test/utils"
)

func TestAccountVerificationRequestEndpoint(t1 *testing.T) {
	test.Integration(t1, func(testServer *httptest.Server) {
		const endpointToTest = "/api/v1/users/me/verification"

		userRepository := user.NewUserRepository()

		requestAccountVerification := func(t2 *testing.T, sessionCookie string) {
			response, _ := test.SendPostRequest(
				t2,
				testServer,
				endpointToTest,
				nil,
				map[string]string{
					turnstile.TurnstileTokenHeader: "turnstile-token",
					"Cookie":                       sessionCookie,
				},
			)

			require.Equal(t2, http.StatusNoContent, response.StatusCode)
		}

		t1.Run("1. returns 401 when jwt cookie is missing", func(t2 *testing.T) {
			response, responseBody := test.SendPostRequest(
				t2,
				testServer,
				endpointToTest,
				nil,
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
			response, responseBody := test.SendPostRequest(
				t2,
				testServer,
				endpointToTest,
				nil,
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

		t1.Run("3. returns 204 on success", func(t2 *testing.T) {
			sessionCookie, _ := test.CreateAndLoginUser(t1, testServer)

			requestAccountVerification(t2, sessionCookie)
		})

		t1.Run("4. should not create a new code if one already exists and is active", func(t2 *testing.T) {
			sessionCookie, testUser := test.CreateAndLoginUser(t1, testServer)

			_ = database.UseTransaction(context.Background(), func(transaction pgx.Tx) error {
				requestAccountVerification(t2, sessionCookie)

				testUser := test.GetTestUserModelByEmail(t2, testUser.Email)

				verificationCodeInfoBefore, err := userRepository.FindVerificationCodeInfoByUserIdAndType(
					context.Background(),
					transaction,
					testUser.UserID,
					model.VerificationTypeAccountVerification,
				)
				require.NoError(t2, err, "failed to find account verification code")
				require.Equal(t2, testUser.UserID, verificationCodeInfoBefore.UserId)

				requestAccountVerification(t2, sessionCookie)
				verificationCodeInfoAfter, err := userRepository.FindVerificationCodeInfoByUserIdAndType(
					context.Background(),
					transaction,
					testUser.UserID,
					model.VerificationTypeAccountVerification,
				)
				require.NoError(t2, err, "failed to find account verification code")
				require.Equal(t2, verificationCodeInfoBefore.UserId, verificationCodeInfoAfter.UserId)
				require.Equal(
					t2,
					verificationCodeInfoBefore.VerificationCodeId,
					verificationCodeInfoAfter.VerificationCodeId,
				)

				return nil
			})
		})

		t1.Run("4. should not create a new code if one already exists and is active", func(t2 *testing.T) {
			sessionCookie, testUser := test.CreateAndLoginUser(t1, testServer)

			_ = database.UseTransaction(context.Background(), func(transaction pgx.Tx) error {
				requestAccountVerification(t2, sessionCookie)

				testUser := test.GetTestUserModelByEmail(t2, testUser.Email)

				verificationCodeInfoBefore, err := userRepository.FindVerificationCodeInfoByUserIdAndType(
					context.Background(),
					transaction,
					testUser.UserID,
					model.VerificationTypeAccountVerification,
				)
				require.NoError(t2, err, "failed to find account verification code")
				require.Equal(t2, testUser.UserID, verificationCodeInfoBefore.UserId)

				requestAccountVerification(t2, sessionCookie)

				verificationCodeInfoAfter, err := userRepository.FindVerificationCodeInfoByUserIdAndType(
					context.Background(),
					transaction,
					testUser.UserID,
					model.VerificationTypeAccountVerification,
				)
				require.NoError(t2, err, "failed to find account verification code")
				require.Equal(t2, verificationCodeInfoBefore.UserId, verificationCodeInfoAfter.UserId)
				require.Equal(
					t2,
					verificationCodeInfoBefore.VerificationCodeId,
					verificationCodeInfoAfter.VerificationCodeId,
				)

				return nil
			})
		})

		t1.Run("5. deletes expired code and creates a new one", func(t2 *testing.T) {
			sessionCookie, testUser := test.CreateAndLoginUser(t1, testServer)

			_ = database.UseTransaction(context.Background(), func(transaction pgx.Tx) error {
				requestAccountVerification(t2, sessionCookie)

				testUser := test.GetTestUserModelByEmail(t2, testUser.Email)

				verificationCodeInfoBefore, err := userRepository.FindVerificationCodeInfoByUserIdAndType(
					context.Background(),
					transaction,
					testUser.UserID,
					model.VerificationTypeAccountVerification,
				)
				require.NoError(t2, err, "failed to find account verification code")
				require.Equal(t2, testUser.UserID, verificationCodeInfoBefore.UserId)

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

				requestAccountVerification(t2, sessionCookie)

				verificationCodeInfoAfter, err := userRepository.FindVerificationCodeInfoByUserIdAndType(
					context.Background(),
					transaction,
					testUser.UserID,
					model.VerificationTypeAccountVerification,
				)
				require.NoError(t2, err, "failed to find account verification code")
				require.Equal(t2, verificationCodeInfoBefore.UserId, verificationCodeInfoAfter.UserId)
				require.NotEqual(
					t2,
					verificationCodeInfoBefore.VerificationCodeId,
					verificationCodeInfoAfter.VerificationCodeId,
				)

				return nil
			})
		})

	})
}
