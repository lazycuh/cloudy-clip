package dto

type LoginRequestPayload struct {
	Email    string `json:"email" validate:"required,email,max=64"`
	Password string `json:"password" validate:"required,max=64"`
}
