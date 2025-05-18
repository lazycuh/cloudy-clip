package exception

import (
	"net/http"

	"github.com/cloudy-clip/api/internal/common/exception"
	"github.com/cloudy-clip/api/internal/user/model"
)

type UserIsBlockedException struct {
	exception.ApplicationException
}

func NewUserIsBlockedException(reason model.UserStatusReason) UserIsBlockedException {
	return NewUserIsBlockedExceptionWithExtra(reason, nil)
}

func NewUserIsBlockedExceptionWithExtra(reason model.UserStatusReason, extra map[string]any) UserIsBlockedException {
	if extra == nil {
		extra = make(map[string]any)
	}

	extra["reason"] = reason

	applicationException := exception.ApplicationException{
		Message:    "user is blocked",
		StatusCode: http.StatusForbidden,
		Extra:      extra,
	}

	return UserIsBlockedException{
		applicationException,
	}
}
