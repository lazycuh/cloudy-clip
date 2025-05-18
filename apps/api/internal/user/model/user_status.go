package model

import (
	"encoding/json"

	"github.com/pkg/errors"
)

type UserStatus byte

const (
	UserStatusUnverified UserStatus = iota
	UserStatusActive
	UserStatusInactive
	UserStatusBlocked
	UserStatusPermanentlyBlocked
)

func (userStatus UserStatus) MarshalJSON() ([]byte, error) {
	return []byte(`"` + userStatus.String() + `"`), nil
}

func (userStatus UserStatus) String() string {
	switch userStatus {
	case UserStatusUnverified:
		return "UNVERIFIED"
	case UserStatusActive:
		return "ACTIVE"
	case UserStatusBlocked:
		return "BLOCKED"
	case UserStatusInactive:
		return "INACTIVE"
	case UserStatusPermanentlyBlocked:
		return "PERMANENTLY_BLOCKED"
	}

	panic(errors.Errorf("unknown user status '%d'", userStatus))
}

func (status *UserStatus) UnmarshalJSON(buf []byte) error {
	var statusString string
	err := json.Unmarshal(buf, &statusString)
	if err != nil {
		return err
	}

	switch statusString {
	case "UNVERIFIED":
		*status = UserStatusUnverified
	case "ACTIVE":
		*status = UserStatusActive
	case "BLOCKED":
		*status = UserStatusBlocked
	case "INACTIVE":
		*status = UserStatusInactive
	case "PERMANENTLY_BLOCKED":
		*status = UserStatusPermanentlyBlocked
	default:
		return errors.New("unknown user status '" + statusString + "'")
	}

	return nil
}
