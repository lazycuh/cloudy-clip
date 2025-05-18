package plan

import (
	"fmt"

	"github.com/cloudy-clip/api/internal/common/environment"
)

func GetOfferingIdByPriceId(priceId environment.PriceId) string {
	switch priceId {
	case environment.Config.PriceIdFreeMonthly:
		return "01J9FAJGRYSF5Y1338HSE07SB8"
	case environment.Config.PriceIdFreeYearly:
		return "01J9FNB8FZ2XT4NVF9BPQP7Q5G"
	case environment.Config.PriceIdLiteMonthly:
		return "01J9FAJQBCAFBCG5ZV0JE1NDJA"
	case environment.Config.PriceIdLiteYearly:
		return "01J9FNBNXCHKKC8686BDM19C59"
	case environment.Config.PriceIdEssentialMonthly:
		return "01J9FAJY010PPGWYABP8VSSHCV"
	case environment.Config.PriceIdEssentialYearly:
		return "01J9FNBYVG59GCHESE64WTG30W"
	default:
		panic(fmt.Errorf("unknown price ID '%s'", priceId))
	}
}
