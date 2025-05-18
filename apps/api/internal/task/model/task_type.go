package model

import (
	"encoding/json"
	"errors"
)

type TaskType string

const (
	TaskTypeNewSubscriptionPayment    TaskType = "NEW_SUBSCRIPTION_PAYMENT"
	TaskTypeSubscriptionUpdatePayment TaskType = "SUBSCRIPTION_UPDATE_PAYMENT"
	TaskTypeReactivationPayment       TaskType = "REACTIVATION_PAYMENT"
	TaskTypeSubscriptionCancellation  TaskType = "SUBSCRIPTION_CANCELLATION"
)

func (taskType TaskType) MarshalJSON() ([]byte, error) {
	return []byte(`"` + taskType.String() + `"`), nil
}

func (taskType TaskType) String() string {
	return string(taskType)
}

func (taskType *TaskType) UnmarshalJSON(buf []byte) error {
	var taskTypeString string
	err := json.Unmarshal(buf, &taskTypeString)
	if err != nil {
		return err
	}

	switch taskTypeString {
	case "NEW_SUBSCRIPTION_PAYMENT":
		*taskType = TaskTypeNewSubscriptionPayment
	case "SUBSCRIPTION_UPDATE_PAYMENT":
		*taskType = TaskTypeSubscriptionUpdatePayment
	case "REACTIVATION_PAYMENT":
		*taskType = TaskTypeReactivationPayment
	case "SUBSCRIPTION_CANCELLATION":
		*taskType = TaskTypeSubscriptionCancellation
	default:
		return errors.New("unknown task type '" + taskTypeString + "'")
	}

	return nil
}
