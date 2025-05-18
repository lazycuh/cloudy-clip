package currency

import "strconv"

func FormatInt(value int64) string {
	return strconv.FormatInt(value, 10)
}
