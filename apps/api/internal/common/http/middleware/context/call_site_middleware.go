package context

import (
	"context"
	"net/http"

	"github.com/cloudy-clip/api/internal/common/logger"
)

func CallSiteMiddleware(callSite string) func(next http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		handler := func(responseWriter http.ResponseWriter, request *http.Request) {
			request = request.WithContext(
				context.WithValue(request.Context(), logger.LoggerContextCallSiteKey, callSite),
			)

			next.ServeHTTP(responseWriter, request)
		}

		return http.HandlerFunc(handler)
	}
}
