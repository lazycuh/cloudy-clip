package currency

import (
	"testing"

	"github.com/stretchr/testify/require"
	"github.com/cloudy-clip/api/internal/common/currency"
)

func TestMin(t *testing.T) {
	t.Run("1. returns correct min value", func(t2 *testing.T) {
		require.Equal(t2, int64(1), currency.Min(1, 2))
		require.Equal(t2, int64(5), currency.Min(6, 5))
	})
}
