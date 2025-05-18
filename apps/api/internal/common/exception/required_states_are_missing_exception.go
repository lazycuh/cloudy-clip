package exception

import "net/http"

type RequiredStatesAreMissingException struct {
	ApplicationException
}

func (err RequiredStatesAreMissingException) Error() string {
	return err.Message
}

func NewRequiredStatesAreMissingException(message string) RequiredStatesAreMissingException {
	applicationException := ApplicationException{
		StatusCode: http.StatusBadRequest,
		Message:    message,
	}

	return RequiredStatesAreMissingException{
		applicationException,
	}
}
