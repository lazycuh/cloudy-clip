package commonValidator

import (
	"fmt"

	validator "github.com/go-playground/validator/v10"
)

var validatorInstance = newValidatorInstance()

func newValidatorInstance() *validator.Validate {
	instance := validator.New(validator.WithRequiredStructEnabled())

	registerValidator(instance, "mixedCase", mixedCaseValidator)
	registerValidator(instance, "containNumbers", containNumbersValidator)

	return instance
}

func registerValidator(instance *validator.Validate, tag string, fn validator.Func) {
	err := instance.RegisterValidation(tag, fn)
	if err != nil {
		fmt.Printf("Error: %v\n", err)

		panic(fmt.Errorf("failed to register '%s' validator", tag))
	}
}

func Validate(v any) error {
	return validatorInstance.Struct(v)

}
