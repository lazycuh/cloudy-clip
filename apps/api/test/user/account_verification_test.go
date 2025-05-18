package user

import (
	"context"
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
	"github.com/cloudy-clip/api/internal/user"
	"github.com/cloudy-clip/api/internal/user/model"
	test "github.com/cloudy-clip/api/test/utils"
)

func TestAccountVerificationEndpoint(t1 *testing.T) {
	test.Integration(t1, func(testServer *httptest.Server) {
		const accountVerificationEndpoint = "/api/v1/users/me/verification"

		userRepository := user.NewUserRepository()

		verifyAccount := func(t2 *testing.T, code string) (*http.Response, map[string]any) {
			return test.SendPatchRequest(
				t2,
				testServer,
				accountVerificationEndpoint+"?code="+code,
				nil,
				map[string]string{
					turnstile.TurnstileTokenHeader: "turnstile-token",
				},
			)
		}

		t1.Run("1. returns 400 when turnstile token header is missing", func(t2 *testing.T) {
			response, responseBody := test.SendPatchRequest(
				t2,
				testServer,
				accountVerificationEndpoint,
				nil,
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

		t1.Run("2. returns 400 when turnstile token header is empty", func(t2 *testing.T) {
			response, responseBody := test.SendPatchRequest(
				t2,
				testServer,
				accountVerificationEndpoint,
				nil,
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

		t1.Run("3. returns 204 on success and sets user status to active", func(t2 *testing.T) {
			_ = database.UseTransaction(context.Background(), func(transaction pgx.Tx) error {
				_, testUser := test.CreateAndLoginUser(t2, testServer)

				testUserModelBefore := test.GetTestUserModelByEmail(t2, testUser.Email)

				verificationCodeInfo, err := userRepository.FindVerificationCodeInfoByUserIdAndType(
					context.Background(),
					transaction,
					testUserModelBefore.UserID,
					model.VerificationTypeAccountVerification,
				)
				require.NoError(t2, err, "failed to find verification code")

				require.Equal(t2, model.UserStatusUnverified, testUserModelBefore.Status)

				response, _ := verifyAccount(t2, verificationCodeInfo.VerificationCodeId)
				require.Equal(t2, http.StatusNoContent, response.StatusCode)

				testUserModelAfter := test.GetTestUserModelByEmail(t2, testUser.Email)
				require.Equal(t2, model.UserStatusActive, testUserModelAfter.Status)

				return nil
			})
		})

		t1.Run("4. returns 400 when verification code does not exist", func(t2 *testing.T) {
			_, _ = test.CreateAndLoginUser(t2, testServer)

			response, responseBody := verifyAccount(t2, "non-existent-code")
			require.Equal(t2, http.StatusBadRequest, response.StatusCode)

			require.Equal(
				t2,
				"verification code does not exist",
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

		t1.Run("5. returns 400 when verification code has expired", func(t2 *testing.T) {
			_ = database.UseTransaction(context.Background(), func(transaction pgx.Tx) error {
				_, testUser := test.CreateAndLoginUser(t2, testServer)

				testUserModelBefore := test.GetTestUserModelByEmail(t2, testUser.Email)

				verificationCodeInfo, err := userRepository.FindVerificationCodeInfoByUserIdAndType(
					context.Background(),
					transaction,
					testUserModelBefore.UserID,
					model.VerificationTypeAccountVerification,
				)
				require.NoError(t2, err, "failed to find verification code")

				verificationCodeInfo.CreatedAt = verificationCodeInfo.CreatedAt.Add(-time.Duration(24) * time.Hour)
				updateBuilder := table.VerificationCodeTable.
					UPDATE(table.VerificationCodeTable.CreatedAt).
					SET(verificationCodeInfo.CreatedAt).
					WHERE(table.VerificationCodeTable.VerificationCodeID.EQ(jet.String(verificationCodeInfo.VerificationCodeId)))

				err = database.Exec(context.Background(), updateBuilder)
				require.NoError(t2, err, "failed to make verification code expired")

				response, responseBody := verifyAccount(t2, verificationCodeInfo.VerificationCodeId)
				require.Equal(t2, http.StatusBadRequest, response.StatusCode)

				require.Equal(
					t2,
					"verification code has expired",
					responseBody["message"],
				)

				require.Subset(
					t2,
					responseBody["payload"],
					map[string]any{
						"code": "ValidationException",
					},
				)

				return nil
			})
		})

		t1.Run("6. returns 400 when verification code is empty", func(t2 *testing.T) {
			_, _ = test.CreateAndLoginUser(t2, testServer)

			response, responseBody := verifyAccount(t2, "")
			require.Equal(t2, http.StatusBadRequest, response.StatusCode)

			require.Equal(
				t2,
				"'code' query param is missing or empty",
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

		t1.Run("7. returns 400 when verification code is just white spaces", func(t2 *testing.T) {
			_, _ = test.CreateAndLoginUser(t2, testServer)

			response, responseBody := verifyAccount(t2, "%20%20")
			require.Equal(t2, http.StatusBadRequest, response.StatusCode)

			require.Equal(
				t2,
				"verification code is empty",
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

	})
}
