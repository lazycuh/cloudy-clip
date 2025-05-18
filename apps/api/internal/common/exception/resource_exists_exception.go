package exception

import "net/http"

type ResourceExistsException struct {
	ApplicationException
}

func NewResourceExistsException(message string) ResourceExistsException {
	applicationException := ApplicationException{
		Message:    message,
		StatusCode: http.StatusConflict,
	}

	return ResourceExistsException{
		applicationException,
	}
}
