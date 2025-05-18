package dto

import (
	"time"

	"github.com/stripe/stripe-go/v79"
	"github.com/cloudy-clip/api/internal/common/currency"
)

type UpcomingPayment struct {
	Subtotal      string    `json:"subtotal"`
	Tax           string    `json:"tax"`
	TaxPercentage string    `json:"taxPercentage"`
	Discount      string    `json:"discount"`
	AmountDue     string    `json:"amountDue"`
	CurrencyCode  string    `json:"currencyCode"`
	DueDate       time.Time `json:"dueDate"`
}

func NewUpcomingPayment(invoice *stripe.Invoice, taxPercentage string) UpcomingPayment {
	upcomingPayment := UpcomingPayment{
		Subtotal:      currency.FormatInt(invoice.SubtotalExcludingTax),
		Discount:      "0",
		Tax:           currency.FormatInt(invoice.Tax),
		TaxPercentage: taxPercentage,
		AmountDue:     currency.FormatInt(invoice.Total),
		CurrencyCode:  string(invoice.Currency),
		DueDate:       time.Unix(invoice.NextPaymentAttempt, 0),
	}

	if invoice.Discount != nil {
		upcomingPayment.Discount = currency.FormatInt(invoice.Discount.Coupon.AmountOff)
	}

	return upcomingPayment

}
