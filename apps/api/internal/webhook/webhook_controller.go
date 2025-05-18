package webhook

import (
	"io"
	"log/slog"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/pkg/errors"
	"github.com/stripe/stripe-go/v79/webhook"
	"github.com/cloudy-clip/api/internal/common/environment"
	"github.com/cloudy-clip/api/internal/common/http/middleware/context"
	"github.com/cloudy-clip/api/internal/common/logger"
)

var (
	webhookService          *WebhookService
	webhookControllerLogger *logger.Logger
)

func GetEntitlementService() *WebhookService {
	return webhookService
}

func SetupWebhookControllerEndpoints(parentRouter chi.Router) {
	webhookControllerLogger = logger.NewLogger(
		"WebhookController", slog.Level(environment.Config.ApplicationLogLevel),
	)

	webhookService = NewWebhookService()

	parentRouter.Route("/v1/stripe", func(v1Router chi.Router) {
		v1Router.Group(func(router chi.Router) {
			router.Use(
				context.CallSiteMiddleware("handleStripeIntegration"),
			)
			router.Post("/", handleStripeIntegration)
		})
	})
}

func handleStripeIntegration(responseWriter http.ResponseWriter, request *http.Request) {
	const maxBodyBytes = int64(65536)

	request.Body = http.MaxBytesReader(responseWriter, request.Body, maxBodyBytes)

	payload, err := io.ReadAll(request.Body)
	if err != nil {
		webhookControllerLogger.ErrorAttrs(
			request.Context(),
			err,
			"failed to read all request body",
		)

		responseWriter.WriteHeader(http.StatusServiceUnavailable)

		return
	}

	stripeEvent, err := webhook.ConstructEvent(
		payload,
		request.Header.Get("Stripe-Signature"),
		environment.Config.PaymentGatewayWebhookSecret,
	)
	if err != nil {
		webhookControllerLogger.ErrorAttrs(
			request.Context(),
			errors.WithStack(err),
			"failed to verify stripe webhook signature",
		)

		responseWriter.WriteHeader(http.StatusBadRequest)

		return
	}

	err = webhookService.ProcessStripeEvent(request.Context(), stripeEvent)
	if err != nil {
		responseWriter.WriteHeader(http.StatusBadRequest)

		return
	}

	responseWriter.WriteHeader(http.StatusOK)
}
