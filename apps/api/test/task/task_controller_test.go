package task

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/jackc/pgx/v5"
	"github.com/stretchr/testify/require"
	"github.com/cloudy-clip/api/internal/common/database"
	"github.com/cloudy-clip/api/internal/task"
	"github.com/cloudy-clip/api/internal/task/model"
	"github.com/cloudy-clip/api/test/debug"
	test "github.com/cloudy-clip/api/test/utils"
)

func TestTaskController(t1 *testing.T) {
	test.Integration(t1, func(testServer *httptest.Server) {
		sessionCookie, testUser := test.CreateAndLoginUser(t1, testServer)

		t1.Run("1. can get task by ID", func(t2 *testing.T) {
			var taskId string
			_ = database.UseTransaction(context.Background(), func(transaction pgx.Tx) error {
				taskIdResult, err := task.
					GetTaskService().
					AddTask(
						context.Background(),
						transaction,
						model.TaskTypeNewSubscriptionPayment,
						testUser.UserId,
					)

				if err != nil {
					panic(err)
				}

				taskId = taskIdResult

				return nil
			})

			response, responseBody := test.SendGetRequest(
				t2,
				testServer,
				"/api/v1/tasks/"+taskId,
				map[string]string{
					"Cookie": sessionCookie,
				},
			)

			require.Equal(t2, http.StatusOK, response.StatusCode)
			require.Subset(
				t2,
				responseBody["payload"],
				debug.JsonParse(`
						{
							"status": "IN_PROGRESS",
							"type": "NEW_SUBSCRIPTION_PAYMENT",
							"comment": null
						}
					`,
				),
			)
			require.NotEmpty(t2, responseBody["payload"], "updatedAt")
		})

		t1.Run("2. 404 when no task is found", func(t2 *testing.T) {
			response, responseBody := test.SendGetRequest(
				t2,
				testServer,
				"/api/v1/tasks/not-found-task-id",
				map[string]string{
					"Cookie": sessionCookie,
				},
			)

			require.Equal(t2, http.StatusNotFound, response.StatusCode)
			require.Equal(
				t2,
				"no task was found",
				responseBody["message"],
			)
		})

	})

}
