package exception

import (
	"net/http"

	"github.com/cloudy-clip/api/internal/common/exception"
)

type IncorrectEmailOrPasswordException struct {
	exception.ApplicationException
}

func NewIncorrectEmailOrPasswordException() IncorrectEmailOrPasswordException {
	return NewIncorrectEmailOrPasswordExceptionWithExtra(nil)
}

func NewIncorrectEmailOrPasswordExceptionWithExtra(extra map[string]any) IncorrectEmailOrPasswordException {
	applicationException := exception.ApplicationException{
		Message:    "email or password was incorrect",
		Extra:      extra,
		StatusCode: http.StatusUnauthorized,
	}

	return IncorrectEmailOrPasswordException{
		applicationException,
	}
}
