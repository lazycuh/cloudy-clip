package http

import (
	"net/http"
)

type RequestHandler func(request *http.Request, responseWriter http.ResponseWriter) (any, error)
type RequestHandlerEmptyResponse func(request *http.Request, responseWriter http.ResponseWriter) error

func GetResponseSender(successStatus int, requestHandler RequestHandler) http.HandlerFunc {
	return func(responseWriter http.ResponseWriter, request *http.Request) {
		responsePayload, err := requestHandler(request, responseWriter)
		if err == nil {
			WriteResponse(responseWriter, successStatus, NewResponseBody(responsePayload))

			return
		}

		WriteErrorResponse(request, responseWriter, err)
	}
}

func GetEmptyResponseSender(requestHandler RequestHandlerEmptyResponse) http.HandlerFunc {
	return func(responseWriter http.ResponseWriter, request *http.Request) {
		err := requestHandler(request, responseWriter)
		if err == nil {
			WriteNoContentResponse(responseWriter)

			return
		}

		WriteErrorResponse(request, responseWriter, err)
	}
}
