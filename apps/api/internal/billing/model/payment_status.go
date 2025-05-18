package model

import (
	"encoding/json"

	"github.com/pkg/errors"
)

type PaymentStatus byte

const (
	PaymentStatusDraft PaymentStatus = iota
	PaymentStatusPaid
	PaymentStatusFailed
	PaymentStatusPastDue
	PaymentStatusRefundInProgress
	PaymentStatusRefunded
	PaymentStatusFailedRefund
)

func (status PaymentStatus) MarshalJSON() ([]byte, error) {
	return []byte(`"` + status.String() + `"`), nil
}

func (status PaymentStatus) String() string {
	switch status {
	case PaymentStatusDraft:
		return "DRAFT"
	case PaymentStatusPaid:
		return "PAID"
	case PaymentStatusFailed:
		return "FAILED"
	case PaymentStatusPastDue:
		return "PAST_DUE"
	case PaymentStatusRefundInProgress:
		return "REFUND_IN_PROGRESS"
	case PaymentStatusRefunded:
		return "REFUNDED"
	case PaymentStatusFailedRefund:
		return "FAILED_REFUND"
	}

	panic(errors.Errorf("unknown payment status type '%d'", status))
}

func (status *PaymentStatus) UnmarshalJSON(buf []byte) error {
	var statusString string
	err := json.Unmarshal(buf, &statusString)
	if err != nil {
		return err
	}

	switch statusString {
	case "DRAFT":
		*status = PaymentStatusDraft
	case "PAID":
		*status = PaymentStatusPaid
	case "FAILED":
		*status = PaymentStatusFailed
	case "PAST_DUE":
		*status = PaymentStatusPastDue
	case "REFUND_IN_PROGRESS":
		*status = PaymentStatusRefundInProgress
	case "REFUNDED":
		*status = PaymentStatusRefunded
	case "FAILED_REFUND":
		*status = PaymentStatusFailedRefund
	}

	return errors.New("unknown payment status '" + statusString + "'")
}
