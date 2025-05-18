package http

import (
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"reflect"
	"strings"

	"github.com/go-playground/validator/v10"
	"github.com/pkg/errors"
	"github.com/cloudy-clip/api/internal/common/exception"
	"github.com/cloudy-clip/api/internal/common/logger"
	_validator "github.com/cloudy-clip/api/internal/common/validator"
)

var validationErrorMessageTable = map[string]string{
	"containNumbers":  "must contain at least one number",
	"email":           "invalid email",
	"max":             "must be less than or equal to {{max}}",
	"min":             "must be greater than or equal to {{min}}",
	"mixedCase":       "must contain uppercase and lowercase characters",
	"required":        "missing or empty",
	"stringLength":    "must contain exactly {{len}} characters",
	"stringMaxLength": "must contain at most {{max}} characters",
	"stringMinLength": "must contain at least {{min}} characters",
}

func ReadRequestBodyAs[T any](request *http.Request, logger *logger.Logger, dest *T) error {
	err := readRequestBodyAs(request, dest)
	if err == nil {
		return nil
	}

	if err, ok := err.(exception.ValidationException); ok {
		if logger != nil {
			logger.ErrorAttrs(
				request.Context(),
				err,
				"failed to validate request body",
				slog.Any("extra", err.Extra),
				slog.Any("requestBody", dest),
			)
		}

		return exception.GetAsApplicationException(err, err.Error())
	}

	logger.ErrorAttrs(
		request.Context(),
		err,
		"failed to read request body",
		slog.Any("requestBody", dest),
	)

	return exception.NewValidationExceptionWithExtra("failed to read request body", map[string]any{
		"rootCause": err.Error(),
	})
}

func readRequestBodyAs(request *http.Request, v any) error {
	decoder := json.NewDecoder(request.Body)
	decoder.DisallowUnknownFields()
	err := decoder.Decode(v)
	if err != nil {
		return errors.WithStack(err)
	}

	err = _validator.Validate(v)
	if err == nil {
		return nil
	}

	if _, ok := err.(*validator.InvalidValidationError); ok {
		return errors.WithStack(err)
	}

	violationMap := make(map[string]any, 0)
	for _, err := range err.(validator.ValidationErrors) {
		violationMap[strings.ToLower(err.Field()[0:1])+err.Field()[1:]] = resolveValidationExceptionMessage(err)
	}

	return exception.NewValidationExceptionWithExtra(exception.DefaultValidationExceptionMessage, violationMap)
}

func resolveValidationExceptionMessage(fieldError validator.FieldError) string {
	validationTag := fieldError.Tag()
	errorMessageKey := validationTag

	if fieldError.Kind() == reflect.String {
		switch validationTag {
		case "min":
			errorMessageKey = "stringMinLength"
		case "max":
			errorMessageKey = "stringMaxLength"
		case "len":
			errorMessageKey = "stringLength"
		}
	}

	return strings.Replace(
		validationErrorMessageTable[errorMessageKey],
		fmt.Sprintf("{{%s}}", validationTag),
		fieldError.Param(),
		1,
	)
}
