package dto

import "github.com/cloudy-clip/api/internal/user/model"

type Oauth2SignInRequestPayload struct {
	UserId      string               `json:"userId"`
	Email       string               `json:"email"`
	AuthToken   string               `json:"authToken"`
	DisplayName string               `json:"displayName"`
	Provider    model.Oauth2Provider `json:"provider"`
}
