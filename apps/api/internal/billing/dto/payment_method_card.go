package dto

type PaymentMethodCard struct {
	ExpMonth  string
	ExpYear   string
	Last4     string
	Brand     string
	IsDefault bool
}
