package task

import (
	"context"
	"time"

	jet "github.com/go-jet/jet/v2/postgres"
	"github.com/jackc/pgx/v5"
	"github.com/cloudy-clip/api/internal/common/database"
	_jetModel "github.com/cloudy-clip/api/internal/common/database/.jet/model"
	"github.com/cloudy-clip/api/internal/common/database/.jet/table"
	"github.com/cloudy-clip/api/internal/task/model"
)

const (
	TaskTable = "tbl_task"
)

type TaskRepository struct {
}

func NewTaskRepository() *TaskRepository {
	return &TaskRepository{}
}

func (taskRepository *TaskRepository) AddTask(
	ctx context.Context,
	transaction pgx.Tx,
	taskModel _jetModel.Task,
) error {
	queryBuilder := table.TaskTable.
		INSERT(table.TaskTable.AllColumns).
		MODEL(taskModel)

	return database.ExecTx(ctx, transaction, queryBuilder)
}

func (taskRepository *TaskRepository) findTaskById(
	ctx context.Context,
	taskId string,
) (_jetModel.Task, error) {
	queryBuilder := table.TaskTable.
		SELECT(table.TaskTable.AllColumns.As("")).
		WHERE(table.TaskTable.TaskID.EQ(jet.String(taskId))).
		LIMIT(1)

	return database.SelectOne[_jetModel.Task](ctx, queryBuilder)
}

func (taskRepository *TaskRepository) MarkTaskAsSuccessful(
	ctx context.Context,
	transaction pgx.Tx,
	taskId string,
) error {
	return taskRepository.updateTaskStatusById(ctx, transaction, taskId, model.TaskStatusSuccess)
}

func (taskRepository *TaskRepository) updateTaskStatusById(
	ctx context.Context,
	transaction pgx.Tx,
	taskId string,
	taskStatus model.TaskStatus,
) error {
	taskTable := table.TaskTable
	queryBuilder := taskTable.
		UPDATE(taskTable.Status, taskTable.UpdatedAt).
		SET(taskStatus, time.Now()).
		WHERE(
			taskTable.TaskID.EQ(jet.String(taskId)).
				AND(taskTable.Status.EQ(jet.Int16(int16(model.TaskStatusInProgress)))),
		)

	if transaction != nil {
		return database.ExecTx(ctx, transaction, queryBuilder)
	}

	return database.Exec(ctx, queryBuilder)
}

func (taskRepository *TaskRepository) MarkTaskAsFailed(
	ctx context.Context,
	transaction pgx.Tx,
	taskId string,
) error {
	return taskRepository.updateTaskStatusById(ctx, transaction, taskId, model.TaskStatusFailure)
}
