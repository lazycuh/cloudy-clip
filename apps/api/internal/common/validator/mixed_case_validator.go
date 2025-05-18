package commonValidator

import (
	"strings"

	validator "github.com/go-playground/validator/v10"
)

func mixedCaseValidator(fieldLevel validator.FieldLevel) bool {
	value := fieldLevel.Field().String()

	return strings.ToLower(value) != value && strings.ToUpper(value) != value
}
