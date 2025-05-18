package dto

import (
	_jetModel "github.com/cloudy-clip/api/internal/common/database/.jet/model"
	"github.com/cloudy-clip/api/internal/subscription/model"
)

type Plan struct {
	PlanId          string        `json:"planId"`
	DisplayName     string        `json:"displayName"`
	Entitlements    []Entitlement `json:"entitlements"`
	OfferingId      string        `json:"offeringId"`
	Price           string        `json:"price"`
	DiscountedPrice string        `json:"discountedPrice"`
	RenewedIn       string        `json:"renewedIn"`
}

type Entitlement struct {
	IsRestricted bool   `json:"isRestricted"`
	Type         string `json:"type"`
	Quantity     int    `json:"quantity"`
}

func NewPlan(planOffering _jetModel.PlanOffering, planEntitlementModels []model.PlanEntitlement) Plan {
	planEntitlementModel := planEntitlementModels[0]

	plan := Plan{
		PlanId:          planOffering.PlanID,
		DisplayName:     planEntitlementModel.PlanDisplayName,
		Entitlements:    make([]Entitlement, 0, len(planEntitlementModels)),
		OfferingId:      planOffering.PlanOfferingID,
		Price:           planOffering.Price,
		DiscountedPrice: planOffering.DiscountedPrice,
		RenewedIn:       planOffering.RenewedIn,
	}

	for _, planEntitlementModel := range planEntitlementModels {
		plan.Entitlements = append(plan.Entitlements, Entitlement{
			Type:         planEntitlementModel.Type,
			IsRestricted: planEntitlementModel.IsRestricted,
			Quantity:     planEntitlementModel.Quantity,
		})
	}

	return plan
}
