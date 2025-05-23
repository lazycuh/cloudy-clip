package exception

import "net/http"

type NotFoundException struct {
	ApplicationException
}

func NewNotFoundException(message string) NotFoundException {
	applicationException := ApplicationException{
		Message:    message,
		StatusCode: http.StatusNotFound,
	}

	return NotFoundException{
		applicationException,
	}
}
