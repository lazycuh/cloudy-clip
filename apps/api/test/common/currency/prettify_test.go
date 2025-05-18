package currency

import (
	"testing"

	"github.com/stretchr/testify/require"
	"github.com/cloudy-clip/api/internal/common/currency"
)

func TestPrettify(t *testing.T) {
	t.Run("1. returns correct value", func(t2 *testing.T) {
		require.Equal(t2, "$1.23", currency.Prettify(123))
		require.Equal(t2, "$12.34", currency.Prettify(1234))
		require.Equal(t2, "$123.45", currency.Prettify(12345))
		require.Equal(t2, "$0.12", currency.Prettify(12))
		require.Equal(t2, "$0.99", currency.Prettify(99))
		require.Equal(t2, "$0.01", currency.Prettify(1))
		require.Equal(t2, "$0.02", currency.Prettify(2))
	})
}
