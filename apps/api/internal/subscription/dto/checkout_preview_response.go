package dto

import (
	"github.com/stripe/stripe-go/v79"
	billingDto "github.com/cloudy-clip/api/internal/billing/dto"
	"github.com/cloudy-clip/api/internal/common/currency"
)

type CheckoutPreviewResponse struct {
	Subtotal             string                     `json:"subtotal"`
	Discount             string                     `json:"discount"`
	Tax                  string                     `json:"tax"`
	TaxPercentage        string                     `json:"taxPercentage"`
	Refund               string                     `json:"refund"`
	AmountDue            string                     `json:"amountDue"`
	CurrencyCode         string                     `json:"currencyCode"`
	StoredPaymentMethods []billingDto.PaymentMethod `json:"storedPaymentMethods"`
}

func NewCheckoutPreviewResponse(
	invoice *stripe.Invoice,
	taxPercentage string,
	paymentMethods []billingDto.PaymentMethod,
) CheckoutPreviewResponse {
	checkoutPreviewResponse := CheckoutPreviewResponse{
		Subtotal:      currency.FormatInt(invoice.SubtotalExcludingTax),
		Discount:      "0",
		Tax:           currency.FormatInt(invoice.Tax),
		TaxPercentage: taxPercentage,
		// invoice.Lines.Data[0].Amount is the refunded amount if it's negative
		Refund:               currency.FormatInt(currency.Abs(currency.Min(0, invoice.Lines.Data[0].Amount))),
		AmountDue:            currency.FormatInt(invoice.Total),
		CurrencyCode:         string(invoice.Currency),
		StoredPaymentMethods: paymentMethods,
	}

	if invoice.Discount != nil {
		checkoutPreviewResponse.Discount = currency.FormatInt(invoice.Discount.Coupon.AmountOff)
	}

	return checkoutPreviewResponse
}
