package dto

import (
	"time"

	_jetModel "github.com/cloudy-clip/api/internal/common/database/.jet/model"
	model "github.com/cloudy-clip/api/internal/task/model"
)

type Task struct {
	Type      model.TaskType   `json:"type"`
	Status    model.TaskStatus `json:"status"`
	UpdatedAt time.Time        `json:"updatedAt"`
	Comment   *string          `json:"comment"`
}

func NewTask(taskModel _jetModel.Task) Task {
	return Task{
		Type:      taskModel.Type,
		Status:    taskModel.Status,
		UpdatedAt: taskModel.UpdatedAt,
		Comment:   taskModel.Comment,
	}

}
