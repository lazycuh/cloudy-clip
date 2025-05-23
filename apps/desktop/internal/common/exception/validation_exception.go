package exception

import "net/http"

const DefaultValidationExceptionMessage = "failed to validate one or more fields"

type ValidationException struct {
	ApplicationException
}

func (err ValidationException) Error() string {
	return err.Message
}

func NewValidationException(message string) ValidationException {
	return NewValidationExceptionWithExtra(message, nil)
}

func NewValidationExceptionWithExtra(message string, extra map[string]any) ValidationException {
	applicationException := ApplicationException{
		Message:    message,
		StatusCode: http.StatusBadRequest,
		Extra:      extra,
	}

	return ValidationException{
		applicationException,
	}
}
