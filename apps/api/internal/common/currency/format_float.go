package currency

import "strconv"

func FormatFloat(value float64) string {
	return strconv.FormatFloat(value, 'f', 4, 64)
}
