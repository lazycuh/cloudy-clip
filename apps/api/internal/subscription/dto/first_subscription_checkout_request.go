package dto

type FirstSubscriptionCheckoutRequest struct {
	FullName    string `json:"fullName" validate:"required,max=64"`
	OfferingId  string `json:"offeringId" validate:"required,len=26"`
	CouponCode  string `json:"couponCode" validate:"max=64"`
	CountryCode string `json:"countryCode" validate:"required,min=2,max=4"`
	PostalCode  string `json:"postalCode" validate:"max=16"`
}
