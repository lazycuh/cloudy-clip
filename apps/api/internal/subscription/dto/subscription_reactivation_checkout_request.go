package dto

type SubscriptionReactivationCheckoutRequest struct {
	PaymentMethodId string `json:"paymentMethodId" validate:"max=64"`
}
