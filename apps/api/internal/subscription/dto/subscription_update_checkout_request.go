package dto

type SubscriptionUpdateCheckoutRequest struct {
	OfferingId      string `json:"offeringId" validate:"required,len=26"`
	PaymentMethodId string `json:"paymentMethodId" validate:"required,max=64"`
}
