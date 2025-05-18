package subscription

import (
	"log/slog"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/cloudy-clip/api/internal/common/environment"
	"github.com/cloudy-clip/api/internal/common/exception"
	_http "github.com/cloudy-clip/api/internal/common/http"
	_context "github.com/cloudy-clip/api/internal/common/http/middleware/context"
	"github.com/cloudy-clip/api/internal/common/http/middleware/turnstile"
	"github.com/cloudy-clip/api/internal/common/jwt"
	"github.com/cloudy-clip/api/internal/common/logger"
	"github.com/cloudy-clip/api/internal/subscription/dto"
)

var (
	subscriptionService          *SubscriptionService
	subscriptionRepository       *SubscriptionRepository
	subscriptionControllerLogger *logger.Logger
)

var (
	ProrationDateCookieName = "lc__sc__pd"
	AmountDueCookieName     = "lc__sc__ad"
	CurrencyCodeCookieName  = "lc__sc__cc"
)

func GetSubscriptionService() *SubscriptionService {
	return subscriptionService
}

func GetSubscriptionRepository() *SubscriptionRepository {
	return subscriptionRepository
}

func SetupSubscriptionControllerEndpoints(parentRouter chi.Router) {
	subscriptionRepository = NewSubscriptionRepository()

	subscriptionControllerLogger = logger.NewLogger(
		"SubscriptionController", slog.Level(environment.Config.ApplicationLogLevel),
	)

	subscriptionService = NewSubscriptionService()

	parentRouter.Route("/v1/plans", func(v1Router chi.Router) {
		v1Router.Group(func(router chi.Router) {
			router.Use(
				_context.CallSiteMiddleware("handleGettingPlans"),
			)
			router.Get("/", handleGettingPlans())
		})
	})

	parentRouter.Route("/v1/checkout", func(v1Router chi.Router) {
		v1Router.Group(func(router chi.Router) {
			router.Use(
				_context.CallSiteMiddleware("handleNewSubscriptionCheckout"),
				turnstile.TurnstileTokenVerifierMiddleware(subscriptionControllerLogger),
				jwt.JwtVerifierMiddleware(subscriptionControllerLogger),
			)
			router.Post("/", handleNewSubscriptionCheckout())
		})

		v1Router.Group(func(router chi.Router) {
			router.Use(
				_context.CallSiteMiddleware("handleCheckoutPreview"),
				jwt.JwtVerifierMiddleware(subscriptionControllerLogger),
			)
			router.Get("/preview", handleCheckoutPreview())
		})
	})

	parentRouter.Route("/v1/subscriptions/my", func(v1Router chi.Router) {
		v1Router.Group(func(router chi.Router) {
			router.Use(
				_context.CallSiteMiddleware("handleGettingSubscriptionCancellationRefundAmount"),
				jwt.JwtVerifierMiddleware(subscriptionControllerLogger),
			)
			router.Get("/cancellation", handleGettingSubscriptionCancellationRefundAmount())
		})

		v1Router.Group(func(router chi.Router) {
			router.Use(
				_context.CallSiteMiddleware("handleCancellingSubscription"),
				jwt.JwtVerifierMiddleware(subscriptionControllerLogger),
			)
			router.Delete("/", handleCancellingSubscription())
		})

		v1Router.Group(func(router chi.Router) {
			router.Use(
				_context.CallSiteMiddleware("handleUpdatingSubscription"),
				jwt.JwtVerifierMiddleware(subscriptionControllerLogger),
			)
			router.Put("/", handleUpdatingSubscription())
		})

		v1Router.Group(func(router chi.Router) {
			router.Use(
				_context.CallSiteMiddleware("handleReactivatingSubscription"),
				jwt.JwtVerifierMiddleware(subscriptionControllerLogger),
			)

			router.Post("/reactivate", handleReactivatingSubscription())
		})
	})
}

func handleGettingPlans() http.HandlerFunc {
	return _http.GetResponseSender(
		http.StatusOK,
		func(request *http.Request, responseWriter http.ResponseWriter) (any, error) {
			return subscriptionService.getAllPlans(request.Context())
		},
	)
}

func handleNewSubscriptionCheckout() http.HandlerFunc {
	return _http.GetResponseSender(
		http.StatusOK,
		func(request *http.Request, responseWriter http.ResponseWriter) (any, error) {
			var checkoutRequestPayload dto.FirstSubscriptionCheckoutRequest
			err := _http.ReadRequestBodyAs(request, subscriptionControllerLogger, &checkoutRequestPayload)
			if err != nil {
				subscriptionControllerLogger.ErrorAttrs(
					request.Context(),
					err,
					"failed to parse request body",
					slog.Any("requestBody", checkoutRequestPayload),
				)

				return nil, err
			}

			checkoutResponse, taskId, err := subscriptionService.checkOutNewSubscription(
				request.Context(),
				checkoutRequestPayload,
			)

			return map[string]any{
				"checkoutResponse": checkoutResponse,
				"taskId":           taskId,
			}, err
		},
	)
}

func handleCheckoutPreview() http.HandlerFunc {
	return _http.GetResponseSender(
		http.StatusOK,
		func(request *http.Request, responseWriter http.ResponseWriter) (any, error) {
			offeringId, err := _http.GetQueryParam(request.URL.Query(), "offeringId")
			if err != nil {
				return nil, err
			}

			checkoutPreviewResponse, prorationDateSeconds, err := subscriptionService.previewCheckout(
				request.Context(),
				offeringId,
			)

			if err == nil && prorationDateSeconds > 0 {
				_http.SetCookieWithMaxAge(
					responseWriter,
					ProrationDateCookieName,
					strconv.FormatInt(prorationDateSeconds, 10),
					30,
				)
			}

			return checkoutPreviewResponse, err
		},
	)
}

func handleGettingSubscriptionCancellationRefundAmount() http.HandlerFunc {
	return _http.GetResponseSender(
		http.StatusOK,
		func(request *http.Request, responseWriter http.ResponseWriter) (any, error) {
			return subscriptionService.getSubscriptionCancellationRefundAmount(request.Context())
		},
	)
}

func handleCancellingSubscription() http.HandlerFunc {
	return _http.GetEmptyResponseSender(func(request *http.Request, responseWriter http.ResponseWriter) error {
		return subscriptionService.cancelSubscription(request.Context())
	})
}

func handleUpdatingSubscription() http.HandlerFunc {
	return _http.GetResponseSender(
		http.StatusOK,
		func(request *http.Request, responseWriter http.ResponseWriter) (any, error) {
			ctx := request.Context()

			var subscriptionUpdateCheckoutRequest dto.SubscriptionUpdateCheckoutRequest
			err := _http.ReadRequestBodyAs(request, subscriptionControllerLogger, &subscriptionUpdateCheckoutRequest)
			if err != nil {
				subscriptionControllerLogger.ErrorAttrs(
					ctx,
					err,
					"failed to parse request body",
					slog.String("userEmail", jwt.GetUserEmailClaim(ctx)),
					slog.Any("requestBody", subscriptionUpdateCheckoutRequest),
				)

				return nil, err
			}

			prorationDateSecondsCookie, err := request.Cookie(ProrationDateCookieName)
			if err != nil {
				subscriptionControllerLogger.ErrorAttrs(
					ctx,
					err,
					"failed to get proration date cookie",
					slog.String("userEmail", jwt.GetUserEmailClaim(ctx)),
					slog.Any("requestBody", subscriptionUpdateCheckoutRequest),
				)

				return nil, exception.NewRequiredStatesAreMissingException("failed to update subscription")
			}

			prorationDateSeconds, err := strconv.Atoi(prorationDateSecondsCookie.Value)
			if err != nil {
				subscriptionControllerLogger.ErrorAttrs(
					ctx,
					err,
					"failed to convert proration date cookie value to int",
					slog.String("userEmail", jwt.GetUserEmailClaim(ctx)),
					slog.String("prorationDateSeconds", prorationDateSecondsCookie.Value),
					slog.Any("requestBody", subscriptionUpdateCheckoutRequest),
				)

				return nil, exception.NewRequiredStatesAreMissingException("failed to update subscription")
			}

			taskId, err := subscriptionService.updateSubscription(
				ctx,
				subscriptionUpdateCheckoutRequest,
				int64(prorationDateSeconds),
			)
			if err == nil {
				_http.RemoveCookie(responseWriter, ProrationDateCookieName)
				_http.RemoveCookie(responseWriter, AmountDueCookieName)
				_http.RemoveCookie(responseWriter, CurrencyCodeCookieName)
			}

			return taskId, err
		},
	)
}

func handleReactivatingSubscription() http.HandlerFunc {
	return _http.GetResponseSender(
		http.StatusOK,
		func(request *http.Request, responseWriter http.ResponseWriter) (any, error) {
			ctx := request.Context()

			var subscriptionReactivationCheckoutRequest dto.SubscriptionReactivationCheckoutRequest
			err := _http.ReadRequestBodyAs(
				request,
				subscriptionControllerLogger,
				&subscriptionReactivationCheckoutRequest,
			)
			if err != nil {
				subscriptionControllerLogger.ErrorAttrs(
					ctx,
					err,
					"failed to parse request body",
					slog.String("userEmail", jwt.GetUserEmailClaim(ctx)),
					slog.Any("requestBody", subscriptionReactivationCheckoutRequest),
				)

				return nil, err
			}

			taskId, err := subscriptionService.reactivateSubscription(ctx, subscriptionReactivationCheckoutRequest)
			if err == nil {
				_http.RemoveCookie(responseWriter, AmountDueCookieName)
				_http.RemoveCookie(responseWriter, CurrencyCodeCookieName)
			}

			return taskId, err
		},
	)
}
