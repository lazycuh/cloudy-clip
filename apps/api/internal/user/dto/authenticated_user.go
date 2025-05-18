package dto

import (
	"time"

	_jetModel "github.com/cloudy-clip/api/internal/common/database/.jet/model"
	"github.com/cloudy-clip/api/internal/subscription/dto"
	"github.com/cloudy-clip/api/internal/user/model"
)

type AuthenticatedUser struct {
	Email                 string                 `json:"email"`
	Status                model.UserStatus       `json:"status"`
	StatusReason          model.UserStatusReason `json:"statusReason"`
	DisplayName           string                 `json:"displayName"`
	Provider              model.Oauth2Provider   `json:"provider"`
	LastLoggedInAt        time.Time              `json:"lastLoggedInAt"`
	CreatedAt             time.Time              `json:"createdAt"`
	UpdatedAt             time.Time              `json:"updatedAt"`
	AccessToken           string                 `json:"-"`
	AccessTokenExpiration time.Time              `json:"-"`
	Session               *UserSession           `json:"-"`
	Subscription          *dto.Subscription      `json:"subscription"`
}

func NewAuthenticatedUser(
	userModel *_jetModel.User,
	accessToken string,
	accessTokenExpiration time.Time,
	session *UserSession,
) *AuthenticatedUser {
	return &AuthenticatedUser{
		Email:                 userModel.Email,
		Status:                userModel.Status,
		StatusReason:          userModel.StatusReason,
		DisplayName:           userModel.DisplayName,
		LastLoggedInAt:        userModel.LastLoggedInAt,
		CreatedAt:             userModel.CreatedAt,
		UpdatedAt:             userModel.UpdatedAt,
		Provider:              userModel.Provider,
		AccessToken:           accessToken,
		AccessTokenExpiration: accessTokenExpiration,
		Session:               session,
	}
}
