package debug

import (
	"encoding/json"
	"fmt"
	"os"
	"strings"
)

func Debugf(format string, args ...any) {
	fmt.Println("=================")
	fmt.Printf(format+"\n", args...)
	fmt.Println("=================")
}

func PrintJson(v any) {
	b, _ := json.MarshalIndent(v, "", " ")
	Debugf("%v", string(b))
}

func JsonParseInto(input any, destination any) {
	b, _ := json.MarshalIndent(input, "", " ")

	err := json.Unmarshal(b, destination)
	if err != nil {
		panic(err)
	}
}

func JsonParse(format string, args ...any) map[string]any {
	var result map[string]any
	format = fmt.Sprintf("%v", format)

	err := json.NewDecoder(strings.NewReader(fmt.Sprintf(format, args...))).Decode(&result)
	if err != nil {
		panic(err)
	}

	return result
}

func JsonParseArray(format string, args ...any) []any {
	var result []any

	format = fmt.Sprintf("%v", format)

	err := json.Unmarshal(fmt.Appendf(nil, format, args...), &result)
	if err != nil {
		panic(err)
	}

	return result
}

func JsonStringify(data any) string {
	buf, err := json.Marshal(data)
	if err != nil {
		panic(err)
	}

	return string(buf)
}

func WriteJsonToFile(filename string, data any) {
	jsonData, err := json.MarshalIndent(data, "", "  ")
	if err != nil {
		panic(err)
	}

	err = os.WriteFile(filename, jsonData, 0644) // 0644 permissions (read/write for owner, read for others)
	if err != nil {
		panic(err)
	}
}
