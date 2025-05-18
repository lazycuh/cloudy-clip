package dto

type ResetPasswordRequestPayload struct {
	Password         string `json:"password" validate:"required,mixedCase,min=8,max=64"`
	VerificationCode string `json:"verificationCode" validate:"required"`
}
