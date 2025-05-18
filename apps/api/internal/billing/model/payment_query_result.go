package model

import (
	"time"
)

type PaymentQueryResult struct {
	PaymentId          string         `db:"payment_id"`
	Subtotal           string         `db:"subtotal"`
	Discount           string         `db:"discount"`
	Tax                string         `db:"tax"`
	AmountDue          string         `db:"amount_due"`
	CurrencyCode       string         `db:"currency_code"`
	PaidAt             time.Time      `db:"paid_at"`
	Status             PaymentStatus  `db:"status"`
	FailureReason      *string        `db:"failure_reason"`
	PaymentReason      *PaymentReason `db:"payment_reason"`
	PaymentMethodLast4 *string        `db:"payment_method_last4"`
	PaymentMethodBrand *string        `db:"payment_method_brand"`
}
