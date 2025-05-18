package model

import (
	"time"
)

type VerificationType byte

const (
	VerificationTypeAccountVerification VerificationType = iota + 1
	VerificationTypePasswordReset
)

type VerificationCodeQueryResult struct {
	VerificationCodeId string           `db:"verification_code_id"`
	UserId             string           `db:"user_id"`
	CreatedAt          time.Time        `db:"created_at"`
	Email              string           `db:"email"`
	UserDisplayName    string           `db:"display_name"`
	VerificationType   VerificationType `db:"verification_type"`
}

func (verificationCodeQueryResult *VerificationCodeQueryResult) IsExpired() bool {
	return time.Since(verificationCodeQueryResult.CreatedAt).Minutes() >= 30
}
