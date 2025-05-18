package billing

import (
	"context"
	"fmt"
	"log/slog"
	"slices"
	"strconv"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/pkg/errors"
	"github.com/stripe/stripe-go/v79"
	"github.com/stripe/stripe-go/v79/charge"
	"github.com/stripe/stripe-go/v79/checkout/session"
	"github.com/stripe/stripe-go/v79/customer"
	"github.com/stripe/stripe-go/v79/customerbalancetransaction"
	"github.com/stripe/stripe-go/v79/invoice"
	"github.com/stripe/stripe-go/v79/paymentmethod"
	"github.com/stripe/stripe-go/v79/refund"
	"github.com/stripe/stripe-go/v79/setupintent"
	"github.com/stripe/stripe-go/v79/subscription"
	"github.com/cloudy-clip/api/internal/billing/dto"
	"github.com/cloudy-clip/api/internal/billing/model"
	"github.com/cloudy-clip/api/internal/common/currency"
	"github.com/cloudy-clip/api/internal/common/database"
	_jetModel "github.com/cloudy-clip/api/internal/common/database/.jet/model"
	"github.com/cloudy-clip/api/internal/common/email"
	"github.com/cloudy-clip/api/internal/common/environment"
	"github.com/cloudy-clip/api/internal/common/exception"
	_http "github.com/cloudy-clip/api/internal/common/http"
	"github.com/cloudy-clip/api/internal/common/jwt"
	_logger "github.com/cloudy-clip/api/internal/common/logger"
	"github.com/cloudy-clip/api/internal/common/plan"
	"github.com/cloudy-clip/api/internal/common/ulid"
	"github.com/cloudy-clip/api/internal/common/user"
	"github.com/cloudy-clip/api/internal/common/utils"
)

var (
	billingServiceLogger *_logger.Logger
)

type BillingService struct {
}

func NewBillingService() *BillingService {
	billingServiceLogger = _logger.NewLogger("BillingService", slog.Level(environment.Config.ApplicationLogLevel))

	return &BillingService{}
}

func (billingService *BillingService) ProcessPayment(
	ctx context.Context,
	transaction pgx.Tx,
	userId string,
	paymentStatus model.PaymentStatus,
	invoice *stripe.Invoice,
) (model.PaymentReason, error) {
	paymentReason := resolvePaymentReason(ctx, invoice)

	if invoice.Charge != nil {
		latestCharge, err := addPaymentMethodIfNew(ctx, transaction, userId, paymentReason, paymentStatus, invoice)
		if err != nil {
			return paymentReason, err
		}

		paymentRecord, err := addPaymentRecord(
			ctx,
			transaction,
			userId,
			paymentReason,
			paymentStatus,
			invoice,
			latestCharge,
		)

		if err != nil {
			return paymentReason, err
		}

		sendEmail(ctx, userId, paymentReason, paymentStatus, invoice, paymentRecord)
	} else if invoice.Total < 0 {
		err := handleRefundForDowngrade(ctx, userId, invoice)
		if err != nil {
			return model.PaymentReasonSubscriptionDowngrade, err
		}
	}

	return paymentReason, utils.Retry(func() error {
		return billingRepository.updateBillingInfo(
			ctx,
			transaction,
			userId,
			invoice.Subscription.ID,
			invoice.CustomerAddress.Country,
			invoice.CustomerAddress.PostalCode,
		)
	})
}

func resolvePaymentReason(ctx context.Context, invoice *stripe.Invoice) model.PaymentReason {
	switch invoice.BillingReason {
	case stripe.InvoiceBillingReasonSubscriptionCreate:
		if invoice.SubscriptionDetails.Metadata["reactivation"] == "true" {
			return model.PaymentReasonSubscriptionReactivation
		}

		return model.PaymentReasonNewSubscription

	case stripe.InvoiceBillingReasonSubscriptionCycle:
		return model.PaymentReasonSubscriptionRenewal

	case stripe.InvoiceBillingReasonSubscriptionUpdate:
		lineItems := invoice.Lines.Data

		if len(lineItems) != 2 {
			billingServiceLogger.WarnAttrs(
				ctx,
				"subscription_update billing reason does not have 2 line items",
				slog.Any("invoiceId", invoice.ID),
			)

			return model.PaymentReasonUnknown
		}

		if lineItems[0].Plan.Amount < lineItems[1].Plan.Amount {
			return model.PaymentReasonSubscriptionUpgrade
		}

		return model.PaymentReasonSubscriptionDowngrade

	default:
		billingServiceLogger.WarnAttrs(
			ctx,
			"unknown billing reason",
			slog.Any("invoiceId", invoice.ID),
			slog.Any("billingReason", invoice.BillingReason),
		)

		return model.PaymentReasonUnknown
	}
}

func addPaymentMethodIfNew(
	ctx context.Context,
	transaction pgx.Tx,
	userId string,
	paymentReason model.PaymentReason,
	paymentStatus model.PaymentStatus,
	invoice *stripe.Invoice,
) (*stripe.Charge, error) {
	latestCharge, err := findChargeById(ctx, invoice.Charge.ID)
	if err != nil {
		return nil, err
	}

	if paymentReason == model.PaymentReasonUnknown {
		return latestCharge, nil
	}

	allNonDeletedPaymentMethods, err := billingRepository.findAllNonDeletedPaymentMethodsByUserId(
		ctx,
		transaction,
		userId,
	)
	if err != nil {
		return nil, err
	}

	incomingPaymentMethodId := latestCharge.PaymentMethod

	paymentMethodExists := slices.ContainsFunc(
		allNonDeletedPaymentMethods,
		func(existingPaymentMethod _jetModel.PaymentMethod) bool {
			return existingPaymentMethod.PaymentMethodID == incomingPaymentMethodId
		})

	if !paymentMethodExists {
		card := latestCharge.PaymentMethodDetails.Card

		shouldMakePaymentMethodDefault := paymentStatus == model.PaymentStatusPaid

		if shouldMakePaymentMethodDefault {
			err = billingRepository.unsetUserDefaultPaymentMethod(ctx, transaction, userId)
			if err != nil {
				return nil, err
			}

			err = updateDefaultPaymentMethodOnStripeForUser(invoice.Customer.ID, incomingPaymentMethodId)
			if err != nil {
				return nil, err
			}
		}

		err = addPaymentMethod(
			ctx,
			transaction,
			&_jetModel.PaymentMethod{
				PaymentMethodID: incomingPaymentMethodId,
				ExpMonth:        strconv.FormatInt(card.ExpMonth, 10),
				ExpYear:         strconv.FormatInt(card.ExpYear, 10),
				Last4:           card.Last4,
				Brand:           string(card.Brand),
				IsDefault:       shouldMakePaymentMethodDefault,
				IsDeleted:       false,
				UserID:          userId,
			},
		)
		if err != nil {
			return nil, err
		}
	} else if paymentReason != model.PaymentReasonSubscriptionCancellation && paymentStatus == model.PaymentStatusPaid {
		defaultPaymentMethodIndex := slices.IndexFunc(
			allNonDeletedPaymentMethods,
			func(paymentMethod _jetModel.PaymentMethod) bool {
				return paymentMethod.IsDefault
			})

		if allNonDeletedPaymentMethods[defaultPaymentMethodIndex].PaymentMethodID != incomingPaymentMethodId {
			childCtx, cancel := context.WithTimeout(context.WithoutCancel(ctx), time.Minute)

			go func() {
				defer cancel()

				err := utils.Retry(func() error {
					return makePaymentMethodDefault(
						childCtx,
						userId,
						invoice.Customer.ID,
						incomingPaymentMethodId,
					)
				})
				if err != nil {
					billingServiceLogger.ErrorAttrs(
						childCtx,
						err,
						"failed to make payment method default",
						slog.String("userId", userId),
						slog.String("paymentMethodId", incomingPaymentMethodId),
						slog.String("paymentReason", paymentReason.String()),
						slog.String("chargeId", latestCharge.ID),
					)
				}
			}()
		}
	}

	return latestCharge, err
}

func findChargeById(ctx context.Context, chargeId string) (*stripe.Charge, error) {
	foundLastCharge, err := charge.Get(chargeId, &stripe.ChargeParams{})
	if err == nil {
		return foundLastCharge, nil
	}

	billingServiceLogger.ErrorAttrs(
		ctx,
		err,
		"failed to find latest charge",
		slog.String("chargeId", chargeId),
	)

	return nil, errors.WithStack(err)
}

func updateDefaultPaymentMethodOnStripeForUser(stripeCustomerId, paymentMethodId string) error {
	_, err := customer.Update(stripeCustomerId, &stripe.CustomerParams{
		InvoiceSettings: &stripe.CustomerInvoiceSettingsParams{
			DefaultPaymentMethod: stripe.String(paymentMethodId),
		},
	})

	return errors.WithStack(err)
}

func addPaymentMethod(ctx context.Context, transaction pgx.Tx, incomingPaymentMethod *_jetModel.PaymentMethod) error {
	err := billingRepository.deleteCardWithDuplicateLast4AndBrandIfFound(
		ctx,
		transaction,
		incomingPaymentMethod.UserID,
		incomingPaymentMethod.Last4,
		incomingPaymentMethod.Brand,
	)
	if err == nil {
		return billingRepository.addPaymentMethod(ctx, transaction, incomingPaymentMethod)
	}

	return err
}

func addPaymentRecord(
	ctx context.Context,
	transaction pgx.Tx,
	userId string,
	paymentReason model.PaymentReason,
	paymentStatus model.PaymentStatus,
	invoice *stripe.Invoice,
	latestCharge *stripe.Charge,
) (_jetModel.Payment, error) {
	paymentId, err := ulid.GenerateWithRetry()
	if err != nil {
		billingServiceLogger.ErrorAttrs(
			ctx,
			err,
			"failed to generate payment ID",
			slog.String("userId", userId),
		)

		paymentId = invoice.Charge.ID
	}

	payment := _jetModel.Payment{
		PaymentID:       paymentId,
		ChargeID:        &invoice.Charge.ID,
		Subtotal:        currency.FormatInt(invoice.Subtotal),
		Discount:        "0",
		Tax:             currency.FormatInt(invoice.Tax),
		AmountDue:       currency.FormatInt(invoice.AmountDue),
		CurrencyCode:    string(invoice.Currency),
		PaidAt:          time.Unix(latestCharge.Created, 0),
		Status:          paymentStatus,
		PaymentReason:   paymentReason,
		UserID:          userId,
		PaymentMethodID: &latestCharge.PaymentMethod,
	}

	if paymentStatus == model.PaymentStatusFailed || paymentStatus == model.PaymentStatusFailedRefund {
		errorCode := latestCharge.FailureCode

		if latestCharge.Outcome != nil && latestCharge.Outcome.Reason != "" {
			errorCode += "." + latestCharge.Outcome.Reason
		}

		payment.FailureReason = &errorCode
	}

	if invoice.Discount != nil {
		payment.Discount = currency.FormatInt(invoice.Discount.Coupon.AmountOff)
	}

	return payment, billingRepository.addPayment(ctx, transaction, payment)
}

func sendEmail(
	ctx context.Context,
	userId string,
	paymentReason model.PaymentReason,
	paymentStatus model.PaymentStatus,
	invoice *stripe.Invoice,
	paymentRecord _jetModel.Payment,
) {
	if paymentStatus == model.PaymentStatusPaid {
		switch paymentReason {
		case model.PaymentReasonNewSubscription:
			sendNewSubscriptionConfirmationEmail(ctx, userId, invoice, &paymentRecord)

		case model.PaymentReasonSubscriptionRenewal:
			sendSubscriptionRenewalConfirmationEmail(ctx, userId, invoice, &paymentRecord)

		case model.PaymentReasonSubscriptionUpgrade:
			sendUpgradeConfirmationEmail(ctx, userId, invoice, &paymentRecord)

		case model.PaymentReasonSubscriptionDowngrade:
			messageId, err := sendDowngradeConfirmationEmail(ctx, userId, invoice, &paymentRecord.PaymentID)
			if err != nil {
				billingServiceLogger.ErrorAttrs(
					ctx,
					err,
					"failed to send downgrade confirmation email",
					slog.String("userId", userId),
					slog.String("messageId", messageId),
					slog.String("paymentId", paymentRecord.PaymentID),
				)
			}

		case model.PaymentReasonSubscriptionReactivation:
			sendReactivationConfirmationEmail(&ctx, &userId, invoice, &paymentRecord)
		}
	} else if paymentStatus == model.PaymentStatusFailed &&
		paymentReason == model.PaymentReasonSubscriptionRenewal {
		sendFailedSubscriptionRenewalPaymentEmail(ctx, userId, invoice)
	}
}

func sendNewSubscriptionConfirmationEmail(
	ctx context.Context,
	userId string,
	invoice *stripe.Invoice,
	payment *_jetModel.Payment,
) {
	foundUser, err := user.FindUserById(ctx, nil, userId)
	if err != nil {
		billingServiceLogger.ErrorAttrs(
			ctx,
			err,
			"failed to find user to send new subscription purchase confirmation email to",
			slog.String("userId", userId),
			slog.String("paymentId", payment.PaymentID),
		)

		return
	}

	newSubscriptionPurchaseConfirmationEmailBuilder := email.
		NewEmailBuilder().
		WithSubject("Subscription purchase confirmation").
		WithDestinationEmail(foundUser.Email).
		WithEmailFile("new-subscription-purchase-confirmation.html").
		SetTemplateVariable("UserDisplayName", foundUser.DisplayName).
		SetTemplateVariable("TransactionId", payment.PaymentID).
		SetTemplateVariable(
			"Subscription",
			plan.PlanNameTable[invoice.SubscriptionDetails.Metadata["offeringId"]],
		).
		SetTemplateVariable("PurchaseDate", time.Unix(invoice.Created, 0).Format(time.DateOnly)).
		SetTemplateVariable("AmountPaid", currency.Prettify(invoice.AmountPaid))

	messageId, err := email.SendGenericAccountAlertEmail(newSubscriptionPurchaseConfirmationEmailBuilder)
	if err == nil {
		return
	}

	billingServiceLogger.ErrorAttrs(
		ctx,
		err,
		"failed to send new subscription purchase confirmation email",
		slog.String("userEmail", invoice.CustomerEmail),
		slog.String("messageId", messageId),
		slog.String("paymentId", payment.PaymentID),
	)
}

func sendSubscriptionRenewalConfirmationEmail(
	ctx context.Context,
	userId string,
	invoice *stripe.Invoice,
	payment *_jetModel.Payment,
) {
	foundUser, err := user.FindUserById(ctx, nil, userId)
	if err != nil {
		billingServiceLogger.ErrorAttrs(
			ctx,
			err,
			"failed to find user to send subscription renewal confirmation email to",
			slog.String("userId", userId),
			slog.String("paymentId", payment.PaymentID),
		)

		return
	}

	emailBuilder := email.
		NewEmailBuilder().
		WithSubject("Your subscription has been renewed!").
		WithDestinationEmail(foundUser.Email).
		WithEmailFile("subscription-renewal-confirmation.html").
		SetTemplateVariable("UserDisplayName", foundUser.DisplayName).
		SetTemplateVariable(
			"Subscription",
			plan.PlanNameTable[invoice.SubscriptionDetails.Metadata["offeringId"]],
		).
		SetTemplateVariable("TransactionId", payment.PaymentID).
		SetTemplateVariable("Date", time.Unix(invoice.Created, 0).Format(time.DateOnly)).
		SetTemplateVariable("AmountPaid", currency.Prettify(invoice.AmountPaid))

	messageId, err := email.SendGenericAccountAlertEmail(emailBuilder)
	if err == nil {
		return
	}

	billingServiceLogger.ErrorAttrs(
		ctx,
		err,
		"failed to send subscription renewal confirmation email",
		slog.String("userEmail", invoice.CustomerEmail),
		slog.String("messageId", messageId),
		slog.String("paymentId", payment.PaymentID),
	)
}

func sendUpgradeConfirmationEmail(
	ctx context.Context,
	userId string,
	invoice *stripe.Invoice,
	payment *_jetModel.Payment,
) {
	foundUser, err := user.FindUserById(ctx, nil, userId)
	if err != nil {
		billingServiceLogger.ErrorAttrs(
			ctx,
			err,
			"failed to find user to send upgrade confirmation email to",
			slog.String("userId", userId),
			slog.String("paymentId", payment.PaymentID),
		)

		return
	}

	upgradeConfirmationEmailBuilder := email.
		NewEmailBuilder().
		WithSubject("Subscription upgraded").
		WithDestinationEmail(foundUser.Email).
		WithEmailFile("upgrade-confirmation.html").
		SetTemplateVariable("UserDisplayName", foundUser.DisplayName).
		SetTemplateVariable(
			"OldSubscription",
			plan.PlanNameTable[plan.GetOfferingIdByPriceId(environment.PriceId(invoice.Lines.Data[0].Price.ID))],
		).
		SetTemplateVariable(
			"NewSubscription",
			plan.PlanNameTable[plan.GetOfferingIdByPriceId(environment.PriceId(invoice.Lines.Data[1].Price.ID))],
		).
		SetTemplateVariable("TransactionId", payment.PaymentID).
		SetTemplateVariable("PurchaseDate", time.Unix(invoice.Created, 0).Format(time.DateOnly)).
		SetTemplateVariable("AmountPaid", currency.Prettify(invoice.AmountPaid))

	messageId, err := email.SendGenericAccountAlertEmail(upgradeConfirmationEmailBuilder)
	if err == nil {
		return
	}

	billingServiceLogger.ErrorAttrs(
		ctx,
		err,
		"failed to send upgrade confirmation email",
		slog.String("userEmail", foundUser.Email),
		slog.String("messageId", messageId),
		slog.String("paymentId", payment.PaymentID),
	)

}

func sendDowngradeConfirmationEmail(
	ctx context.Context,
	userId string,
	invoice *stripe.Invoice,
	transactionId *string,
) (string, error) {
	foundUser, err := user.FindUserById(ctx, nil, userId)
	if err != nil {
		return "", err
	}

	downgradeConfirmationEmailBuilder := email.
		NewEmailBuilder().
		WithSubject("Subscription downgraded").
		WithDestinationEmail(foundUser.Email).
		WithEmailFile("downgrade-confirmation.html").
		SetTemplateVariable("UserDisplayName", foundUser.DisplayName).
		SetTemplateVariable(
			"OldSubscription",
			plan.PlanNameTable[plan.GetOfferingIdByPriceId(environment.PriceId(invoice.Lines.Data[0].Price.ID))],
		).
		SetTemplateVariable(
			"NewSubscription",
			plan.PlanNameTable[plan.GetOfferingIdByPriceId(environment.PriceId(invoice.Lines.Data[1].Price.ID))],
		).
		SetTemplateVariable("TransactionId", *transactionId).
		SetTemplateVariable("Date", time.Unix(invoice.Created, 0).Format(time.DateOnly))

	if invoice.Total > 0 {
		downgradeConfirmationEmailBuilder = downgradeConfirmationEmailBuilder.SetTemplateVariable(
			"AmountPaid",
			currency.Prettify(invoice.Total),
		)
	} else {
		downgradeConfirmationEmailBuilder = downgradeConfirmationEmailBuilder.SetTemplateVariable(
			"AmountRefunded",
			currency.Prettify(currency.Abs(invoice.Total)),
		)
	}

	return email.SendGenericAccountAlertEmail(downgradeConfirmationEmailBuilder)
}

func sendFailedSubscriptionRenewalPaymentEmail(ctx context.Context, userId string, invoice *stripe.Invoice) {
	foundUser, err := user.FindUserById(ctx, nil, userId)
	if err != nil {
		billingServiceLogger.ErrorAttrs(
			ctx,
			err,
			"failed to find user to send email to about failed subscription renewal payment",
			slog.String("userId", userId),
			slog.Int64("amount", invoice.AmountDue),
			slog.String("chargeId", invoice.Charge.ID),
		)

		return
	}

	emailBuilder := email.
		NewEmailBuilder().
		WithSubject("Failed subscription renewal payment").
		WithDestinationEmail(foundUser.Email).
		WithEmailFile("failed-subscription-renewal-payment.html").
		SetTemplateVariable("UserDisplayName", foundUser.DisplayName).
		SetTemplateVariable("PaymentAmount", currency.Prettify(invoice.AmountDue))

	messageId, err := email.SendGenericAccountAlertEmail(emailBuilder)
	if err == nil {
		return
	}

	billingServiceLogger.ErrorAttrs(
		ctx,
		err,
		"failed to send email about failed subscription renewal payment",
		slog.String("userId", userId),
		slog.Int64("amount", invoice.AmountDue),
		slog.String("chargeId", invoice.Charge.ID),
		slog.String("messageId", messageId),
	)
}

func sendReactivationConfirmationEmail(
	ctx *context.Context,
	userId *string,
	invoice *stripe.Invoice,
	payment *_jetModel.Payment,
) {
	foundUser, err := utils.RetryWithReturnedValue(func() (_jetModel.User, error) {
		return user.FindUserById(*ctx, nil, *userId)
	})
	if err != nil {
		billingServiceLogger.ErrorAttrs(
			*ctx,
			err,
			"failed to find user to send reactivation confirmation email to",
			slog.String("userId", *userId),
			slog.String("paymentId", payment.PaymentID),
		)

		return
	}

	reactivationConfirmationEmailBuilder := email.
		NewEmailBuilder().
		WithSubject("Subscription reactivated").
		WithDestinationEmail(foundUser.Email).
		WithEmailFile("reactivation-confirmation.html").
		SetTemplateVariable("UserDisplayName", foundUser.DisplayName).
		SetTemplateVariable("TransactionId", payment.PaymentID).
		SetTemplateVariable(
			"Subscription",
			plan.PlanNameTable[invoice.SubscriptionDetails.Metadata["offeringId"]],
		).
		SetTemplateVariable("PurchaseDate", time.Unix(invoice.Created, 0).Format(time.DateOnly)).
		SetTemplateVariable("AmountPaid", currency.Prettify(invoice.AmountPaid))

	messageId, err := email.SendGenericAccountAlertEmail(reactivationConfirmationEmailBuilder)
	if err == nil {
		return
	}

	billingServiceLogger.ErrorAttrs(
		*ctx,
		err,
		"failed to send reactivation confirmation email",
		slog.String("userEmail", foundUser.Email),
		slog.String("messageId", messageId),
		slog.String("paymentId", payment.PaymentID),
	)
}

func handleRefundForDowngrade(ctx context.Context, userId string, invoice *stripe.Invoice) error {
	amountToRefund := currency.Abs(invoice.Total)

	transactionId, err := processRefund(
		ctx,
		userId,
		invoice.Customer.ID,
		amountToRefund,
		model.PaymentReasonSubscriptionDowngrade,
	)
	if err != nil {
		return err
	}

	messageId, err := sendDowngradeConfirmationEmail(ctx, userId, invoice, &transactionId)
	if err == nil {
		return nil
	}

	billingServiceLogger.ErrorAttrs(
		ctx,
		err,
		"failed to send downgrade confirmation email",
		slog.String("userEmail", invoice.SubscriptionDetails.Metadata["userEmail"]),
		slog.Int64("refundAmount", amountToRefund),
		slog.String("messageId", messageId),
	)

	return err
}

func processRefund(
	ctx context.Context,
	userId,
	stripeCustomerId string,
	refundAmount int64,
	reason model.PaymentReason,
) (string, error) {
	chargeToRefundAgainst, failureReason, err := requestRefund(stripeCustomerId, refundAmount)

	if err == nil {
		return utils.RetryWithReturnedValue(func() (string, error) {
			return addPaymentRecordForRefund(
				ctx,
				userId,
				refundAmount,
				model.PaymentStatusRefundInProgress,
				chargeToRefundAgainst,
				nil,
				reason,
			)
		})
	}

	if failureReason == "" {
		failureReason = err.Error()
	}

	attrs := []slog.Attr{
		slog.String("userId", userId),
		slog.Int64("refundAmount", refundAmount),
	}
	if chargeToRefundAgainst != nil {
		attrs = append(attrs, slog.String("chargeId", chargeToRefundAgainst.ID))
	}

	_, err2 := utils.RetryWithReturnedValue(func() (string, error) {
		return addPaymentRecordForRefund(
			ctx,
			userId,
			refundAmount,
			model.PaymentStatusFailedRefund,
			chargeToRefundAgainst,
			&failureReason,
			reason,
		)
	})
	if err2 != nil {
		billingServiceLogger.ErrorAttrs(
			ctx,
			err2,
			"failed to add payment record for failed refund request",
			attrs...,
		)
	}

	return "", err
}

func requestRefund(stripeCustomerId string, refundAmount int64) (*stripe.Charge, string, error) {
	chargeToRefundAgainst, err := getChargeToRefundAgainst(stripeCustomerId, refundAmount)
	if err != nil {
		return nil, "", err
	}

	failureReason, err := sendRefundRequestToPaymentProcessor(refundAmount, chargeToRefundAgainst.ID)

	return chargeToRefundAgainst, failureReason, err
}

func getChargeToRefundAgainst(customerId string, refundAmount int64) (*stripe.Charge, error) {
	result := charge.Search(&stripe.ChargeSearchParams{
		SearchParams: stripe.SearchParams{
			Limit: stripe.Int64(1),
			Query: fmt.Sprintf(
				"customer:'%v' AND amount>=%v AND -refunded:'true' AND status:'succeeded'",
				customerId,
				refundAmount,
			),
		},
	})

	_ = result.Next()

	foundCharge := result.Current()

	if foundCharge != nil {
		return foundCharge.(*stripe.Charge), nil
	}

	if result.Err() != nil {
		return nil, errors.WithStack(result.Err())
	}

	return nil, errors.WithStack(
		exception.NewNotFoundException(fmt.Sprintf("no charge with amount %v was found", refundAmount)),
	)
}

func sendRefundRequestToPaymentProcessor(amount int64, chargeId string) (string, error) {
	refundResult, err := refund.New(&stripe.RefundParams{
		Charge: &chargeId,
		Amount: &amount,
	})
	if err == nil {
		return "", nil
	}

	return string(refundResult.FailureReason), errors.WithStack(err)
}

func addPaymentRecordForRefund(
	ctx context.Context,
	userId string,
	refundAmount int64,
	paymentStatus model.PaymentStatus,
	charge *stripe.Charge,
	failureReason *string,
	paymentReason model.PaymentReason,
) (string, error) {
	paymentId, err := ulid.Generate()
	if err != nil {
		return paymentId, err
	}

	var paymentMethodId *string
	var chargeId *string
	currencyCode := stripe.CurrencyUSD

	if charge != nil {
		chargeId = &charge.ID
		paymentMethodId = &charge.PaymentMethod
		currencyCode = charge.Currency
	}

	return paymentId, billingRepository.addPayment(
		ctx,
		nil,
		_jetModel.Payment{
			PaymentID:       paymentId,
			ChargeID:        chargeId,
			Subtotal:        currency.FormatInt(-refundAmount),
			Discount:        "0",
			Tax:             "0",
			AmountDue:       currency.FormatInt(-refundAmount),
			CurrencyCode:    string(currencyCode),
			PaidAt:          time.Now(),
			Status:          paymentStatus,
			UserID:          userId,
			FailureReason:   failureReason,
			PaymentReason:   paymentReason,
			PaymentMethodID: paymentMethodId,
		},
	)
}

func makePaymentMethodDefault(
	ctx context.Context,
	userId,
	billingCustomerId,
	paymentMethodId string,
) error {
	return database.UseTransaction(ctx, func(transaction pgx.Tx) error {
		err := billingRepository.unsetUserDefaultPaymentMethod(ctx, transaction, userId)
		if err != nil {
			return err
		}

		err = billingRepository.markPaymentMethodAsDefault(ctx, transaction, paymentMethodId)
		if err == nil {
			return updateDefaultPaymentMethodOnStripeForUser(billingCustomerId, paymentMethodId)
		}

		return err
	})
}

func (billingService *BillingService) GetSubscriptionCancellationRefundAmount(
	ctx context.Context,
	userId string,
) (int64, error) {
	billingInfo, err := billingRepository.FindBillingInfoByUserId(ctx, nil, userId)
	if err != nil {
		return 0, err
	}

	if environment.Config.ExecutionProfile == environment.ExecutionProfileProduction {
		stripeSubscription, err := subscription.Get(*billingInfo.StripeSubscriptionID, &stripe.SubscriptionParams{})
		if err != nil {
			return 0, errors.WithStack(err)
		}

		const sevenDaysInHours = 7 * 24
		subscriptionStartDate := time.Unix(stripeSubscription.Created, 0)

		if time.Since(subscriptionStartDate).Hours() < sevenDaysInHours {
			return 0, exception.NewValidationExceptionWithExtra(
				"subscription was created less than 7 days ago",
				map[string]any{
					"startDate": subscriptionStartDate,
				},
			)
		}
	}

	params := &stripe.InvoiceCreatePreviewParams{
		Customer:     billingInfo.BillingCustomerID,
		Subscription: billingInfo.StripeSubscriptionID,
		SubscriptionDetails: &stripe.InvoiceCreatePreviewSubscriptionDetailsParams{
			ProrationDate:     stripe.Int64(time.Now().Unix()),
			ProrationBehavior: stripe.String("always_invoice"),
			CancelNow:         stripe.Bool(true),
		},
	}

	invoicePreview, err := invoice.CreatePreview(params)
	if err == nil {
		return currency.Abs(invoicePreview.Total), nil
	}

	return 0, errors.WithStack(err)
}

func (billingService *BillingService) ProcessRefundForCancellation(
	ctx context.Context,
	billingInfo *_jetModel.BillingInfo,
	refundAmount int64,
) error {
	if refundAmount > 0 {
		_, err := processRefund(
			ctx,
			billingInfo.UserID,
			*billingInfo.BillingCustomerID,
			refundAmount,
			model.PaymentReasonSubscriptionCancellation,
		)

		return err
	}

	return nil
}

func (billingService *BillingService) getBillingInfo(ctx context.Context) (dto.BillingInfo, exception.Exception) {
	billingInfo, err := billingRepository.FindBillingInfoByUserId(ctx, nil, jwt.GetUserIdClaim(ctx))
	if err == nil {
		return dto.NewBillingInfo(billingInfo), nil
	}

	if database.IsEmptyResultError(err) {
		return dto.BillingInfo{}, exception.NewNotFoundException("no billing info was found")
	}

	billingServiceLogger.ErrorAttrs(
		ctx,
		err,
		"failed to get billing info",
		slog.String("userEmail", jwt.GetUserEmailClaim(ctx)),
	)

	return dto.BillingInfo{}, exception.NewUnknownException("failed to get billing info")
}

func (billingService *BillingService) getUrlToPageToAddPaymentMethod(
	ctx context.Context,
	returnUrlPath string,
) (string, exception.Exception) {
	url, err := getUrlToPageToAddPaymentMethod(ctx, returnUrlPath)
	if err == nil {
		return url, nil
	}

	if !database.IsEmptyResultError(err) {
		billingServiceLogger.ErrorAttrs(
			ctx,
			err,
			"failed to get payment method update url",
			slog.String("userEmail", jwt.GetUserEmailClaim(ctx)),
		)

		return "", exception.NewUnknownException("failed to get payment method update url")
	}

	return "", exception.NewNotFoundException("no billing info exists")
}

func getUrlToPageToAddPaymentMethod(ctx context.Context, returnUrlPath string) (string, error) {
	userId := jwt.GetUserIdClaim(ctx)
	billingInfo, err := billingRepository.FindBillingInfoByUserId(ctx, nil, userId)
	if err != nil {
		return "", err
	}

	if returnUrlPath[0] != '/' {
		returnUrlPath = "/" + returnUrlPath
	}

	params := &stripe.CheckoutSessionParams{
		PaymentMethodTypes: stripe.StringSlice([]string{
			"card",
		}),
		Customer: billingInfo.BillingCustomerID,
		Metadata: map[string]string{
			"userId": userId,
		},
		SetupIntentData: &stripe.CheckoutSessionSetupIntentDataParams{
			Metadata: map[string]string{
				"customer_id": *billingInfo.BillingCustomerID,
			},
		},
		Mode: stripe.String(string(stripe.CheckoutSessionModeSetup)),
		SuccessURL: stripe.String(
			environment.Config.AccessControlAllowOrigin + returnUrlPath + "?session_id={CHECKOUT_SESSION_ID}",
		),
		CancelURL: stripe.String(environment.Config.AccessControlAllowOrigin + returnUrlPath),
	}

	result, err := session.New(params)
	if err == nil {
		return result.URL, nil
	}

	return "", errors.WithStack(err)
}

func (billingService *BillingService) AddPaymentMethod(
	ctx context.Context,
	checkoutSession *stripe.CheckoutSession,
) error {
	getSetupIntentResult, err := setupintent.Get(checkoutSession.SetupIntent.ID, &stripe.SetupIntentParams{})
	if err != nil {
		return errors.WithStack(err)
	}

	paymentMethodId := getSetupIntentResult.PaymentMethod.ID

	getPaymentMethodResult, err := paymentmethod.Get(paymentMethodId, &stripe.PaymentMethodParams{})
	if err != nil {
		return errors.WithStack(err)
	}

	userId := checkoutSession.Metadata["userId"]

	return database.UseTransaction(ctx, func(transaction pgx.Tx) error {
		billingInfo, err := billingRepository.FindBillingInfoByUserId(ctx, transaction, userId)
		if err != nil {
			return err
		}

		shouldMakeCardTheDefault := !hasDefaultPaymentMethod(ctx, userId)
		if shouldMakeCardTheDefault {
			err := updateDefaultPaymentMethodOnStripeForUser(*billingInfo.BillingCustomerID, paymentMethodId)
			if err != nil {
				return errors.WithStack(err)
			}
		}

		card := getPaymentMethodResult.Card

		return addPaymentMethod(
			ctx,
			transaction,
			&_jetModel.PaymentMethod{
				PaymentMethodID: paymentMethodId,
				ExpMonth:        strconv.FormatInt(card.ExpMonth, 10),
				ExpYear:         strconv.FormatInt(card.ExpYear, 10),
				Last4:           card.Last4,
				Brand:           string(card.Brand),
				IsDefault:       shouldMakeCardTheDefault,
				IsDeleted:       false,
				UserID:          userId,
			},
		)
	})
}

func hasDefaultPaymentMethod(ctx context.Context, userId string) bool {
	_, err := billingRepository.findDefaultPaymentMethodByUserId(ctx, nil, userId)
	if err == nil {
		return true
	}

	if !database.IsEmptyResultError(err) {
		billingServiceLogger.ErrorAttrs(
			ctx,
			err,
			"failed to find default payment method",
			slog.String("userId", userId),
		)
	}

	return false
}

func (billingService *BillingService) getPayments(
	ctx context.Context,
	offset,
	limit int64,
) (_http.PaginationResult[dto.Payment], exception.Exception) {
	foundPayments, err := getPayments(ctx, offset, limit)
	if err == nil {
		return foundPayments, nil
	}

	billingServiceLogger.ErrorAttrs(
		ctx,
		err,
		"failed to get payments",
		slog.String("userEmail", jwt.GetUserEmailClaim(ctx)),
		slog.Int64("offset", offset),
		slog.Int64("limit", limit),
	)

	return _http.PaginationResult[dto.Payment]{}, exception.NewUnknownException("failed to get payments")
}

func getPayments(ctx context.Context, offset, limit int64) (_http.PaginationResult[dto.Payment], error) {
	userId := jwt.GetUserIdClaim(ctx)
	totalPaymentCount, err := billingRepository.countTotalNumberOfPaymentsForUser(ctx, userId)
	if err != nil {
		return _http.PaginationResult[dto.Payment]{}, err
	}

	paymentQueryResults, err := billingRepository.getPayments(ctx, userId, offset, limit)
	if err == nil {
		payments := make([]dto.Payment, 0, len(paymentQueryResults))

		for _, paymentQueryResult := range paymentQueryResults {
			payments = append(payments, dto.NewPayment(paymentQueryResult))
		}

		return _http.NewPaginationResult(payments, totalPaymentCount), nil
	}

	return _http.PaginationResult[dto.Payment]{}, err
}

func (billingService *BillingService) getReceiptUrlForPayment(
	ctx context.Context,
	paymentId string,
) (string, exception.Exception) {
	foundPayment, err := billingRepository.findPaymentById(ctx, paymentId)
	if err != nil {
		billingServiceLogger.ErrorAttrs(
			ctx,
			err,
			"failed to find payment by ID",
			slog.String("userEmail", jwt.GetUserEmailClaim(ctx)),
			slog.String("paymentId", paymentId),
		)

		if database.IsEmptyResultError(err) {
			return "", exception.NewNotFoundException("no payment was found")
		}

		return "", exception.NewUnknownException("failed to find payment")
	}

	if foundPayment.ChargeID == nil {
		billingServiceLogger.WarnAttrs(
			ctx,
			"charge ID associated with payment was not found",
			slog.String("userEmail", jwt.GetUserEmailClaim(ctx)),
			slog.String("paymentId", paymentId),
		)

		return "", exception.NewNotFoundException("no associated receipt was found")
	}

	foundCharge, err := charge.Get(*foundPayment.ChargeID, &stripe.ChargeParams{
		Expand: stripe.StringSlice([]string{
			"invoice",
		}),
	})
	if err != nil {
		err = errors.WithStack(err)

		billingServiceLogger.ErrorAttrs(
			ctx,
			err,
			"failed to retrieve associated charge for payment",
			slog.String("userEmail", jwt.GetUserEmailClaim(ctx)),
			slog.String("paymentId", paymentId),
			slog.String("chargeId", *foundPayment.ChargeID),
		)

		return "", exception.NewUnknownException("failed to retrieve receipt")
	}

	if foundPayment.Status != model.PaymentStatusPaid {
		return foundCharge.ReceiptURL, nil
	}

	return foundCharge.Invoice.HostedInvoiceURL, nil
}

func (billingService *BillingService) GetAllNonDeletedPaymentMethods(
	ctx context.Context,
) ([]dto.PaymentMethod, exception.Exception) {
	userId := jwt.GetUserIdClaim(ctx)
	paymentMethodModels, err := billingRepository.findAllNonDeletedPaymentMethodsByUserId(ctx, nil, userId)
	if err == nil {
		paymentMethods := make([]dto.PaymentMethod, 0, len(paymentMethodModels))

		for _, paymentMethodModel := range paymentMethodModels {
			paymentMethods = append(paymentMethods, dto.NewPaymentMethod(paymentMethodModel))
		}

		return paymentMethods, nil
	}

	billingServiceLogger.ErrorAttrs(
		ctx,
		err,
		"failed to get all non-deleted payment methods",
		slog.String("userEmail", jwt.GetUserEmailClaim(ctx)),
	)

	return nil, exception.NewUnknownException("failed to get all non-deleted payment methods")
}

func (billingService *BillingService) GetAllActivePaymentMethods(ctx context.Context) ([]dto.PaymentMethod, error) {
	userId := jwt.GetUserIdClaim(ctx)
	paymentMethodModels, err := billingRepository.getAllActivePaymentMethods(ctx, userId)
	if err == nil {
		paymentMethods := make([]dto.PaymentMethod, 0, len(paymentMethodModels))

		for _, paymentMethodModel := range paymentMethodModels {
			paymentMethods = append(paymentMethods, dto.NewPaymentMethod(paymentMethodModel))
		}

		return paymentMethods, nil
	}

	return nil, err
}

func (billingService *BillingService) deletePaymentMethod(
	ctx context.Context,
	paymentMethodId string,
) exception.Exception {
	err := deletePaymentMethod(ctx, paymentMethodId)
	if err == nil {
		return nil
	}

	billingServiceLogger.ErrorAttrs(
		ctx,
		err,
		"failed to delete payment method",
		slog.String("userEmail", jwt.GetUserEmailClaim(ctx)),
		slog.String("paymentMethodId", paymentMethodId),
	)

	return exception.GetAsApplicationException(err, "failed to delete payment method")
}

func deletePaymentMethod(ctx context.Context, paymentMethodId string) error {
	ctx, cancel := context.WithTimeout(context.WithoutCancel(ctx), time.Duration(10)*time.Minute)
	defer cancel()

	return database.UseTransaction(ctx, func(transaction pgx.Tx) error {
		foundDefaultPaymentMethod, err := billingRepository.findDefaultPaymentMethodByUserId(
			ctx,
			transaction,
			jwt.GetUserIdClaim(ctx),
		)
		if err != nil {
			return err
		}

		if paymentMethodId == foundDefaultPaymentMethod.PaymentMethodID {
			return exception.NewValidationException("default payment method cannot be deleted")
		}

		err = billingRepository.markPaymentMethodAsDeleted(ctx, transaction, paymentMethodId)
		if err != nil {
			return err
		}

		err = utils.Retry(func() error {
			_, err := paymentmethod.Detach(paymentMethodId, &stripe.PaymentMethodDetachParams{})

			return err
		})

		return err
	})
}

func (billingService *BillingService) setExistingPaymentMethodAsDefault(
	ctx context.Context,
	paymentMethodId string,
) exception.Exception {
	err := database.UseTransaction(ctx, func(transaction pgx.Tx) error {
		userId := jwt.GetUserIdClaim(ctx)
		err := billingRepository.unsetUserDefaultPaymentMethod(ctx, transaction, userId)
		if err != nil {
			return err
		}

		err = billingRepository.markPaymentMethodAsDefault(ctx, transaction, paymentMethodId)
		if err != nil {
			return err
		}

		billingInfo, err := billingRepository.FindBillingInfoByUserId(ctx, transaction, userId)
		if err != nil {
			return err
		}

		_, err = subscription.Update(*billingInfo.StripeSubscriptionID, &stripe.SubscriptionParams{
			DefaultPaymentMethod: stripe.String(paymentMethodId),
		})
		if err == nil {
			return updateDefaultPaymentMethodOnStripeForUser(*billingInfo.BillingCustomerID, paymentMethodId)
		}

		return errors.WithStack(err)
	})
	if err == nil {
		return nil
	}

	billingServiceLogger.ErrorAttrs(
		ctx,
		err,
		"failed to set payment method as default",
		slog.String("userEmail", jwt.GetUserEmailClaim(ctx)),
		slog.String("paymentMethodId", paymentMethodId),
	)

	return exception.NewUnknownException("failed to set payment method as default")
}

func (billingService *BillingService) getUpcomingPayment(
	ctx context.Context,
) (dto.UpcomingPayment, exception.Exception) {
	upcomingPayment, err := getUpcomingPayment(ctx)
	if err == nil {
		return upcomingPayment, nil
	}

	billingServiceLogger.ErrorAttrs(
		ctx,
		err,
		"failed to get upcoming payment",
		slog.String("userEmail", jwt.GetUserEmailClaim(ctx)),
	)

	return dto.UpcomingPayment{}, exception.GetAsApplicationException(err, "failed to get upcoming payment")
}

func getUpcomingPayment(ctx context.Context) (dto.UpcomingPayment, error) {
	billingInfo, err := billingRepository.FindBillingInfoByUserId(ctx, nil, jwt.GetUserIdClaim(ctx))
	if err != nil {
		if database.IsEmptyResultError(err) {
			return dto.UpcomingPayment{}, exception.NewNotFoundException("no billing info was found")
		}

		return dto.UpcomingPayment{}, err
	}

	if billingInfo.StripeSubscriptionID == nil {
		return dto.UpcomingPayment{}, exception.NewNotFoundException("no paid subscription was found")
	}

	defaulTaxRates, taxPercentage, err := utils.ResolveTaxRateByLocation(
		ctx,
		*billingInfo.CountryCode,
		*billingInfo.PostalCode,
	)
	if err != nil {
		return dto.UpcomingPayment{}, err
	}

	result, err := invoice.Upcoming(&stripe.InvoiceUpcomingParams{
		Subscription:                billingInfo.StripeSubscriptionID,
		SubscriptionDefaultTaxRates: defaulTaxRates,
	})
	if err == nil {
		return dto.NewUpcomingPayment(result, taxPercentage), nil
	}

	return dto.UpcomingPayment{}, errors.WithStack(err)
}

func (billingService *BillingService) ProcessSuccessfulRefund(ctx context.Context, charge *stripe.Charge) {
	ctx, cancel := context.WithTimeout(context.WithoutCancel(ctx), time.Duration(10)*time.Minute)

	defer cancel()

	billingInfo, err := billingRepository.findBillingInfoByStripeCustomerId(ctx, charge.Customer.ID)
	if err != nil {
		billingServiceLogger.ErrorAttrs(
			ctx,
			err,
			"failed to find billing info by stripe customer ID",
			slog.String("userEmail", charge.BillingDetails.Email),
			slog.String("stripeCustomerId", charge.Customer.ID),
			slog.String("chargeId", charge.ID),
			slog.Int64("refundAmount", charge.AmountRefunded),
		)

		return
	}

	err = utils.Retry(func() error {
		return updateCustomerCreditBalanceIfNeeded(&billingInfo)
	})
	if err != nil {
		billingServiceLogger.ErrorAttrs(
			ctx,
			err,
			"failed to update customer's credit balance after refund",
			slog.String("userEmail", charge.BillingDetails.Email),
			slog.String("chargeId", charge.ID),
			slog.Int64("refundAmount", charge.AmountRefunded),
		)
	}

	err = utils.Retry(func() error {
		return billingRepository.markInProgressRefundPaymentAsSuccess(ctx, &billingInfo)
	})
	if err == nil {
		return
	}

	billingServiceLogger.ErrorAttrs(
		ctx,
		err,
		"failed to set in-progress payment status to refunded",
		slog.String("userEmail", charge.BillingDetails.Email),
		slog.String("chargeId", charge.ID),
		slog.Int64("refundAmount", charge.AmountRefunded),
	)
}

func updateCustomerCreditBalanceIfNeeded(billingInfo *_jetModel.BillingInfo) error {
	params := &stripe.CustomerBalanceTransactionListParams{
		Customer: billingInfo.BillingCustomerID,
	}
	params.Limit = stripe.Int64(1)
	result := customerbalancetransaction.List(params)
	if result.Err() != nil {
		return errors.WithStack(result.Err())
	}

	_ = result.Next()

	currentBalanceTransaction, ok := result.Current().(*stripe.CustomerBalanceTransaction)
	if !ok {
		return nil
	}

	if currentBalanceTransaction.EndingBalance >= 0 {
		return nil
	}

	_, err := customerbalancetransaction.New(&stripe.CustomerBalanceTransactionParams{
		Customer: billingInfo.BillingCustomerID,
		Amount:   stripe.Int64(-currentBalanceTransaction.EndingBalance),
		Currency: stripe.String(string(currentBalanceTransaction.Currency)),
	})

	return errors.WithStack(err)
}
