package dto

import (
	"time"

	_jetModel "github.com/cloudy-clip/api/internal/common/database/.jet/model"
	"github.com/cloudy-clip/api/internal/user/model"
)

type CreateUserRequestPayload struct {
	Email       string `json:"email" validate:"required,email,max=64"`
	Password    string `json:"password" validate:"required,mixedCase,containNumbers,min=8,max=64"`
	DisplayName string `json:"displayName" validate:"required,max=32"`
}

func (payload *CreateUserRequestPayload) ToUserModel() *_jetModel.User {
	now := time.Now()

	return &_jetModel.User{
		Email:          payload.Email,
		DisplayName:    payload.DisplayName,
		Status:         model.UserStatusUnverified,
		Provider:       model.Oauth2ProviderNone,
		LastLoggedInAt: now,
		CreatedAt:      now,
		UpdatedAt:      now,
	}
}
