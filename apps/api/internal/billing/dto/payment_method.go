package dto

import (
	"github.com/cloudy-clip/api/internal/common/database/.jet/model"
)

type PaymentMethod struct {
	PaymentMethodId string `json:"paymentMethodId,omitempty"`
	ExpMonth        string `json:"expMonth"`
	ExpYear         string `json:"expYear"`
	Last4           string `json:"last4"`
	Brand           string `json:"brand"`
	IsDefault       bool   `json:"isDefault"`
}

func NewPaymentMethod(paymentMethodModel model.PaymentMethod) PaymentMethod {
	return PaymentMethod{
		PaymentMethodId: paymentMethodModel.PaymentMethodID,
		ExpMonth:        paymentMethodModel.ExpMonth,
		ExpYear:         paymentMethodModel.ExpYear,
		Last4:           paymentMethodModel.Last4,
		Brand:           paymentMethodModel.Brand,
		IsDefault:       paymentMethodModel.IsDefault,
	}
}
