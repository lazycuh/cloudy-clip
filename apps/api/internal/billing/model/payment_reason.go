package model

import (
	"encoding/json"
	"errors"
	"fmt"
)

type PaymentReason byte

const (
	PaymentReasonUnknown PaymentReason = iota
	PaymentReasonSubscriptionCancellation
	PaymentReasonNewSubscription
	PaymentReasonSubscriptionReactivation
	PaymentReasonSubscriptionRenewal
	PaymentReasonSubscriptionUpgrade
	PaymentReasonSubscriptionDowngrade
)

func (reason PaymentReason) MarshalJSON() ([]byte, error) {
	return []byte(`"` + reason.String() + `"`), nil
}

func (reason PaymentReason) String() string {
	switch reason {
	case PaymentReasonSubscriptionCancellation:
		return "SUBSCRIPTION_CANCELLATION"
	case PaymentReasonNewSubscription:
		return "NEW_SUBSCRIPTION"
	case PaymentReasonSubscriptionReactivation:
		return "SUBSCRIPTION_REACTIVATION"
	case PaymentReasonSubscriptionRenewal:
		return "SUBSCRIPTION_RENEWAL"
	case PaymentReasonSubscriptionUpgrade:
		return "SUBSCRIPTION_UPGRADE"
	case PaymentReasonSubscriptionDowngrade:
		return "SUBSCRIPTION_DOWNGRADE"
	case PaymentReasonUnknown:
		return "UNKNOWN"
	}

	panic(fmt.Sprintf("unknown payment status type '%d'", reason))
}

func (reason *PaymentReason) UnmarshalJSON(buf []byte) error {
	var reasonString string
	err := json.Unmarshal(buf, &reasonString)
	if err != nil {
		return err
	}

	switch reasonString {
	case "SUBSCRIPTION_CANCELLATION":
		*reason = PaymentReasonSubscriptionCancellation
	case "NEW_SUBSCRIPTION":
		*reason = PaymentReasonNewSubscription
	case "SUBSCRIPTION_REACTIVATION":
		*reason = PaymentReasonSubscriptionReactivation
	case "SUBSCRIPTION_RENEWAL":
		*reason = PaymentReasonSubscriptionRenewal
	case "SUBSCRIPTION_UPGRADE":
		*reason = PaymentReasonSubscriptionUpgrade
	case "SUBSCRIPTION_DOWNGRADE":
		*reason = PaymentReasonSubscriptionDowngrade
	case "UNKNOWN":
		*reason = PaymentReasonUnknown
	}

	return errors.New("unknown payment reason '" + reasonString + "'")
}
