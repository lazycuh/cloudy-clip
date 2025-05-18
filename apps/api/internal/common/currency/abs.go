package currency

func Abs(value int64) int64 {
	if value < 0 {
		return value * -1
	}

	return value
}
