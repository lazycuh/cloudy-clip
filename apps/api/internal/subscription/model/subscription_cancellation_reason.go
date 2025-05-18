package model

import (
	"encoding/json"

	"github.com/pkg/errors"
)

type SubscriptionCancellationReason byte

const (
	SubscriptionCancellationReasonRequestedByUser SubscriptionCancellationReason = iota
	SubscriptionCancellationReasonPaymentFailed
	SubscriptionCancellationReasonPaymentDisputed
)

func (status SubscriptionCancellationReason) MarshalJSON() ([]byte, error) {
	return []byte(`"` + status.String() + `"`), nil
}

func (status SubscriptionCancellationReason) String() string {
	switch status {
	case SubscriptionCancellationReasonRequestedByUser:
		return "REQUESTED_BY_USER"
	case SubscriptionCancellationReasonPaymentFailed:
		return "PAYMENT_FAILED"
	case SubscriptionCancellationReasonPaymentDisputed:
		return "PAYMENT_DISPUTED"
	}

	panic(errors.Errorf("unknown subscription cancellation reason '%d'", status))
}

func (reason *SubscriptionCancellationReason) UnmarshalJSON(buf []byte) error {
	var reasonString string
	err := json.Unmarshal(buf, &reasonString)
	if err != nil {
		return err
	}

	switch reasonString {
	case "REQUESTED_BY_USER":
		*reason = SubscriptionCancellationReasonRequestedByUser
	case "PAYMENT_FAILED":
		*reason = SubscriptionCancellationReasonPaymentFailed
	case "PAYMENT_DISPUTED":
		*reason = SubscriptionCancellationReasonPaymentDisputed
	default:
		return errors.New("unknown subscription cancellation reason '" + reasonString + "'")
	}

	return nil
}
