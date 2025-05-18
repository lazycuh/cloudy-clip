package currency

import (
	"testing"

	"github.com/stretchr/testify/require"
	"github.com/cloudy-clip/api/internal/common/currency"
)

func TestFormatFloat(t *testing.T) {
	t.Run("1. returns float with 4 decimal places", func(t2 *testing.T) {
		require.Equal(t2, "1.0000", currency.FormatFloat(1))
		require.Equal(t2, "10.1200", currency.FormatFloat(10.12))
		require.Equal(t2, "10.1234", currency.FormatFloat(10.1234))
	})
}
