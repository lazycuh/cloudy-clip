package currency

func Prettify(value int64) string {
	valueAsString := FormatInt(value)
	valueLength := len(valueAsString)

	if valueLength > 2 {
		return "$" + valueAsString[0:valueLength-2] + "." + valueAsString[valueLength-2:]
	}

	if valueLength == 2 {
		return "$0." + valueAsString
	}

	return "$0.0" + valueAsString
}
