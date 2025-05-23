package exception

import "net/http"

type UnknownException struct {
	ApplicationException
}

func (err UnknownException) Error() string {
	return err.Message
}

func NewUnknownException(message string) UnknownException {
	applicationException := ApplicationException{
		Message:    message,
		StatusCode: http.StatusInternalServerError,
	}

	return UnknownException{
		applicationException,
	}
}

func NewUnknownExceptionWithExtra(message string, extra map[string]any) UnknownException {
	applicationException := ApplicationException{
		Message:    message,
		StatusCode: http.StatusInternalServerError,
		Extra:      extra,
	}

	return UnknownException{
		applicationException,
	}
}
