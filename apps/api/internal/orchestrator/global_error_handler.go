package orchestrator

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"

	"github.com/pkg/errors"
	"github.com/cloudy-clip/api/internal/common/environment"
	"github.com/cloudy-clip/api/internal/common/exception"
	_http "github.com/cloudy-clip/api/internal/common/http"
	"github.com/cloudy-clip/api/internal/common/logger"
)

var globalErrorHandlerLogger *logger.Logger

func newGlobalErrorHandler() func(next http.Handler) http.Handler {
	globalErrorHandlerLogger = logger.NewLogger("GlobalErrorHandler", slog.Level(environment.Config.ApplicationLogLevel))

	return func(next http.Handler) http.Handler {
		handler := func(responseWriter http.ResponseWriter, request *http.Request) {
			defer func() {
				if recoveredError := recover(); recoveredError != nil {
					err, ok := recoveredError.(error)
					if !ok {
						err = fmt.Errorf("%v", recoveredError)
					}

					if !exception.IsApplicationException(err) {
						unknownException := exception.NewUnknownException(err.Error())

						logException(request, unknownException)

						_http.WriteErrorResponse(request, responseWriter, unknownException)

						return
					}

					_http.WriteErrorResponse(request, responseWriter, err)
				}
			}()

			request = request.WithContext(
				context.WithValue(request.Context(), logger.LoggerContextRemoteAddrKey, request.RemoteAddr),
			)

			next.ServeHTTP(responseWriter, request)
		}

		return http.HandlerFunc(handler)
	}
}

func logException(request *http.Request, err exception.Exception) {
	globalErrorHandlerLogger.ErrorAttrs(
		context.WithValue(request.Context(), logger.LoggerContextCallSiteKey, "GlobalErrorHandler"),
		errors.WithStack(err),
		fmt.Sprintf("%s %s has failed", request.Method, request.RequestURI),
	)
}
