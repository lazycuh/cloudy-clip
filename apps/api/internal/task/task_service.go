package task

import (
	"context"
	"log/slog"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/cloudy-clip/api/internal/common/database"
	_jetModel "github.com/cloudy-clip/api/internal/common/database/.jet/model"
	"github.com/cloudy-clip/api/internal/common/environment"
	"github.com/cloudy-clip/api/internal/common/exception"
	"github.com/cloudy-clip/api/internal/common/jwt"
	_logger "github.com/cloudy-clip/api/internal/common/logger"
	"github.com/cloudy-clip/api/internal/common/ulid"
	"github.com/cloudy-clip/api/internal/task/dto"
	"github.com/cloudy-clip/api/internal/task/model"
)

var (
	taskServiceLogger *_logger.Logger
)

type TaskService struct {
}

func NewTaskService() *TaskService {
	taskServiceLogger = _logger.NewLogger(
		"TaskService",
		slog.Level(environment.Config.ApplicationLogLevel),
	)

	return &TaskService{}
}

func (taskService *TaskService) AddTask(
	ctx context.Context,
	transaction pgx.Tx,
	taskType model.TaskType,
	userId string,
) (string, error) {
	taskId, err := ulid.Generate()
	if err == nil {
		return taskId, taskRepository.AddTask(
			ctx,
			transaction,
			_jetModel.Task{
				TaskID:    taskId,
				Type:      taskType,
				Status:    model.TaskStatusInProgress,
				UpdatedAt: time.Now(),
				UserID:    userId,
			},
		)
	}

	return "", err
}

func (taskService *TaskService) GetTask(ctx context.Context, taskId string) (dto.Task, exception.Exception) {
	taskModel, err := taskRepository.findTaskById(ctx, taskId)
	if err == nil {
		return dto.NewTask(taskModel), nil
	}

	taskServiceLogger.ErrorAttrs(
		ctx,
		err,
		"failed to find task",
		slog.String("userEmail", jwt.GetUserEmailClaim(ctx)),
		slog.String("taskId", taskId),
	)

	if database.IsEmptyResultError(err) {
		return dto.Task{}, exception.NewNotFoundException("no task was found")
	}

	return dto.Task{}, exception.NewUnknownException("failed to find task")
}
