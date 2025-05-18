package currency

func Min(first, second int64) int64 {
	if first < second {
		return first
	}

	return second
}
