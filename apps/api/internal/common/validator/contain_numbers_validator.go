package commonValidator

import (
	"regexp"

	validator "github.com/go-playground/validator/v10"
)

func containNumbersValidator(fieldLevel validator.FieldLevel) bool {
	value := fieldLevel.Field().String()

	regex := regexp.MustCompile(`\d`)

	return regex.MatchString(value)
}
