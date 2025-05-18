package billing

import (
	"log/slog"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/cloudy-clip/api/internal/common/environment"
	_http "github.com/cloudy-clip/api/internal/common/http"
	"github.com/cloudy-clip/api/internal/common/http/middleware/context"
	"github.com/cloudy-clip/api/internal/common/jwt"
	"github.com/cloudy-clip/api/internal/common/logger"
)

var (
	billingService          *BillingService
	billingRepository       *BillingRepository
	billingControllerLogger *logger.Logger
)

func GetBillingService() *BillingService {
	return billingService
}

func GetBillingRepository() *BillingRepository {
	return billingRepository
}

func SetupBillingControllerEndpoints(parentRouter chi.Router) {
	billingRepository = NewBillingRepository()
	billingService = NewBillingService()
	billingControllerLogger := logger.NewLogger(
		"BillingController", slog.Level(environment.Config.ApplicationLogLevel),
	)

	parentRouter.Route("/v1/billing/my", func(v1Router chi.Router) {
		v1Router.Group(func(router chi.Router) {
			router.Use(
				context.CallSiteMiddleware("handleGettingBillingInfo"),
				jwt.JwtVerifierMiddleware(billingControllerLogger),
			)
			router.Get("/info", handleGettingBillingInfo())
		})

		v1Router.Group(func(router chi.Router) {
			router.Use(
				context.CallSiteMiddleware("handleGettingUrlToPageToAddPaymentMehtod"),
				jwt.JwtVerifierMiddleware(billingControllerLogger),
			)
			router.Get("/management/page/payment-method", handleGettingUrlToPageToAddPaymentMehtod())
		})

		v1Router.Group(func(router chi.Router) {
			router.Use(
				context.CallSiteMiddleware("handleGettingPayments"),
				jwt.JwtVerifierMiddleware(billingControllerLogger),
			)
			router.Get("/payments", handleGettingPayments())
		})

		v1Router.Group(func(router chi.Router) {
			router.Use(
				context.CallSiteMiddleware("handleGettingReceiptUrlForPayment"),
				jwt.JwtVerifierMiddleware(billingControllerLogger),
			)
			router.Get("/payments/{paymentId}/receipt", handleGettingReceiptUrlForPayment())
		})

		v1Router.Group(func(router chi.Router) {
			router.Use(
				context.CallSiteMiddleware("handleGettingPaymentMethods"),
				jwt.JwtVerifierMiddleware(billingControllerLogger),
			)
			router.Get("/payment-methods", handleGettingPaymentMethods())
		})

		v1Router.Group(func(router chi.Router) {
			router.Use(
				context.CallSiteMiddleware("handleDeletingPaymentMethod"),
				jwt.JwtVerifierMiddleware(billingControllerLogger),
			)
			router.Delete("/payment-methods/{paymentMethodId}", handleDeletingPaymentMethod())
		})

		v1Router.Group(func(router chi.Router) {
			router.Use(
				context.CallSiteMiddleware("handleSettingExistingPaymentMethodAsDefault"),
				jwt.JwtVerifierMiddleware(billingControllerLogger),
			)
			router.Patch("/payment-methods/{paymentMethodId}/default", handleSettingExistingPaymentMethodAsDefault())
		})

		v1Router.Group(func(router chi.Router) {
			router.Use(
				context.CallSiteMiddleware("handleGettingUpcomingPayment"),
				jwt.JwtVerifierMiddleware(billingControllerLogger),
			)
			router.Get("/upcoming-payment", handleGettingUpcomingPayment())
		})
	})
}

func handleGettingBillingInfo() http.HandlerFunc {
	return _http.GetResponseSender(
		http.StatusOK,
		func(request *http.Request, responseWriter http.ResponseWriter) (any, error) {
			return billingService.getBillingInfo(request.Context())
		},
	)
}

func handleGettingUrlToPageToAddPaymentMehtod() http.HandlerFunc {
	return _http.GetResponseSender(
		http.StatusOK,
		func(request *http.Request, responseWriter http.ResponseWriter) (any, error) {
			returnUrlPath := _http.GetQueryParamOrDefault(request.URL.Query(), "returnUrlPath", "/my/payment-methods")

			return billingService.getUrlToPageToAddPaymentMethod(request.Context(), returnUrlPath)
		},
	)
}

func handleGettingPayments() http.HandlerFunc {
	return _http.GetResponseSender(
		http.StatusOK,
		func(request *http.Request, responseWriter http.ResponseWriter) (any, error) {
			ctx := request.Context()
			queryParams := request.URL.Query()

			offset, err := _http.GetQueryParamAsInt64(queryParams, "offset")
			if err != nil {
				billingControllerLogger.ErrorAttrs(
					ctx,
					err,
					"failed to get offset query param",
					slog.String("userEmail", jwt.GetUserEmailClaim(ctx)),
					slog.String("queryParams", queryParams.Encode()),
				)

				return nil, err
			}

			limit, err := _http.GetQueryParamAsInt64(queryParams, "limit")
			if err != nil {
				billingControllerLogger.ErrorAttrs(
					ctx,
					err,
					"failed to get limit query param",
					slog.String("userEmail", jwt.GetUserEmailClaim(ctx)),
					slog.String("queryParams", queryParams.Encode()),
				)

				return nil, err
			}

			return billingService.getPayments(ctx, offset, limit)
		},
	)
}

func handleGettingReceiptUrlForPayment() http.HandlerFunc {
	return _http.GetResponseSender(
		http.StatusOK,
		func(request *http.Request, responseWriter http.ResponseWriter) (any, error) {
			paymentId := chi.URLParam(request, "paymentId")

			return billingService.getReceiptUrlForPayment(request.Context(), paymentId)
		},
	)
}

func handleGettingPaymentMethods() http.HandlerFunc {
	return _http.GetResponseSender(
		http.StatusOK,
		func(request *http.Request, responseWriter http.ResponseWriter) (any, error) {
			return billingService.GetAllNonDeletedPaymentMethods(request.Context())
		},
	)
}

func handleDeletingPaymentMethod() http.HandlerFunc {
	return _http.GetEmptyResponseSender(func(request *http.Request, responseWriter http.ResponseWriter) error {
		paymentMethodId := chi.URLParam(request, "paymentMethodId")

		return billingService.deletePaymentMethod(request.Context(), paymentMethodId)

	})
}

func handleSettingExistingPaymentMethodAsDefault() http.HandlerFunc {
	return _http.GetEmptyResponseSender(func(request *http.Request, responseWriter http.ResponseWriter) error {
		paymentMethodId := chi.URLParam(request, "paymentMethodId")

		return billingService.setExistingPaymentMethodAsDefault(request.Context(), paymentMethodId)
	})
}

func handleGettingUpcomingPayment() http.HandlerFunc {
	return _http.GetResponseSender(
		http.StatusOK,
		func(request *http.Request, responseWriter http.ResponseWriter) (any, error) {
			return billingService.getUpcomingPayment(request.Context())
		},
	)
}
