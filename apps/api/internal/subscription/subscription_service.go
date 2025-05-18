package subscription

import (
	"context"
	"log/slog"
	"net/http"
	"slices"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/maypok86/otter"
	"github.com/pkg/errors"
	"github.com/stripe/stripe-go/v79"
	"github.com/stripe/stripe-go/v79/customer"
	"github.com/stripe/stripe-go/v79/invoice"
	"github.com/stripe/stripe-go/v79/subscription"
	"github.com/cloudy-clip/api/internal/billing"
	"github.com/cloudy-clip/api/internal/common/currency"
	"github.com/cloudy-clip/api/internal/common/database"
	_jetModel "github.com/cloudy-clip/api/internal/common/database/.jet/model"
	"github.com/cloudy-clip/api/internal/common/email"
	"github.com/cloudy-clip/api/internal/common/environment"
	"github.com/cloudy-clip/api/internal/common/exception"
	"github.com/cloudy-clip/api/internal/common/jwt"
	_logger "github.com/cloudy-clip/api/internal/common/logger"
	"github.com/cloudy-clip/api/internal/common/plan"
	"github.com/cloudy-clip/api/internal/common/user"
	"github.com/cloudy-clip/api/internal/common/utils"
	"github.com/cloudy-clip/api/internal/subscription/dto"
	"github.com/cloudy-clip/api/internal/subscription/model"
	"github.com/cloudy-clip/api/internal/task"
	taskModel "github.com/cloudy-clip/api/internal/task/model"
)

var (
	subscriptionServiceLogger *_logger.Logger
	planCache                 otter.Cache[bool, []dto.Plan]
)

type SubscriptionService struct{}

func NewSubscriptionService() *SubscriptionService {
	subscriptionServiceLogger = _logger.NewLogger(
		"SubscriptionService",
		slog.Level(environment.Config.ApplicationLogLevel),
	)

	planCacheResult, err := otter.MustBuilder[bool, []dto.Plan](1).WithTTL(time.Hour).Build()
	if err == nil {
		planCache = planCacheResult

		stripe.Key = environment.Config.PaymentGatewayApiKey

		return &SubscriptionService{}
	}

	subscriptionServiceLogger.ErrorAttrs(context.Background(), err, "failed to create plan cache")

	panic(err)
}

func (subscriptionService *SubscriptionService) getAllPlans(ctx context.Context) ([]dto.Plan, exception.Exception) {
	plans, err := getAllPlans(ctx)
	if err == nil {
		return plans, nil
	}

	subscriptionServiceLogger.ErrorAttrs(
		ctx,
		err,
		"failed to get all plans",
		slog.String("userEmail", jwt.GetUserEmailClaim(ctx)),
	)

	return nil, exception.NewUnknownException("failed to get all plans")
}

func getAllPlans(ctx context.Context) ([]dto.Plan, error) {
	cachedPlans, ok := planCache.Get(true)
	if ok {
		return cachedPlans, nil
	}

	planOfferings, err := subscriptionRepository.GetAllPlanOfferings(ctx)
	if err != nil {
		return nil, err
	}

	planEntitlementGroupMap, err := groupPlanEntitlementsByPlanId(ctx)
	if err == nil {
		plans := make([]dto.Plan, 0)
		for _, planOffering := range planOfferings {
			plans = append(
				plans,
				dto.NewPlan(planOffering, planEntitlementGroupMap[planOffering.PlanID]),
			)
		}

		planCache.Set(true, plans)

		return plans, nil
	}

	return nil, err
}

func groupPlanEntitlementsByPlanId(ctx context.Context) (map[string][]model.PlanEntitlement, error) {
	planEntitlements, err := subscriptionRepository.GetAllPlanEntitlements(ctx)
	if err == nil {
		group := make(map[string][]model.PlanEntitlement, 0)

		for _, planEntitlement := range planEntitlements {
			_, exists := group[planEntitlement.PlanId]
			if !exists {
				group[planEntitlement.PlanId] = make([]model.PlanEntitlement, 0)
			}

			group[planEntitlement.PlanId] = append(group[planEntitlement.PlanId], planEntitlement)
		}

		return group, nil
	}

	return nil, err
}

func (subscriptionService *SubscriptionService) checkOutNewSubscription(
	ctx context.Context,
	checkoutRequest dto.FirstSubscriptionCheckoutRequest,
) (dto.FirstSubscriptionCheckoutResponse, string, exception.Exception) {
	checkoukResponse, taskId, err := checkOutNewSubscription(ctx, checkoutRequest)
	if err == nil {
		if taskId == "" {
			subscriptionServiceLogger.InfoAttrs(
				ctx,
				"created free subscription",
				slog.String("userEmail", jwt.GetUserEmailClaim(ctx)),
			)
		}

		return checkoukResponse, taskId, nil
	}

	subscriptionServiceLogger.ErrorAttrs(
		ctx,
		err,
		"failed to check out new subscription",
		slog.String("userEmail", jwt.GetUserEmailClaim(ctx)),
		slog.String("plan", plan.PlanNameTable[checkoutRequest.OfferingId]),
	)

	return checkoukResponse, taskId, exception.GetAsApplicationException(err, "failed to check out new subscription")
}

func checkOutNewSubscription(
	ctx context.Context,
	checkoutRequest dto.FirstSubscriptionCheckoutRequest,
) (dto.FirstSubscriptionCheckoutResponse, string, error) {
	userId := jwt.GetUserIdClaim(ctx)

	existingSubscription, err := subscriptionRepository.FindSubscriptionByUserId(ctx, nil, userId)
	if err == nil && existingSubscription.CanceledAt == nil && !plan.IsFreePlan(existingSubscription.PlanOfferingID) {
		return dto.FirstSubscriptionCheckoutResponse{},
			"",
			exception.NewValidationException(
				"cannot check out new subscription because an active paid subscription already exists",
			)
	}

	stripeCustomerId, err := createStripeCustomerIfNeeded(ctx, checkoutRequest)
	if err != nil {
		return dto.FirstSubscriptionCheckoutResponse{}, "", err
	}

	if plan.IsFreePlan(checkoutRequest.OfferingId) {
		return dto.FirstSubscriptionCheckoutResponse{}, "", createFreeSubscription(ctx, checkoutRequest.OfferingId)
	}

	var taskId string
	var checkoutResponse dto.FirstSubscriptionCheckoutResponse

	err = database.UseTransaction(ctx, func(transaction pgx.Tx) error {
		taskIdResult, err := task.
			GetTaskService().
			AddTask(ctx, transaction, taskModel.TaskTypeNewSubscriptionPayment, userId)
		if err == nil {
			taskId = taskIdResult

			checkoutResponseResult, err := createNewStripeSubscriptionRequest(
				ctx,
				taskId,
				stripeCustomerId,
				checkoutRequest,
			)

			checkoutResponse = checkoutResponseResult

			return err
		}

		return err
	})

	return checkoutResponse, taskId, err
}

func createStripeCustomerIfNeeded(
	ctx context.Context,
	checkoutRequest dto.FirstSubscriptionCheckoutRequest,
) (string, error) {
	userEmail := jwt.GetUserEmailClaim(ctx)
	userId := jwt.GetUserIdClaim(ctx)

	billingInfo, err := billing.
		GetBillingRepository().
		FindBillingInfoByUserId(ctx, nil, userId)
	if err == nil {
		subscriptionServiceLogger.InfoAttrs(
			ctx,
			"stripe customer was already created before, skipping",
			slog.String("userEmail", userEmail),
			slog.String("countryCode", checkoutRequest.CountryCode),
		)

		return *billingInfo.BillingCustomerID, nil
	}

	if !database.IsEmptyResultError(err) {
		return "", err
	}

	customerCreationResult, err := customer.New(&stripe.CustomerParams{
		Email: stripe.String(userEmail),
		Name:  stripe.String(checkoutRequest.FullName),
		Address: &stripe.AddressParams{
			Country:    stripe.String(checkoutRequest.CountryCode),
			PostalCode: stripe.String(checkoutRequest.PostalCode),
		},
	})
	if err != nil {
		return "", errors.WithStack(err)
	}

	err = utils.Retry(func() error {
		return billing.
			GetBillingRepository().
			CreateCustomerBillingInfo(ctx, _jetModel.BillingInfo{
				UserID:            userId,
				BillingCustomerID: &customerCreationResult.ID,
				CountryCode:       &checkoutRequest.CountryCode,
				PostalCode:        &checkoutRequest.PostalCode,
			})
	})
	if err == nil {
		subscriptionServiceLogger.InfoAttrs(
			ctx,
			"created stripe customer",
			slog.String("userEmail", userEmail),
			slog.String("countryCode", checkoutRequest.CountryCode),
		)

		return customerCreationResult.ID, nil
	}

	return "", err
}

func createFreeSubscription(ctx context.Context, offeringId string) error {
	userId := jwt.GetUserIdClaim(ctx)

	err := subscriptionRepository.CreateSubscription(
		ctx,
		nil,
		_jetModel.Subscription{
			UserID:         userId,
			PlanOfferingID: offeringId,
		},
	)
	if err == nil {
		return nil
	}

	if database.IsDuplicateRecordError(err) {
		err := subscriptionRepository.UpdateSubscriptionPlan(ctx, nil, userId, offeringId)
		if err == nil {
			return err
		}
	}

	return err
}

func createNewStripeSubscriptionRequest(
	ctx context.Context,
	taskId string,
	stripeCustomerId string,
	checkoutRequest dto.FirstSubscriptionCheckoutRequest,
) (dto.FirstSubscriptionCheckoutResponse, error) {
	defaultTaxRates, taxPercentage, err := utils.ResolveTaxRateByLocation(
		ctx,
		checkoutRequest.CountryCode,
		checkoutRequest.PostalCode,
	)
	if err != nil {
		return dto.FirstSubscriptionCheckoutResponse{}, err
	}

	stripeSubscriptionCreationResult, err := subscription.New(&stripe.SubscriptionParams{
		Customer:        stripe.String(stripeCustomerId),
		DefaultTaxRates: defaultTaxRates,
		Expand:          stripe.StringSlice([]string{"latest_invoice.payment_intent"}),
		Items: []*stripe.SubscriptionItemsParams{
			{
				Price: stripe.String(string(plan.GetPriceIdByOfferingId(checkoutRequest.OfferingId))),
			},
		},
		Metadata: map[string]string{
			"offeringId": checkoutRequest.OfferingId,
			"userEmail":  jwt.GetUserEmailClaim(ctx),
			"userId":     jwt.GetUserIdClaim(ctx),
			"taskId":     taskId,
		},
		PaymentBehavior: stripe.String("default_incomplete"),
		PaymentSettings: &stripe.SubscriptionPaymentSettingsParams{
			SaveDefaultPaymentMethod: stripe.String("on_subscription"),
			// amazon_pay, (google_pay, apple_pay) these 2 are not available in test mode
			PaymentMethodTypes: stripe.StringSlice([]string{"card"}),
		},
	})
	if err != nil {
		return dto.FirstSubscriptionCheckoutResponse{}, errors.WithStack(err)
	}

	discount := int64(0)
	latestInvoice := stripeSubscriptionCreationResult.LatestInvoice

	if latestInvoice.Discount != nil {
		discount = latestInvoice.Discount.Coupon.AmountOff
	}

	return dto.NewFirstSubscriptionCheckoutResponse(latestInvoice, taxPercentage, discount), nil
}

func (subscriptionService *SubscriptionService) previewCheckout(
	ctx context.Context,
	offeringId string,
) (dto.CheckoutPreviewResponse, int64, exception.Exception) {
	userEmailAttr := slog.String("userEmail", jwt.GetUserEmailClaim(ctx))
	newPlanAttr := slog.String("newPlan", plan.PlanNameTable[offeringId])

	checkoutPreviewResponse, prorationDateSeconds, err := previewCheckout(ctx, offeringId)
	if err == nil {
		subscriptionServiceLogger.InfoAttrs(
			ctx,
			"created checkout preview",
			userEmailAttr,
			newPlanAttr,
		)
		return checkoutPreviewResponse, prorationDateSeconds, nil
	}

	subscriptionServiceLogger.ErrorAttrs(
		ctx,
		err,
		"failed to create checkout preview",
		userEmailAttr,
		newPlanAttr,
	)

	return checkoutPreviewResponse,
		prorationDateSeconds,
		exception.GetAsApplicationException(err, "failed to create checkout preview")
}

func previewCheckout(ctx context.Context, offeringId string) (dto.CheckoutPreviewResponse, int64, error) {
	userId := jwt.GetUserIdClaim(ctx)
	associatedSubscription, err := subscriptionRepository.FindSubscriptionByUserId(ctx, nil, userId)
	if err != nil {
		return dto.CheckoutPreviewResponse{}, 0, err
	}

	if associatedSubscription.CanceledAt == nil {
		return previewCheckoutAgainstExistingSubscription(ctx, userId, offeringId)
	}

	checkoutPreviewResponse, err := previewSubscriptionReactivationCost(
		ctx,
		userId,
		associatedSubscription.PlanOfferingID,
	)

	return checkoutPreviewResponse, 0, err
}

func previewCheckoutAgainstExistingSubscription(
	ctx context.Context,
	userId,
	offeringId string,
) (dto.CheckoutPreviewResponse, int64, error) {
	billingInfo, err := billing.
		GetBillingRepository().
		FindBillingInfoByUserId(ctx, nil, userId)
	if err != nil {
		return dto.CheckoutPreviewResponse{}, 0, err
	}

	if billingInfo.StripeSubscriptionID == nil {
		return dto.CheckoutPreviewResponse{}, 0, errors.Errorf("no stripe subscription was found")
	}

	stripeSubscription, err := subscription.Get(*billingInfo.StripeSubscriptionID, nil)
	if err != nil {
		return dto.CheckoutPreviewResponse{}, 0, errors.WithStack(err)
	}

	defaultTaxRates, taxPercentage, err := utils.ResolveTaxRateByLocation(
		ctx,
		*billingInfo.CountryCode,
		*billingInfo.PostalCode,
	)
	if err != nil {
		return dto.CheckoutPreviewResponse{}, 0, err
	}

	// Add 30 minutes to this so that if payment fails, we can retry the payment
	// without causing an error in stripe about the proration date being in the past
	prorationDateSeconds := time.Now().Add(30 * time.Minute).Unix()

	params := &stripe.InvoiceCreatePreviewParams{
		Customer:     billingInfo.BillingCustomerID,
		Subscription: billingInfo.StripeSubscriptionID,
		SubscriptionDetails: &stripe.InvoiceCreatePreviewSubscriptionDetailsParams{
			DefaultTaxRates:       defaultTaxRates,
			ProrationDate:         stripe.Int64(prorationDateSeconds),
			ProrationBehavior:     stripe.String("always_invoice"),
			BillingCycleAnchorNow: stripe.Bool(true),
			Items: []*stripe.InvoiceCreatePreviewSubscriptionDetailsItemParams{
				{
					ID:    stripe.String(stripeSubscription.Items.Data[0].ID),
					Price: stripe.String(string(plan.GetPriceIdByOfferingId(offeringId))),
				},
			},
		},
	}

	upcomingInvoice, err := invoice.CreatePreview(params)
	if err != nil {
		return dto.CheckoutPreviewResponse{}, 0, errors.WithStack(err)
	}

	activePaymentMethods, err := billing.
		GetBillingService().
		GetAllActivePaymentMethods(ctx)
	if err == nil {
		return dto.NewCheckoutPreviewResponse(
			upcomingInvoice,
			taxPercentage,
			activePaymentMethods,
		), prorationDateSeconds, nil
	}

	return dto.CheckoutPreviewResponse{}, 0, err
}

func previewSubscriptionReactivationCost(
	ctx context.Context,
	userId,
	offeringId string,
) (dto.CheckoutPreviewResponse, error) {
	billingInfo, err := billing.
		GetBillingRepository().
		FindBillingInfoByUserId(ctx, nil, userId)
	if err != nil {
		return dto.CheckoutPreviewResponse{}, err
	}

	defaultTaxRates, taxPercentage, err := utils.ResolveTaxRateByLocation(
		ctx,
		*billingInfo.CountryCode,
		*billingInfo.PostalCode,
	)
	if err != nil {
		return dto.CheckoutPreviewResponse{}, err
	}

	params := &stripe.InvoiceCreatePreviewParams{
		Customer: billingInfo.BillingCustomerID,
		SubscriptionDetails: &stripe.InvoiceCreatePreviewSubscriptionDetailsParams{
			DefaultTaxRates: defaultTaxRates,
			Items: []*stripe.InvoiceCreatePreviewSubscriptionDetailsItemParams{
				{
					Price: stripe.String(string(plan.GetPriceIdByOfferingId(offeringId))),
				},
			},
		},
	}

	upcomingInvoice, err := invoice.CreatePreview(params)
	if err != nil {
		return dto.CheckoutPreviewResponse{}, errors.WithStack(err)
	}

	activePaymentMethods, err := billing.
		GetBillingService().
		GetAllActivePaymentMethods(ctx)
	if err == nil {
		return dto.NewCheckoutPreviewResponse(
			upcomingInvoice,
			taxPercentage,
			activePaymentMethods), nil
	}

	return dto.CheckoutPreviewResponse{}, err
}

func (subscriptionService *SubscriptionService) FindActiveSubscriptionForUser(
	ctx context.Context,
	userId string,
) (*dto.Subscription, error) {
	associatedSubscription, err := subscriptionRepository.FindSubscriptionByUserId(ctx, nil, userId)
	if err == nil {
		allPlans, err := subscriptionService.getAllPlans(ctx)
		if err != nil {
			return nil, err
		}

		indexOfActivePlan := slices.IndexFunc(allPlans, func(plan dto.Plan) bool {
			return plan.OfferingId == associatedSubscription.PlanOfferingID
		})

		return dto.NewSubscription(associatedSubscription, &allPlans[indexOfActivePlan]), nil
	}

	if !database.IsEmptyResultError(err) {
		subscriptionServiceLogger.ErrorAttrs(
			ctx,
			err,
			"failed to find active subscription by user ID",
			slog.String("userEmail", jwt.GetUserEmailClaim(ctx)),
		)

		return nil, exception.NewUnknownException("failed to find active subscription")
	}

	return nil, err
}

func (subscriptionService *SubscriptionService) getSubscriptionCancellationRefundAmount(
	ctx context.Context,
) (int64, exception.Exception) {
	userId := jwt.GetUserIdClaim(ctx)
	userEmailAttr := slog.String("userEmail", jwt.GetUserEmailClaim(ctx))
	activeSubscription, err := subscriptionRepository.FindSubscriptionByUserId(ctx, nil, userId)
	planAttr := slog.String("plan", plan.PlanNameTable[activeSubscription.PlanOfferingID])

	if plan.IsFreePlan(activeSubscription.PlanOfferingID) {
		subscriptionServiceLogger.InfoAttrs(
			ctx,
			"cannot get cancellation refund for free plan",
			userEmailAttr,
			planAttr,
		)

		return 0, exception.NewValidationException("free plan cannot get cancellation refund")
	}

	if err != nil {
		subscriptionServiceLogger.ErrorAttrs(
			ctx,
			err,
			"failed to query for active subscription",
			userEmailAttr,
			planAttr,
		)

		return 0, exception.NewUnknownException("failed to get subscription cancellation refund amount")
	}

	refundAmount, err := billing.
		GetBillingService().
		GetSubscriptionCancellationRefundAmount(ctx, userId)
	if err == nil {
		return refundAmount, nil
	}

	if exception.IsOfExceptionType[exception.ValidationException](err) {
		subscriptionServiceLogger.WarnAttrs(
			ctx,
			"cannot cancel subscription created less than 7 days ago",
			userEmailAttr,
			planAttr,
		)

		return 0, exception.GetAsApplicationException(err, "failed to get subscription cancellation refund amount")
	}

	subscriptionServiceLogger.ErrorAttrs(
		ctx,
		err,
		"failed to get subscription cancellation refund amount",
		userEmailAttr,
		planAttr,
	)

	return 0, exception.NewUnknownException("failed to get subscription cancellation refund amount")
}

func (subscriptionService *SubscriptionService) cancelSubscription(ctx context.Context) exception.Exception {
	userId := jwt.GetUserIdClaim(ctx)
	userEmailAttr := slog.String("userEmail", jwt.GetUserEmailClaim(ctx))
	activeSubscription, err := subscriptionRepository.FindSubscriptionByUserId(ctx, nil, userId)

	if err != nil {
		subscriptionServiceLogger.ErrorAttrs(
			ctx,
			err,
			"failed to find active subscription by user ID to cancel",
			userEmailAttr,
		)

		return exception.NewUnknownException("failed to cancel subscription")
	}

	planAttr := slog.String("plan", plan.PlanNameTable[activeSubscription.PlanOfferingID])

	canceled, err := cancelSubscription(ctx, userId, planAttr.Value.String())
	if err != nil {
		subscriptionServiceLogger.ErrorAttrs(
			ctx,
			err,
			"failed to cancel active subscription",
			userEmailAttr,
			planAttr,
		)

		return exception.GetAsApplicationException(err, "failed to cancel subscription")
	}

	if !canceled {
		subscriptionServiceLogger.InfoAttrs(
			ctx,
			"sent subscription cancellation request to payment processor",
			userEmailAttr,
			planAttr,
		)
	} else {
		subscriptionServiceLogger.InfoAttrs(
			ctx,
			"canceled subscription",
			userEmailAttr,
			planAttr,
		)
	}

	return nil
}

func cancelSubscription(ctx context.Context, userId string, planName string) (bool, error) {
	billingInfo, err := billing.
		GetBillingRepository().
		FindBillingInfoByUserId(ctx, nil, userId)
	if err != nil {
		return false, err
	}

	if billingInfo.StripeSubscriptionID != nil {
		refundAmount, err := utils.RetryWithReturnedValue(func() (int64, error) {
			return billing.
				GetBillingService().
				GetSubscriptionCancellationRefundAmount(ctx, userId)
		})
		if err != nil {
			return false, err
		}

		_, err = subscription.Cancel(*billingInfo.StripeSubscriptionID, &stripe.SubscriptionCancelParams{
			Prorate: stripe.Bool(false),
		})
		if err != nil {
			return false, errors.WithStack(err)
		}

		refundErr := billing.
			GetBillingService().
			ProcessRefundForCancellation(ctx, &billingInfo, refundAmount)
		if refundErr != nil {
			subscriptionServiceLogger.ErrorAttrs(
				ctx,
				refundErr,
				"failed to process refund for subscription cancellation",
				slog.String("userEmail", jwt.GetUserEmailClaim(ctx)),
				slog.String("plan", planName),
				slog.Int64("refundAmount", refundAmount),
			)
		}

		sendSubscriptionCancellationConfirmationEmail(ctx, userId, planName, refundAmount)

		return false, nil
	}

	return true, subscriptionRepository.markSubscriptionAsCanceled(
		ctx,
		nil,
		userId,
		time.Now(),
		model.SubscriptionCancellationReasonRequestedByUser,
	)
}

func sendSubscriptionCancellationConfirmationEmail(
	ctx context.Context,
	userId string,
	subscriptionName string,
	refundAmount int64,
) {
	foundUser, err := user.FindUserById(ctx, nil, userId)
	if err != nil {
		subscriptionServiceLogger.ErrorAttrs(
			ctx,
			err,
			"failed to find user to send subscription cancellation confirmation email to",
			slog.String("userId", userId),
			slog.Int64("userId", refundAmount),
			slog.String("subscriptionName", subscriptionName),
		)

		return
	}

	cancellationConfirmationEmailBuilder := email.
		NewEmailBuilder().
		WithSubject("Subscription canceled").
		WithDestinationEmail(foundUser.Email).
		WithEmailFile("subscription-cancellation-confirmation.html").
		SetTemplateVariable("UserDisplayName", foundUser.DisplayName).
		SetTemplateVariable("Subscription", subscriptionName)

	if refundAmount > 0 {
		cancellationConfirmationEmailBuilder.SetTemplateVariable("RefundAmount", currency.Prettify(refundAmount))
	}

	messageId, err := email.SendGenericAccountAlertEmail(cancellationConfirmationEmailBuilder)
	if err == nil {
		return
	}

	subscriptionServiceLogger.ErrorAttrs(
		ctx,
		err,
		"failed to send subscription cancellation confirmation email",
		slog.String("userEmail", foundUser.Email),
		slog.String("messageId", messageId),
	)
}

// Handle subscription upgrades, downgrades and renewal internval changes
func (subscriptionService *SubscriptionService) updateSubscription(
	ctx context.Context,
	subscriptionUpdateCheckoutRequest dto.SubscriptionUpdateCheckoutRequest,
	prorationDateSeconds int64,
) (string, exception.Exception) {
	taskId, err := updateSubscription(ctx, subscriptionUpdateCheckoutRequest, prorationDateSeconds)
	logAttrs := []slog.Attr{
		slog.String("userEmail", jwt.GetUserEmailClaim(ctx)),
		slog.String("newPlan", plan.PlanNameTable[subscriptionUpdateCheckoutRequest.OfferingId]),
		slog.String("paymentMethodId", subscriptionUpdateCheckoutRequest.PaymentMethodId),
		slog.Int64("prorationDateSeconds", prorationDateSeconds),
	}

	if err == nil {
		subscriptionServiceLogger.InfoAttrs(ctx, "updated subscription", logAttrs...)

		return taskId, nil
	}

	if exception.IsOfExceptionType[exception.FailedPaymentException](err) {
		subscriptionServiceLogger.ErrorAttrs(
			ctx,
			err,
			"failed to update subscription due to payment failure",
			logAttrs...,
		)

		return "",
			exception.GetAsApplicationException(
				err,
				"failed to update subscription due to payment failure",
			)

	}

	subscriptionServiceLogger.ErrorAttrs(ctx, err, "failed to update subscription", logAttrs...)

	return "", exception.NewUnknownException("failed to update subscription")
}

func updateSubscription(
	ctx context.Context,
	subscriptionUpdateCheckoutRequest dto.SubscriptionUpdateCheckoutRequest,
	prorationDateSeconds int64,
) (taskId string, err error) {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Minute)
	defer cancel()

	err = database.UseTransaction(ctx, func(transaction pgx.Tx) error {
		userId := jwt.GetUserIdClaim(ctx)
		billingInfo, err := billing.
			GetBillingRepository().
			FindBillingInfoByUserId(ctx, transaction, userId)
		if err != nil {
			return err
		}

		stripeSubscription, err := subscription.Get(*billingInfo.StripeSubscriptionID, nil)
		if err != nil {
			return errors.WithStack(err)
		}

		defaultTaxRates, _, err := utils.ResolveTaxRateByLocation(
			ctx,
			*billingInfo.CountryCode,
			*billingInfo.PostalCode,
		)
		if err != nil {
			return err
		}

		taskIdResult, err := task.
			GetTaskService().
			AddTask(ctx, transaction, taskModel.TaskTypeSubscriptionUpdatePayment, userId)
		if err != nil {
			return err
		}

		taskId = taskIdResult

		params := &stripe.SubscriptionParams{
			BillingCycleAnchorNow: stripe.Bool(true),
			CancelAtPeriodEnd:     stripe.Bool(false),
			DefaultPaymentMethod:  &subscriptionUpdateCheckoutRequest.PaymentMethodId,
			DefaultTaxRates:       defaultTaxRates,
			Items: []*stripe.SubscriptionItemsParams{
				{
					ID: stripe.String(stripeSubscription.Items.Data[0].ID),
					Price: stripe.String(
						string(plan.GetPriceIdByOfferingId(subscriptionUpdateCheckoutRequest.OfferingId)),
					),
				},
			},
			Metadata: map[string]string{
				"offeringId": subscriptionUpdateCheckoutRequest.OfferingId,
				"userEmail":  jwt.GetUserEmailClaim(ctx),
				"userId":     userId,
				"taskId":     taskId,
			},
			PaymentBehavior:   stripe.String("error_if_incomplete"),
			ProrationBehavior: stripe.String("always_invoice"),
			ProrationDate:     stripe.Int64(prorationDateSeconds),
		}

		_, err = subscription.Update(*billingInfo.StripeSubscriptionID, params)

		return errors.WithStack(mapStripeError(err))
	})

	return taskId, err
}

func mapStripeError(err error) error {
	if err == nil {
		return nil
	}

	stripeError := err.(*stripe.Error)
	failureReason := stripeError.Error()

	if stripeError.HTTPStatusCode == http.StatusPaymentRequired && stripeError.Code != "" {
		failureReason = string(stripeError.Code)

		if stripeError.DeclineCode != "" {
			failureReason += "." + string(stripeError.DeclineCode)
		}

		return exception.NewFailedPaymentException(failureReason)
	}

	return exception.NewUnknownException(failureReason)
}

func (subscriptionService *SubscriptionService) reactivateSubscription(
	ctx context.Context,
	subscriptionReactivationCheckoutRequest dto.SubscriptionReactivationCheckoutRequest,
) (string, exception.Exception) {
	userId := jwt.GetUserIdClaim(ctx)
	userEmail := jwt.GetUserEmailClaim(ctx)
	associatedSubscription, err := subscriptionRepository.FindSubscriptionByUserId(ctx, nil, userId)
	logAttrs := []slog.Attr{
		slog.String("userEmail", userEmail),
		slog.String("plan", plan.PlanNameTable[associatedSubscription.PlanOfferingID]),
		slog.String("paymentMethodId", subscriptionReactivationCheckoutRequest.PaymentMethodId),
	}

	if err != nil {
		subscriptionServiceLogger.ErrorAttrs(
			ctx,
			err,
			"failed to query for the subscription associated with user",
			logAttrs...,
		)

		return "", exception.NewUnknownException("failed to find the subscription associated with user")
	}

	if plan.IsFreePlan(associatedSubscription.PlanOfferingID) {
		err = subscriptionRepository.MarkSubscriptionAsActive(ctx, nil, userId)
		if err != nil {
			subscriptionServiceLogger.ErrorAttrs(
				ctx,
				err,
				"failed to set free subscription's status to active",
				logAttrs...,
			)

			return "", exception.NewUnknownException("failed to reactivate free subscription")
		}

		subscriptionServiceLogger.InfoAttrs(ctx, "reactivated free subscription", logAttrs...)

		return "", nil
	}

	taskId, err := reactivatePaidSubscription(
		ctx,
		subscriptionReactivationCheckoutRequest,
		userEmail,
		associatedSubscription,
	)
	if err == nil {
		subscriptionServiceLogger.InfoAttrs(ctx, "reactivated paid subscription", logAttrs...)

		return taskId, nil
	}

	if exception.IsOfExceptionType[exception.FailedPaymentException](err) {
		subscriptionServiceLogger.ErrorAttrs(
			ctx,
			err,
			"failed to reactivate subscription due to payment failure",
			logAttrs...,
		)

		return "",
			exception.GetAsApplicationException(
				err,
				"failed to reactivate paid subscription due to payment failure",
			)
	}

	subscriptionServiceLogger.ErrorAttrs(ctx, err, "failed to reactivate paid subscription", logAttrs...)

	return "", exception.GetAsApplicationException(err, "failed to reactivate paid subscription")
}

func reactivatePaidSubscription(
	ctx context.Context,
	subscriptionReactivationCheckoutRequest dto.SubscriptionReactivationCheckoutRequest,
	userEmail string,
	associatedSubscription _jetModel.Subscription,
) (string, error) {
	if subscriptionReactivationCheckoutRequest.PaymentMethodId == "" {
		return "",
			exception.NewValidationExceptionWithExtra(exception.DefaultValidationExceptionMessage, map[string]any{
				"paymentMethodId": "missing or empty",
			})
	}

	ctx, cancel := context.WithTimeout(ctx, 5*time.Minute)
	defer cancel()

	var taskId string

	err := database.UseTransaction(ctx, func(transaction pgx.Tx) error {
		err := subscriptionRepository.DeleteSubscriptionByUserIdTx(ctx, transaction, associatedSubscription.UserID)
		if err != nil {
			return err
		}

		billingInfo, err := billing.
			GetBillingRepository().
			FindBillingInfoByUserId(ctx, transaction, associatedSubscription.UserID)
		if err != nil {
			return err
		}

		defaultTaxRates, _, err := utils.ResolveTaxRateByLocation(
			ctx,
			*billingInfo.CountryCode,
			*billingInfo.PostalCode,
		)
		if err != nil {
			return err
		}

		taskIdResult, err := task.
			GetTaskService().
			AddTask(
				ctx,
				transaction,
				taskModel.TaskTypeReactivationPayment,
				associatedSubscription.UserID,
			)
		if err != nil {
			return err
		}

		taskId = taskIdResult

		_, err = subscription.New(&stripe.SubscriptionParams{
			Customer:             billingInfo.BillingCustomerID,
			DefaultPaymentMethod: &subscriptionReactivationCheckoutRequest.PaymentMethodId,
			DefaultTaxRates:      defaultTaxRates,
			Items: []*stripe.SubscriptionItemsParams{
				{
					Price: stripe.String(string(plan.GetPriceIdByOfferingId(associatedSubscription.PlanOfferingID))),
				},
			},
			Metadata: map[string]string{
				"offeringId":   associatedSubscription.PlanOfferingID,
				"userEmail":    userEmail,
				"userId":       associatedSubscription.UserID,
				"taskId":       taskId,
				"reactivation": "true",
			},
			PaymentBehavior: stripe.String("error_if_incomplete"),
		})

		return errors.WithStack(mapStripeError(err))
	})

	return taskId, err
}

func (subscriptionService *SubscriptionService) ProcessSubscriptionDeletedEvent(
	ctx context.Context,
	stripeSubscription *stripe.Subscription,
) (model.SubscriptionCancellationReason, error) {
	var resolvedCancellationReason model.SubscriptionCancellationReason
	switch stripeSubscription.CancellationDetails.Reason {
	case stripe.SubscriptionCancellationDetailsReasonCancellationRequested:
		resolvedCancellationReason = model.SubscriptionCancellationReasonRequestedByUser
	case stripe.SubscriptionCancellationDetailsReasonPaymentDisputed:
		resolvedCancellationReason = model.SubscriptionCancellationReasonPaymentDisputed
	case stripe.SubscriptionCancellationDetailsReasonPaymentFailed:
		resolvedCancellationReason = model.SubscriptionCancellationReasonPaymentFailed
	}

	return resolvedCancellationReason, database.UseTransaction(ctx, func(transaction pgx.Tx) error {
		subscriptionMetadata := stripeSubscription.Metadata
		userId := subscriptionMetadata["userId"]

		err := billing.
			GetBillingRepository().
			UnsetStripeSubscriptionId(ctx, transaction, userId)
		if err != nil {
			return err
		}

		if resolvedCancellationReason == model.SubscriptionCancellationReasonPaymentFailed {
			foundUser, err := user.FindUserById(ctx, nil, userId)
			if err != nil {
				return err
			}

			emailBuilder := email.
				NewEmailBuilder().
				WithSubject("Subscription canceled").
				WithDestinationEmail(foundUser.Email).
				WithEmailFile("subscription-canceled-due-to-failed-payment.html").
				SetTemplateVariable("UserDisplayName", foundUser.DisplayName).
				SetTemplateVariable("Subscription", plan.PlanNameTable[subscriptionMetadata["offeringId"]])

			messageId, err := email.SendGenericAccountAlertEmail(emailBuilder)
			if err != nil {
				subscriptionServiceLogger.ErrorAttrs(
					ctx,
					err,
					"failed to send subscription cancellation confirmation email due to payment failure",
					slog.String("userEmail", foundUser.Email),
					slog.String("messageId", messageId),
					slog.String("plan", plan.PlanNameTable[subscriptionMetadata["offeringId"]]),
				)

				return err
			}
		}

		return subscriptionRepository.markSubscriptionAsCanceled(
			ctx,
			transaction,
			userId,
			time.Unix(stripeSubscription.CanceledAt, 0),
			resolvedCancellationReason,
		)
	})

}
