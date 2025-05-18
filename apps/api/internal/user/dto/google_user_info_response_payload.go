package dto

type GoogleUserInfoResponsePayload struct {
	Email           string `json:"email"`
	DisplayName     string `json:"name"`
	IsEmailVerified bool   `json:"verified_email"`
}
