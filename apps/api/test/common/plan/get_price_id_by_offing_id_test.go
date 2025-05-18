package plan

import (
	"testing"

	"github.com/stretchr/testify/require"
	"github.com/cloudy-clip/api/internal/common/environment"
	"github.com/cloudy-clip/api/internal/common/plan"
	test "github.com/cloudy-clip/api/test/utils"
)

func TestGetPriceIdByOfferingId(t *testing.T) {
	test.Test(t, func() {
		t.Run("1. returns correct price ID", func(t2 *testing.T) {
			require.Equal(
				t2,
				environment.Config.PriceIdFreeMonthly,
				plan.GetPriceIdByOfferingId("01J9FAJGRYSF5Y1338HSE07SB8"),
			)
			require.Equal(
				t2,
				environment.Config.PriceIdFreeYearly,
				plan.GetPriceIdByOfferingId("01J9FNB8FZ2XT4NVF9BPQP7Q5G"),
			)
			require.Equal(
				t2,
				environment.Config.PriceIdLiteMonthly,
				plan.GetPriceIdByOfferingId("01J9FAJQBCAFBCG5ZV0JE1NDJA"),
			)
			require.Equal(
				t2,
				environment.Config.PriceIdLiteYearly,
				plan.GetPriceIdByOfferingId("01J9FNBNXCHKKC8686BDM19C59"),
			)
			require.Equal(
				t2,
				environment.Config.PriceIdEssentialMonthly,
				plan.GetPriceIdByOfferingId("01J9FAJY010PPGWYABP8VSSHCV"),
			)
			require.Equal(
				t2,
				environment.Config.PriceIdEssentialYearly,
				plan.GetPriceIdByOfferingId("01J9FNBYVG59GCHESE64WTG30W"),
			)
		})

		t.Run("2. throws error when an unrecognized offering ID is provided", func(t2 *testing.T) {
			require.PanicsWithError(
				t2,
				"unknown offering ID 'i-am-not-an-offering-id'",
				func() {
					plan.GetPriceIdByOfferingId("i-am-not-an-offering-id")
				},
			)
		})
	})
}
