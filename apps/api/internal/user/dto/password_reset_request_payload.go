package dto

type PasswordResetRequestPayload struct {
	Email string `json:"email" validate:"required,email,max=64"`
}
