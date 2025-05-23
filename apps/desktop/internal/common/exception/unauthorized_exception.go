package exception

import "net/http"

type UnauthorizedException struct {
	ApplicationException
}

func NewUnauthorizedException(message string) UnauthorizedException {
	return NewUnauthorizedExceptionWithExtra(message, nil)
}

func NewUnauthorizedExceptionWithExtra(message string, extra map[string]any) UnauthorizedException {
	applicationException := ApplicationException{
		Message:    message,
		StatusCode: http.StatusUnauthorized,
		Extra:      extra,
	}

	return UnauthorizedException{
		applicationException,
	}
}
