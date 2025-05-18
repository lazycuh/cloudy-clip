package currency

import (
	"testing"

	"github.com/stretchr/testify/require"
	"github.com/cloudy-clip/api/internal/common/currency"
)

func TestFormatInt(t *testing.T) {
	t.Run("1. returns correct value", func(t2 *testing.T) {
		require.Equal(t2, "1", currency.FormatInt(1))
		require.Equal(t2, "20", currency.FormatInt(20))
		require.Equal(t2, "300", currency.FormatInt(300))
	})
}
