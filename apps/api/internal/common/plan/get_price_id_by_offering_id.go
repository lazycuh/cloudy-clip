package plan

import (
	"fmt"

	"github.com/cloudy-clip/api/internal/common/environment"
)

func GetPriceIdByOfferingId(offeringId string) environment.PriceId {
	switch offeringId {
	case "01J9FAJGRYSF5Y1338HSE07SB8":
		return environment.Config.PriceIdFreeMonthly
	case "01J9FNB8FZ2XT4NVF9BPQP7Q5G":
		return environment.Config.PriceIdFreeYearly
	case "01J9FAJQBCAFBCG5ZV0JE1NDJA":
		return environment.Config.PriceIdLiteMonthly
	case "01J9FNBNXCHKKC8686BDM19C59":
		return environment.Config.PriceIdLiteYearly
	case "01J9FAJY010PPGWYABP8VSSHCV":
		return environment.Config.PriceIdEssentialMonthly
	case "01J9FNBYVG59GCHESE64WTG30W":
		return environment.Config.PriceIdEssentialYearly
	default:
		panic(fmt.Errorf("unknown offering ID '%s'", offeringId))
	}
}
