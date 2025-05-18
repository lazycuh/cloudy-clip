package http

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5/middleware"
	"github.com/pkg/errors"
	"github.com/cloudy-clip/api/internal/common/exception"
)

type ResponseBody[T any] struct {
	Message string `json:"message"`
	Payload T      `json:"payload"`
}

func NewResponseBody[T any](payload T) ResponseBody[T] {
	return ResponseBody[T]{
		Message: "OK",
		Payload: payload,
	}
}

func NewResponseBodyWithMessage[T any](payload T, message string) ResponseBody[T] {
	return ResponseBody[T]{
		Message: message,
		Payload: payload,
	}
}

func WriteResponse[T any](responseWriter http.ResponseWriter, status int, responseBody ResponseBody[T]) {
	payloadJson, err := json.Marshal(responseBody)
	if err != nil {
		panic(err)
	}

	responseWriter.Header().Add("Content-Type", "application/json")
	responseWriter.WriteHeader(status)
	_, err = responseWriter.Write(payloadJson)
	if err != nil {
		panic(err)
	}
}

func WriteErrorResponse(request *http.Request, responseWriter http.ResponseWriter, err error) {
	errorPayload, statusCode := getExceptionPayloadAndStatusCode(request, err)

	WriteResponse(responseWriter, statusCode, NewResponseBodyWithMessage(errorPayload, errorPayload.Message))
}

func getExceptionPayloadAndStatusCode(request *http.Request, err error) (ExceptionPayload, int) {
	thrownException := errors.Unwrap(err)

	if thrownException == nil {
		thrownException = err
	}

	exceptionPayload := ExceptionPayload{
		RequestId:     middleware.GetReqID(request.Context()),
		RequestMethod: request.Method,
		RequestPath:   request.RequestURI,
		Timestamp:     time.Now().Format(time.RFC3339),
		Message:       thrownException.Error(),
	}

	if exception.IsApplicationException(thrownException) {
		customException := exception.GetAsApplicationException(thrownException, thrownException.Error())
		exceptionType := fmt.Sprintf("%T", customException)
		exceptionPayload.Code = exceptionType[strings.LastIndex(exceptionType, ".")+1:]

		exceptionPayload.Extra = customException.GetExtra()

		return exceptionPayload, customException.GetStatusCode()
	}

	exceptionPayload.Code = "UnknownException"

	return exceptionPayload, http.StatusInternalServerError
}

func WriteNoContentResponse(responseWriter http.ResponseWriter) {
	responseWriter.WriteHeader(http.StatusNoContent)
}
