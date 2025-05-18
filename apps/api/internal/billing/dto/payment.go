package dto

import (
	"time"

	"github.com/cloudy-clip/api/internal/billing/model"
)

type Payment struct {
	PaymentId          string               `json:"paymentId"`
	Subtotal           string               `json:"subtotal"`
	Discount           string               `json:"discount"`
	Tax                string               `json:"tax"`
	AmountDue          string               `json:"amountDue"`
	CurrencyCode       string               `json:"currencyCode"`
	PaidAt             time.Time            `json:"paidAt"`
	Status             model.PaymentStatus  `json:"status"`
	FailureReason      *string              `json:"failureReason"`
	PaymentReason      *model.PaymentReason `json:"paymentReason"`
	PaymentMethodLast4 *string              `json:"paymentMethodLast4"`
	PaymentMethodBrand *string              `json:"paymentMethodBrand"`
}

func NewPayment(paymentQueryResult model.PaymentQueryResult) Payment {
	return Payment{
		PaymentId:          paymentQueryResult.PaymentId,
		Subtotal:           paymentQueryResult.Subtotal,
		Discount:           paymentQueryResult.Discount,
		Tax:                paymentQueryResult.Tax,
		AmountDue:          paymentQueryResult.AmountDue,
		CurrencyCode:       paymentQueryResult.CurrencyCode,
		PaidAt:             paymentQueryResult.PaidAt,
		Status:             paymentQueryResult.Status,
		FailureReason:      paymentQueryResult.FailureReason,
		PaymentReason:      paymentQueryResult.PaymentReason,
		PaymentMethodLast4: paymentQueryResult.PaymentMethodLast4,
		PaymentMethodBrand: paymentQueryResult.PaymentMethodBrand,
	}
}
