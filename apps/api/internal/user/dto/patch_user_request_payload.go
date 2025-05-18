package dto

type PatchUserRequestPayload struct {
	Email           string `json:"email,omitempty" validate:"omitempty,email,max=64"`
	NewPassword     string `json:"newPassword,omitempty" validate:"omitempty,mixedCase,containNumbers,min=8,max=64"`
	CurrentPassword string `json:"currentPassword" validate:"required"`
	DisplayName     string `json:"displayName,omitempty" validate:"omitempty,max=32"`
}
