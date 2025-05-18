package turnstile

import (
	"net/http"

	_http "github.com/cloudy-clip/api/internal/common/http"
	"github.com/cloudy-clip/api/internal/common/logger"
)

const (
	TurnstileTokenHeader = "X-Cc"
)

func TurnstileTokenVerifierMiddleware(logger *logger.Logger) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		handler := func(responseWriter http.ResponseWriter, request *http.Request) {
			err := VerifyTurnstileToken(request, logger)
			if err == nil {
				next.ServeHTTP(responseWriter, request)

				return
			}

			_http.WriteErrorResponse(request, responseWriter, err)
		}

		return http.HandlerFunc(handler)
	}
}
