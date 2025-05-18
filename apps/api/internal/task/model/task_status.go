package model

import (
	"encoding/json"

	"github.com/pkg/errors"
)

type TaskStatus byte

const (
	TaskStatusInProgress TaskStatus = iota
	TaskStatusSuccess
	TaskStatusFailure
)

func (status TaskStatus) MarshalJSON() ([]byte, error) {
	return []byte(`"` + status.String() + `"`), nil
}

func (status TaskStatus) String() string {
	switch status {
	case TaskStatusInProgress:
		return "IN_PROGRESS"
	case TaskStatusSuccess:
		return "SUCCESS"
	case TaskStatusFailure:
		return "FAILURE"
	}

	panic(errors.Errorf("unknown task status '%d'", status))
}

func (status *TaskStatus) UnmarshalJSON(buf []byte) error {
	var statusString string
	err := json.Unmarshal(buf, &statusString)
	if err != nil {
		return err
	}

	switch statusString {
	case "IN_PROGRESS":
		*status = TaskStatusInProgress
	case "SUCCESS":
		*status = TaskStatusSuccess
	case "FAILURE":
		*status = TaskStatusFailure
	default:
		return errors.New("unknown task status '" + statusString + "'")
	}

	return nil
}
