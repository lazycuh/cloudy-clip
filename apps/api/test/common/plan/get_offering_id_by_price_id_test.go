package plan

import (
	"testing"

	"github.com/stretchr/testify/require"
	"github.com/cloudy-clip/api/internal/common/environment"
	"github.com/cloudy-clip/api/internal/common/plan"
	test "github.com/cloudy-clip/api/test/utils"
)

func TestGetOfferingIdByPriceId(t *testing.T) {
	test.Test(t, func() {
		t.Run("1. returns correct offering ID", func(t2 *testing.T) {
			require.Equal(
				t2,
				"01J9FAJGRYSF5Y1338HSE07SB8",
				plan.GetOfferingIdByPriceId(environment.Config.PriceIdFreeMonthly),
			)
			require.Equal(
				t2,
				"01J9FNB8FZ2XT4NVF9BPQP7Q5G",
				plan.GetOfferingIdByPriceId(environment.Config.PriceIdFreeYearly),
			)
			require.Equal(
				t2,
				"01J9FAJQBCAFBCG5ZV0JE1NDJA",
				plan.GetOfferingIdByPriceId(environment.Config.PriceIdLiteMonthly),
			)
			require.Equal(
				t2,
				"01J9FNBNXCHKKC8686BDM19C59",
				plan.GetOfferingIdByPriceId(environment.Config.PriceIdLiteYearly),
			)
			require.Equal(
				t2,
				"01J9FAJY010PPGWYABP8VSSHCV",
				plan.GetOfferingIdByPriceId(environment.Config.PriceIdEssentialMonthly),
			)
			require.Equal(
				t2,
				"01J9FNBYVG59GCHESE64WTG30W",
				plan.GetOfferingIdByPriceId(environment.Config.PriceIdEssentialYearly),
			)
		})

		t.Run("2. throws error when an unrecognized price ID is provided", func(t2 *testing.T) {
			require.PanicsWithError(
				t2,
				"unknown price ID 'i-am-not-a-price-id'",
				func() {
					plan.GetOfferingIdByPriceId(environment.PriceId("i-am-not-a-price-id"))
				},
			)
		})

		t.Run("3. throws error when an empty price ID is provided", func(t2 *testing.T) {
			require.PanicsWithError(
				t2,
				"unknown price ID ''",
				func() {
					plan.GetOfferingIdByPriceId(environment.PriceId(""))
				},
			)
		})
	})
}
