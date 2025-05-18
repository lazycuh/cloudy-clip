package test

func GetValueFromMap(source any, keys ...string) any {
	sourceMap, ok := source.(map[string]any)
	if !ok {
		panic("source must be a map[string]any")
	}

	if len(keys) == 0 {
		panic("at least one key must be provided")
	}

	value := sourceMap[keys[0]]
	for _, key := range keys[1:] {
		if nestedMap, ok := value.(map[string]any); ok {
			value = nestedMap[key]
		}
	}

	return value
}
