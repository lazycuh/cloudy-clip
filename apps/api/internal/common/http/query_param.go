package http

import (
	"fmt"
	"net/url"
	"strconv"

	"github.com/pkg/errors"
	"github.com/cloudy-clip/api/internal/common/exception"
)

func GetQueryParamOrDefault(queryParams url.Values, paramName string, defaultValue string) string {
	paramValue := queryParams.Get(paramName)
	if paramValue == "" {
		return defaultValue
	}

	return paramValue
}

func GetQueryParam(queryParams url.Values, paramName string) (string, error) {
	paramValue := queryParams.Get(paramName)
	if paramValue == "" {
		return "",
			errors.WithStack(
				exception.NewValidationException(fmt.Sprintf("'%s' query param is missing or empty", paramName)),
			)
	}

	return paramValue, nil
}

func GetQueryParamAsInt64(queryParams url.Values, paramName string) (int64, error) {
	paramValue, err := GetQueryParam(queryParams, paramName)
	if err != nil {
		return 0, err
	}

	value, err := strconv.ParseInt(paramValue, 10, 64)
	if err == nil {
		return value, nil
	}

	return 0, errors.WithStack(exception.NewValidationExceptionWithExtra(
		"cannot parse '"+paramName+"' as integer",
		map[string]any{
			paramName: paramValue,
		},
	))
}
