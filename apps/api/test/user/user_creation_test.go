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
	"github.com/cloudy-clip/api/internal/user/dto"
	data "github.com/cloudy-clip/api/test"
	test "github.com/cloudy-clip/api/test/utils"
)

func TestUserCreationEndpoint(t1 *testing.T) {
	test.Integration(t1, func(testServer *httptest.Server) {
		const endpointToTest = "/api/v1/users"

		sendRequestToEndpointBeingTested := func(
			t2 *testing.T,
			requestPayload *dto.CreateUserRequestPayload,
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

		t1.Run("1. creates user and returns authenticated user object with a 201 status", func(t2 *testing.T) {
			createUserRequestPayload := &dto.CreateUserRequestPayload{
				Email:       gofakeit.Email(),
				Password:    "HelloWorld2024",
				DisplayName: gofakeit.Name(),
			}

			test.MockSendingEmail()

			response, responseBody := sendRequestToEndpointBeingTested(t2, createUserRequestPayload)

			require.Equal(t2, http.StatusCreated, response.StatusCode)

			testUserModel := test.GetTestUserModelByEmail(t2, createUserRequestPayload.Email)

			require.NotNil(t2, testUserModel)
			require.Equal(t2, createUserRequestPayload.DisplayName, testUserModel.DisplayName)
			require.Equal(t2, 26, len(testUserModel.UserID))
			require.Equal(t2, 64, len(testUserModel.Password))
			require.NotEqual(t2, createUserRequestPayload.Password, testUserModel.Password)
			require.Equal(t2, 64, len(testUserModel.Salt))

			payload := responseBody["payload"].(map[string]any)

			require.Subset(
				t2,
				payload,
				map[string]any{
					"displayName":  createUserRequestPayload.DisplayName,
					"email":        createUserRequestPayload.Email,
					"provider":     "",
					"status":       "UNVERIFIED",
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

		t1.Run("2. returns 400 when email is missing", func(t2 *testing.T) {
			createUserRequestPayload := &dto.CreateUserRequestPayload{
				Password:    "HelloWorld2024",
				DisplayName: gofakeit.Name(),
			}
			response, responseBody := sendRequestToEndpointBeingTested(t2, createUserRequestPayload)

			require.Equal(t2, http.StatusBadRequest, response.StatusCode)

			require.Equal(t2, exception.DefaultValidationExceptionMessage, responseBody["message"])

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

		t1.Run("3. returns 400 when email is not of valid format", func(t2 *testing.T) {
			createUserRequestPayload := &dto.CreateUserRequestPayload{
				Email:       "hello.world@gmail",
				Password:    "HelloWorld2024",
				DisplayName: gofakeit.Name(),
			}
			response, responseBody := sendRequestToEndpointBeingTested(t2, createUserRequestPayload)

			require.Equal(t2, http.StatusBadRequest, response.StatusCode)

			require.Equal(t2, exception.DefaultValidationExceptionMessage, responseBody["message"])

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

		t1.Run("4. returns 400 when email is longer than 64 characters", func(t2 *testing.T) {
			createUserRequestPayload := &dto.CreateUserRequestPayload{
				Email:       fmt.Sprintf("%s@gmail.com", strings.Repeat("a", 64-10+1)),
				Password:    "HelloWorld2024",
				DisplayName: gofakeit.Name(),
			}
			response, responseBody := sendRequestToEndpointBeingTested(t2, createUserRequestPayload)

			require.Equal(t2, http.StatusBadRequest, response.StatusCode)

			require.Equal(t2, exception.DefaultValidationExceptionMessage, responseBody["message"])

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

		t1.Run("5. returns 400 when displayName is missing", func(t2 *testing.T) {
			createUserRequestPayload := &dto.CreateUserRequestPayload{
				Email:    gofakeit.Email(),
				Password: "HelloWorld2024",
			}
			response, responseBody := sendRequestToEndpointBeingTested(t2, createUserRequestPayload)

			require.Equal(t2, http.StatusBadRequest, response.StatusCode)

			require.Equal(t2, exception.DefaultValidationExceptionMessage, responseBody["message"])

			require.Subset(
				t2,
				responseBody["payload"],
				map[string]any{
					"code": "ValidationException",
					"extra": map[string]any{
						"displayName": "missing or empty",
					},
				},
			)
		})

		t1.Run("6. returns 400 when email is longer than 32 characters", func(t2 *testing.T) {
			createUserRequestPayload := &dto.CreateUserRequestPayload{
				DisplayName: strings.Repeat("a", 33),
				Password:    "HelloWorld2024",
				Email:       gofakeit.Email(),
			}
			response, responseBody := sendRequestToEndpointBeingTested(t2, createUserRequestPayload)

			require.Equal(t2, http.StatusBadRequest, response.StatusCode)

			require.Equal(t2, exception.DefaultValidationExceptionMessage, responseBody["message"])

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

		t1.Run("7. returns 400 when password is missing", func(t2 *testing.T) {
			createUserRequestPayload := &dto.CreateUserRequestPayload{
				Email:       gofakeit.Email(),
				DisplayName: gofakeit.Name(),
			}
			response, responseBody := sendRequestToEndpointBeingTested(t2, createUserRequestPayload)

			require.Equal(t2, http.StatusBadRequest, response.StatusCode)

			require.Equal(t2, exception.DefaultValidationExceptionMessage, responseBody["message"])

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

		t1.Run("8. returns 400 when password does not contain mixed cased characters", func(t2 *testing.T) {
			createUserRequestPayload := &dto.CreateUserRequestPayload{
				Email:       gofakeit.Email(),
				DisplayName: gofakeit.Name(),
				Password:    "hello-world2014",
			}
			response, responseBody := sendRequestToEndpointBeingTested(t2, createUserRequestPayload)

			require.Equal(t2, http.StatusBadRequest, response.StatusCode)

			require.Equal(t2, exception.DefaultValidationExceptionMessage, responseBody["message"])

			require.Subset(
				t2,
				responseBody["payload"],
				map[string]any{
					"code": "ValidationException",
					"extra": map[string]any{
						"password": "must contain uppercase and lowercase characters",
					},
				},
			)
		})

		t1.Run("9. returns 400 when password does not contain at least one number", func(t2 *testing.T) {
			createUserRequestPayload := &dto.CreateUserRequestPayload{
				Email:       gofakeit.Email(),
				DisplayName: gofakeit.Name(),
				Password:    "HelloWorld",
			}
			response, responseBody := sendRequestToEndpointBeingTested(t2, createUserRequestPayload)

			require.Equal(t2, http.StatusBadRequest, response.StatusCode)

			require.Equal(t2, exception.DefaultValidationExceptionMessage, responseBody["message"])

			require.Subset(
				t2,
				responseBody["payload"],
				map[string]any{
					"code": "ValidationException",
					"extra": map[string]any{
						"password": "must contain at least one number",
					},
				},
			)
		})

		t1.Run("10. returns 400 when password is fewer than 8 characters", func(t2 *testing.T) {
			createUserRequestPayload := &dto.CreateUserRequestPayload{
				DisplayName: gofakeit.Name(),
				Password:    "Hello1",
				Email:       gofakeit.Email(),
			}
			response, responseBody := sendRequestToEndpointBeingTested(t2, createUserRequestPayload)

			require.Equal(t2, http.StatusBadRequest, response.StatusCode)

			require.Equal(t2, exception.DefaultValidationExceptionMessage, responseBody["message"])

			require.Subset(
				t2,
				responseBody["payload"],
				map[string]any{
					"code": "ValidationException",
					"extra": map[string]any{
						"password": "must contain at least 8 characters",
					},
				},
			)
		})

		t1.Run("11. returns 400 when password is longer than 64 characters", func(t2 *testing.T) {
			createUserRequestPayload := &dto.CreateUserRequestPayload{
				DisplayName: gofakeit.Name(),
				Password:    "HelloWorld2024" + strings.Repeat("a", 64-14+1),
				Email:       gofakeit.Email(),
			}
			response, responseBody := sendRequestToEndpointBeingTested(t2, createUserRequestPayload)

			require.Equal(t2, http.StatusBadRequest, response.StatusCode)

			require.Equal(t2, exception.DefaultValidationExceptionMessage, responseBody["message"])

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

		t1.Run("12. returns 409 if email is already used", func(t2 *testing.T) {
			createUserRequestPayload := &dto.CreateUserRequestPayload{
				Email:       gofakeit.Email(),
				Password:    "HelloWorld2024",
				DisplayName: gofakeit.Name(),
			}

			test.MockSendingEmail()

			response, _ := sendRequestToEndpointBeingTested(t2, createUserRequestPayload)

			require.Equal(t2, http.StatusCreated, response.StatusCode)

			response, responseBody := sendRequestToEndpointBeingTested(t2, createUserRequestPayload)

			require.Equal(t2, http.StatusConflict, response.StatusCode)

			require.Equal(
				t2,
				responseBody["message"],
				"user already exists",
			)
		})

		t1.Run("13. returns 400 when turnstile token header is not present", func(t2 *testing.T) {
			response, responseBody := test.SendPostRequest(
				t2,
				testServer,
				endpointToTest,
				&dto.CreateUserRequestPayload{},
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

		t1.Run("14. returns 400 when turnstile token header is empty", func(t2 *testing.T) {
			response, responseBody := test.SendPostRequest(
				t2,
				testServer,
				endpointToTest,
				&dto.CreateUserRequestPayload{},
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

		t1.Run("15. sends account verification email", func(t2 *testing.T) {
			createUserRequestPayload := &dto.CreateUserRequestPayload{
				Email:       gofakeit.Email(),
				Password:    data.NewUserPassword,
				DisplayName: gofakeit.Name(),
			}

			gock.New("https://api.resend.com").
				Post("/emails").
				AddMatcher(test.CreateRequestBodyMatcherFunc(func(requestBody map[string]any) {
					require.Equal(t2, []any{createUserRequestPayload.Email}, requestBody["to"])
					require.Equal(t2, "Account verification", requestBody["subject"])
					require.Equal(t2, "Cloudy Clip <no-reply@cloudyclip.com>", requestBody["from"])
					require.Empty(t2, requestBody["text"])

					htmlBody := requestBody["html"]
					require.NotContains(t2, "{{.HostName}}", htmlBody)
					require.NotContains(t2, "{{.EmailVerificationLink}}", htmlBody)
					require.Contains(
						t2,
						htmlBody,
						environment.Config.AccessControlAllowOrigin+"/images/cloudy-clip-bg-transparent.png",
					)
					require.Contains(t2, htmlBody, "Hi "+createUserRequestPayload.DisplayName+",")
					require.Contains(t2, htmlBody, "Thank you for registering an account with Cloudy Clip!")

					require.Regexp(
						t2,
						regexp.MustCompile(`.*To complete your registration, please verify your email\s+address by clicking on the following link:.*`),
						htmlBody,
					)
					require.Contains(
						t2,
						htmlBody,
						environment.Config.AccessControlAllowOrigin+"/account/registration/verification?code=",
					)
					require.Regexp(t2, regexp.MustCompile(`.*/registration/verification\?code=[A-Z0-9]+".*`), htmlBody)
					require.Contains(t2, htmlBody, "Please note that this link will expire in 30 minutes.")
					require.Contains(t2, htmlBody, "If you did not initiate this account registration request,")
					require.Contains(t2, htmlBody, "please ignore this email.")
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

			response, _ := test.SendPostRequest(
				t2,
				testServer,
				endpointToTest,
				createUserRequestPayload,
				map[string]string{
					turnstile.TurnstileTokenHeader: "turnstile",
				},
			)

			require.Equal(t2, http.StatusCreated, response.StatusCode)
		})
	})
}
