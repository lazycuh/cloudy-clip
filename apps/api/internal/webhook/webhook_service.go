package webhook

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/stripe/stripe-go/v79"
	"github.com/cloudy-clip/api/internal/billing"
	_billingModel "github.com/cloudy-clip/api/internal/billing/model"
	"github.com/cloudy-clip/api/internal/common/database"
	_jetModel "github.com/cloudy-clip/api/internal/common/database/.jet/model"
	"github.com/cloudy-clip/api/internal/common/environment"
	_logger "github.com/cloudy-clip/api/internal/common/logger"
	"github.com/cloudy-clip/api/internal/common/plan"
	"github.com/cloudy-clip/api/internal/common/utils"
	_subscription "github.com/cloudy-clip/api/internal/subscription"
	"github.com/cloudy-clip/api/internal/subscription/model"
	"github.com/cloudy-clip/api/internal/task"
)

var (
	webhookServiceLogger *_logger.Logger
)

type WebhookService struct {
}

func NewWebhookService() *WebhookService {
	webhookServiceLogger = _logger.NewLogger("WebhookService", slog.Level(environment.Config.ApplicationLogLevel))

	return &WebhookService{}
}

func (webhookService *WebhookService) ProcessStripeEvent(ctx context.Context, stripeEvent stripe.Event) error {
	switch stripeEvent.Type {
	case "invoice.payment_succeeded":
		var stripeInvoice stripe.Invoice
		err := json.Unmarshal(stripeEvent.Data.Raw, &stripeInvoice)
		if err != nil {
			webhookServiceLogger.ErrorAttrs(
				ctx,
				err,
				"failed to parse stripe webhook's invoice.payment_succeeded event JSON",
			)

			return err
		}

		go handleInvoicePaymentSucceededStripeEvent(ctx, &stripeInvoice)

		return nil

	case "invoice.payment_failed":
		var stripeInvoice stripe.Invoice
		err := json.Unmarshal(stripeEvent.Data.Raw, &stripeInvoice)
		if err != nil {
			webhookServiceLogger.ErrorAttrs(
				ctx,
				err,
				"failed to parse stripe webhook's invoice.payment_failed event JSON",
			)

			return err
		}

		go handleInvoicePaymentFailedStripeEvent(ctx, &stripeInvoice)

		return nil

	case "customer.subscription.deleted":
		var stripeSubscription stripe.Subscription
		err := json.Unmarshal(stripeEvent.Data.Raw, &stripeSubscription)
		if err != nil {
			webhookServiceLogger.ErrorAttrs(
				ctx,
				err,
				"failed to parse stripe webhook's customer.subscription.deleted event JSON",
			)

			return err
		}

		go handleCustomerSubscriptionDeletedStripeEvent(ctx, &stripeSubscription)

		return nil

	case "checkout.session.completed":
		var checkoutSession stripe.CheckoutSession
		err := json.Unmarshal(stripeEvent.Data.Raw, &checkoutSession)
		if err != nil {
			webhookServiceLogger.ErrorAttrs(
				ctx,
				err,
				"failed to parse stripe webhook's checkout.session.completed event JSON",
			)

			return err
		}

		go handleCheckoutSessionCompletedStripeEvent(ctx, &checkoutSession)

		return nil

	case "charge.refunded":
		var charge stripe.Charge
		err := json.Unmarshal(stripeEvent.Data.Raw, &charge)
		if err != nil {
			webhookServiceLogger.ErrorAttrs(
				ctx,
				err,
				"failed to parse stripe webhook's charge.refunded event JSON",
			)

			return err
		}

		go handleChargeRefundedStripeEvent(ctx, &charge)

		return nil
	default:
		return nil
	}
}

func handleInvoicePaymentSucceededStripeEvent(ctx context.Context, invoice *stripe.Invoice) {
	ctx = context.WithValue(ctx, _logger.LoggerContextCallSiteKey, "handleInvoicePaymentSucceededStripeEvent")
	ctx, cancel := context.WithTimeout(context.WithoutCancel(ctx), time.Duration(10)*time.Minute)

	subscriptionMetadata := invoice.SubscriptionDetails.Metadata
	offeringId := subscriptionMetadata["offeringId"]
	userId := subscriptionMetadata["userId"]
	taskId := subscriptionMetadata["taskId"]
	logAttributes := []slog.Attr{
		slog.String("userEmail", subscriptionMetadata["userEmail"]),
		slog.String("plan", plan.PlanNameTable[offeringId]),
		slog.String("stripeInvoiceId", invoice.ID),
		slog.String("taskId", taskId),
	}

	paymentReason := _billingModel.PaymentReasonUnknown

	err := database.UseTransaction(ctx, func(transaction pgx.Tx) error {
		existingSubscription, err := _subscription.
			GetSubscriptionRepository().
			FindSubscriptionByUserId(ctx, transaction, userId)
		if database.IsEmptyResultError(err) {
			err := _subscription.
				GetSubscriptionRepository().
				CreateSubscription(
					ctx,
					transaction,
					_jetModel.Subscription{
						UserID:         userId,
						PlanOfferingID: offeringId,
					},
				)
			if err != nil {
				return err
			}

			webhookServiceLogger.InfoAttrs(
				ctx,
				"added stripe subscription",
				slog.String("userEmail", subscriptionMetadata["userEmail"]),
				slog.String("plan", plan.PlanNameTable[offeringId]),
			)
		} else if err != nil {
			return err
		} else if existingSubscription.PlanOfferingID != offeringId {
			err := _subscription.
				GetSubscriptionRepository().
				UpdateSubscriptionPlan(ctx, transaction, userId, offeringId)
			if err != nil {
				return err
			}

			logAttributes = append(
				logAttributes,
				slog.String("oldPlan", plan.PlanNameTable[existingSubscription.PlanOfferingID]),
			)

			webhookServiceLogger.InfoAttrs(ctx, "updated subscription plan", logAttributes...)
		} else {
			err := _subscription.
				GetSubscriptionRepository().
				MarkSubscriptionAsActive(ctx, transaction, userId)

			if err != nil {
				return err
			}
		}

		err = task.
			GetTaskRepository().
			MarkTaskAsSuccessful(ctx, transaction, taskId)
		if err != nil {
			return err
		}

		paymentReasonResult, err := billing.
			GetBillingService().
			ProcessPayment(ctx, transaction, userId, _billingModel.PaymentStatusPaid, invoice)
		paymentReason = paymentReasonResult

		return err
	})

	defer cancel()

	if err == nil {
		webhookServiceLogger.InfoAttrs(
			ctx,
			fmt.Sprintf("processed stripe invoice.payment_succeeded event with reason '%s'", paymentReason),
			logAttributes...,
		)

		return
	}

	taskUpdateErr := task.
		GetTaskRepository().
		MarkTaskAsFailed(ctx, nil, taskId)
	if taskUpdateErr != nil {
		webhookServiceLogger.ErrorAttrs(ctx, taskUpdateErr, "failed to mark task as failed", logAttributes...)
	}

	webhookServiceLogger.ErrorAttrs(
		ctx,
		err,
		fmt.Sprintf("failed to process stripe invoice.payment_succeeded event with reason '%s'", paymentReason),
		logAttributes...,
	)
}

func handleInvoicePaymentFailedStripeEvent(ctx context.Context, invoice *stripe.Invoice) {
	ctx = context.WithValue(ctx, _logger.LoggerContextCallSiteKey, "handleInvoicePaymentFailedStripeEvent")
	ctx, cancel := context.WithTimeout(context.WithoutCancel(ctx), time.Duration(10)*time.Minute)

	defer cancel()

	subscriptionMetadata := invoice.SubscriptionDetails.Metadata
	offeringId := subscriptionMetadata["offeringId"]
	userEmailAttr := slog.String("userEmail", subscriptionMetadata["userEmail"])
	planAttr := slog.String("plan", plan.PlanNameTable[offeringId])
	userId := subscriptionMetadata["userId"]
	paymentReason := _billingModel.PaymentReasonUnknown

	err := utils.Retry(func() error {
		taskId := subscriptionMetadata["taskId"]

		return database.UseTransaction(ctx, func(transaction pgx.Tx) error {
			err := task.
				GetTaskRepository().
				MarkTaskAsFailed(ctx, transaction, taskId)
			if err != nil {
				return err
			}

			paymentReasonResult, err := billing.
				GetBillingService().
				ProcessPayment(ctx, transaction, userId, _billingModel.PaymentStatusFailed, invoice)

			paymentReason = paymentReasonResult

			return err
		})
	})
	if err == nil {
		webhookServiceLogger.InfoAttrs(
			ctx,
			fmt.Sprintf("processed stripe invoice.payment_failed event with reason '%s'", paymentReason),
			userEmailAttr,
			planAttr,
		)

		return
	}

	webhookServiceLogger.ErrorAttrs(
		ctx,
		err,
		fmt.Sprintf("failed to process stripe invoice.payment_succeeded event with reason '%s'", paymentReason),
		userEmailAttr,
		planAttr,
	)
}

func handleCustomerSubscriptionDeletedStripeEvent(ctx context.Context, stripeSubscription *stripe.Subscription) {
	ctx = context.WithValue(ctx, _logger.LoggerContextCallSiteKey, "handleCustomerSubscriptionDeletedStripeEvent")
	ctx, cancel := context.WithTimeout(context.WithoutCancel(ctx), time.Duration(10)*time.Minute)

	defer cancel()

	subscriptionMetadata := stripeSubscription.Metadata

	cancellationReason, err := utils.RetryWithReturnedValue(func() (model.SubscriptionCancellationReason, error) {
		return _subscription.
			GetSubscriptionService().
			ProcessSubscriptionDeletedEvent(ctx, stripeSubscription)
	})
	if err == nil {
		webhookServiceLogger.InfoAttrs(
			ctx,
			"processed customer.subscription.deleted stripe event",
			slog.String("userEmail", subscriptionMetadata["userEmail"]),
			slog.String("plan", plan.PlanNameTable[subscriptionMetadata["offeringId"]]),
			slog.String("cancellationReason", cancellationReason.String()),
		)

		return
	}

	webhookServiceLogger.ErrorAttrs(
		ctx,
		err,
		"failed to process customer.subscription.deleted stripe event",
		slog.String("userEmail", subscriptionMetadata["userEmail"]),
		slog.String("plan", plan.PlanNameTable[subscriptionMetadata["offeringId"]]),
		slog.String("cancellationReason", cancellationReason.String()),
	)
}

func handleCheckoutSessionCompletedStripeEvent(ctx context.Context, checkoutSession *stripe.CheckoutSession) {
	ctx = context.WithValue(ctx, _logger.LoggerContextCallSiteKey, "handleCheckoutSessionCompletedStripeEvent")
	ctx, cancel := context.WithTimeout(context.WithoutCancel(ctx), time.Duration(10)*time.Minute)

	defer cancel()

	userEmailAttr := slog.String("userEmail", checkoutSession.CustomerDetails.Email)

	err := utils.Retry(func() error {
		return billing.
			GetBillingService().
			AddPaymentMethod(ctx, checkoutSession)
	})
	if err == nil {
		webhookServiceLogger.InfoAttrs(ctx, "added payment method", userEmailAttr)

		return
	}

	webhookServiceLogger.ErrorAttrs(
		ctx,
		err,
		"failed to add payment method",
		userEmailAttr,
		slog.String("setupIntentId", checkoutSession.SetupIntent.ID),
	)
}

func handleChargeRefundedStripeEvent(ctx context.Context, charge *stripe.Charge) {
	ctx = context.WithValue(ctx, _logger.LoggerContextCallSiteKey, "handleChargeRefundedStripeEvent")

	billing.
		GetBillingService().
		ProcessSuccessfulRefund(ctx, charge)
}
