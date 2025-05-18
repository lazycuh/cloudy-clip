package model

import (
	"encoding/json"

	"github.com/pkg/errors"
)

type UserStatusReason byte

const (
	UserStatusReasonNone UserStatusReason = iota
	UserStatusReasonUnverifiedEmail
	UserStatusReasonTooManyFailedLoginAttempts
)

func (statusReason UserStatusReason) MarshalJSON() ([]byte, error) {
	return []byte(`"` + statusReason.String() + `"`), nil
}

func (statusReason UserStatusReason) String() string {
	switch statusReason {
	case UserStatusReasonNone:
		return ""
	case UserStatusReasonUnverifiedEmail:
		return "unverified email"
	case UserStatusReasonTooManyFailedLoginAttempts:
		return "too many failed login attempts"
	}

	panic(errors.Errorf("unknown status reason '%d'", statusReason))
}

func (statusReason *UserStatusReason) UnmarshalJSON(buf []byte) error {
	var statusReasonString string
	err := json.Unmarshal(buf, &statusReasonString)
	if err != nil {
		return err
	}

	switch statusReasonString {
	case "":
		*statusReason = UserStatusReasonNone
	case "unverified email":
		*statusReason = UserStatusReasonUnverifiedEmail
	case "too many failed login attempts":
		*statusReason = UserStatusReasonTooManyFailedLoginAttempts
	default:
		return errors.New("unknown status reason '" + statusReasonString + "'")
	}

	return nil
}
