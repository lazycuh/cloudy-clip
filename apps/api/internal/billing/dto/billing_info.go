package dto

import _jetModel "github.com/cloudy-clip/api/internal/common/database/.jet/model"

type BillingInfo struct {
	CountryCode *string `json:"countryCode"`
	PostalCode  *string `json:"postalCode"`
}

func NewBillingInfo(billingInfoModel _jetModel.BillingInfo) BillingInfo {
	return BillingInfo{
		CountryCode: billingInfoModel.CountryCode,
		PostalCode:  billingInfoModel.PostalCode,
	}
}
