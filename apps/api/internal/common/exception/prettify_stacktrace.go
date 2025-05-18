package exception

import (
	"fmt"
	"strings"
)

func PrettifyStacktrace(err error) []string {
	stack := strings.ReplaceAll(fmt.Sprintf("%+v", err), "\t", strings.Repeat(" ", 4))
	stacktrace := strings.Split(strings.Trim(stack, "\n"), "\n")
	stacktraceRows := make([]string, 0, (len(stacktrace)/2)+1)

	// We only want to keep the rows that show the line numbers and from our codebase
	for index, row := range stacktrace {
		if index%2 == 0 && strings.Contains(row, "cloudy-clip") {
			stacktraceRows = append(stacktraceRows, row)
		}
	}

	return stacktraceRows
}
