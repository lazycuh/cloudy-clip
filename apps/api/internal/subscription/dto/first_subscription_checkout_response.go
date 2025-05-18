package dto

import (
	"github.com/stripe/stripe-go/v79"
	"github.com/cloudy-clip/api/internal/common/currency"
)

type FirstSubscriptionCheckoutResponse struct {
	ClientSecret  string `json:"clientSecret" validate:"required"`
	Subtotal      string `json:"subtotal" validate:"required"`
	Tax           string `json:"tax" validate:"required"`
	TaxPercentage string `json:"taxPercentage" validate:"required"`
	Discount      string `json:"discount" validate:"required"`
	AmountDue     string `json:"amountDue" validate:"required"`
}

func NewFirstSubscriptionCheckoutResponse(
	invoice *stripe.Invoice,
	taxPercentage string,
	discount int64,
) FirstSubscriptionCheckoutResponse {
	return FirstSubscriptionCheckoutResponse{
		ClientSecret:  invoice.PaymentIntent.ClientSecret,
		Subtotal:      currency.FormatInt(invoice.Subtotal),
		Tax:           currency.FormatInt(invoice.Tax),
		TaxPercentage: taxPercentage,
		Discount:      currency.FormatInt(discount),
		AmountDue:     currency.FormatInt(invoice.AmountDue),
	}
}
