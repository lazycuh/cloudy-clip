package orchestrator

import (
	"context"
	"errors"
	"log/slog"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/stripe/stripe-go/v79"
	"github.com/cloudy-clip/api/internal/billing"
	"github.com/cloudy-clip/api/internal/common/environment"
	"github.com/cloudy-clip/api/internal/common/exception"
	_http "github.com/cloudy-clip/api/internal/common/http"
	"github.com/cloudy-clip/api/internal/common/logger"
	"github.com/cloudy-clip/api/internal/subscription"
	"github.com/cloudy-clip/api/internal/task"
	"github.com/cloudy-clip/api/internal/user"
	"github.com/cloudy-clip/api/internal/webhook"
)

func SetupControllerEndpoints(conf *Config, mux *chi.Mux) {
	stripe.Key = environment.Config.PaymentGatewayApiKey

	mux.Use(
		middleware.RequestID,
		middleware.RealIP,
		newGlobalErrorHandler(),
		// 5MiB
		middleware.RequestSize(5242880),
		// Set a timeout value on the request context (ctx), that will signal
		// through ctx.Done() that the request has timed out and further
		// processing should be stopped.
		middleware.Timeout(conf.ReadTimeout),
	)

	orchestratorLogger := logger.NewLogger("Orchestrator", slog.Level(environment.Config.ApplicationLogLevel))

	mux.NotFound(func(responseWriter http.ResponseWriter, request *http.Request) {
		err := exception.NewNotFoundException("no handler found to process request")

		orchestratorLogger.ErrorAttrs(
			context.WithValue(request.Context(), logger.LoggerContextCallSiteKey, "Orchestrator"),
			err,
			"no handler found to process request",
			slog.String("method", request.Method),
			slog.String("path", request.URL.Path),
			slog.String("remoteAddr", request.RemoteAddr),
			slog.String("userAgent", request.UserAgent()),
		)

		_http.WriteErrorResponse(request, responseWriter, err)
	})

	mux.MethodNotAllowed(func(responseWriter http.ResponseWriter, request *http.Request) {
		orchestratorLogger.ErrorAttrs(
			context.WithValue(request.Context(), logger.LoggerContextCallSiteKey, "Orchestrator"),
			errors.New("method not allowed"),
			"HTTP method not allowed",
			slog.String("method", request.Method),
			slog.String("path", request.URL.Path),
			slog.String("remoteAddr", request.RemoteAddr),
			slog.String("userAgent", request.UserAgent()),
		)

		_http.WriteErrorResponse(
			request,
			responseWriter,
			exception.NewNotFoundException("no handler found to process request"),
		)
	})

	mux.Route("/api", func(router chi.Router) {
		user.SetupUserControllerEndpoints(router)
		billing.SetupBillingControllerEndpoints(router)
		subscription.SetupSubscriptionControllerEndpoints(router)
		webhook.SetupWebhookControllerEndpoints(router)
		task.SetupTaskControllerEndpoints(router)
	})
}
