package plan

import "github.com/cloudy-clip/api/internal/common/environment"

func IsFreePlan(offeringId string) bool {
	priceId := GetPriceIdByOfferingId(offeringId)

	return priceId == environment.Config.PriceIdFreeMonthly ||
		priceId == environment.Config.PriceIdFreeYearly
}
