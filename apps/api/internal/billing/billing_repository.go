package billing

import (
	"context"

	jet "github.com/go-jet/jet/v2/postgres"
	"github.com/jackc/pgx/v5"
	"github.com/cloudy-clip/api/internal/billing/model"
	"github.com/cloudy-clip/api/internal/common/database"
	_jetModel "github.com/cloudy-clip/api/internal/common/database/.jet/model"
	"github.com/cloudy-clip/api/internal/common/database/.jet/table"
)

type BillingRepository struct {
}

func NewBillingRepository() *BillingRepository {
	return &BillingRepository{}
}

func (billingRepository *BillingRepository) CreateCustomerBillingInfo(
	ctx context.Context,
	billingInfo _jetModel.BillingInfo,
) error {
	queryBuilder := table.BillingInfoTable.
		INSERT(table.BillingInfoTable.AllColumns).
		MODEL(billingInfo)

	return database.Exec(ctx, queryBuilder)
}

func (billingRepository *BillingRepository) addPayment(
	ctx context.Context,
	transaction pgx.Tx,
	payment _jetModel.Payment,
) error {
	queryBuilder := table.PaymentTable.
		INSERT(table.PaymentTable.AllColumns).
		MODEL(payment)

	if transaction != nil {
		return database.ExecTx(ctx, transaction, queryBuilder)
	}

	return database.Exec(ctx, queryBuilder)
}

func (billingRepository *BillingRepository) addPaymentMethod(
	ctx context.Context,
	transaction pgx.Tx,
	paymentMethod *_jetModel.PaymentMethod,
) error {
	queryBuilder := table.PaymentMethodTable.
		INSERT(table.PaymentMethodTable.AllColumns).
		MODEL(*paymentMethod)

	if transaction != nil {
		return database.ExecTx(ctx, transaction, queryBuilder)
	}

	return database.Exec(ctx, queryBuilder)
}

func (billingRepository *BillingRepository) findAllNonDeletedPaymentMethodsByUserId(
	ctx context.Context,
	transaction pgx.Tx,
	userId string,
) ([]_jetModel.PaymentMethod, error) {
	queryBuilder := table.PaymentMethodTable.
		SELECT(table.PaymentMethodTable.AllColumns.As("")).
		WHERE(
			table.PaymentMethodTable.UserID.EQ(jet.String(userId)).
				AND(table.PaymentMethodTable.IsDeleted.EQ(jet.Bool(false))),
		)

	if transaction != nil {
		return database.SelectManyTx[_jetModel.PaymentMethod](ctx, transaction, queryBuilder)
	}

	return database.SelectMany[_jetModel.PaymentMethod](ctx, queryBuilder)
}

func (billingRepository *BillingRepository) findDefaultPaymentMethodByUserId(
	ctx context.Context,
	transaction pgx.Tx,
	userId string,
) (_jetModel.PaymentMethod, error) {
	queryBuilder := table.PaymentMethodTable.
		SELECT(table.PaymentMethodTable.AllColumns.As("")).
		WHERE(
			table.PaymentMethodTable.UserID.EQ(jet.String(userId)).
				AND(table.PaymentMethodTable.IsDefault.EQ(jet.Bool(true))),
		)

	if transaction != nil {
		return database.SelectOneTx[_jetModel.PaymentMethod](ctx, transaction, queryBuilder)
	}

	return database.SelectOne[_jetModel.PaymentMethod](ctx, queryBuilder)
}

func (billingRepository *BillingRepository) markPaymentMethodAsDeleted(
	ctx context.Context,
	transaction pgx.Tx,
	paymentMethodId string,
) error {
	return markPaymentMethodAsDeleted(
		ctx,
		transaction,
		table.PaymentMethodTable.PaymentMethodID.EQ(jet.String(paymentMethodId)),
	)
}

func markPaymentMethodAsDeleted(ctx context.Context, transaction pgx.Tx, whereClause jet.BoolExpression) error {
	queryBuilder := table.PaymentMethodTable.
		UPDATE(table.PaymentMethodTable.IsDefault, table.PaymentMethodTable.IsDeleted).
		SET(false, true).
		WHERE(whereClause)

	if transaction != nil {
		return database.ExecTx(ctx, transaction, queryBuilder)
	}

	return database.Exec(ctx, queryBuilder)
}

func (billingRepository *BillingRepository) deleteCardWithDuplicateLast4AndBrandIfFound(
	ctx context.Context,
	transaction pgx.Tx,
	userId,
	cardLast4,
	cardBrand string,
) error {
	return markPaymentMethodAsDeleted(
		ctx,
		transaction,
		table.PaymentMethodTable.UserID.EQ(jet.String(userId)).
			AND(table.PaymentMethodTable.Last4.EQ(jet.String(cardLast4))).
			AND(table.PaymentMethodTable.Brand.EQ(jet.String(cardBrand))),
	)
}

func (billingRepository *BillingRepository) unsetUserDefaultPaymentMethod(
	ctx context.Context,
	transaction pgx.Tx,
	userId string,
) error {
	queryBuilder := table.PaymentMethodTable.
		UPDATE(table.PaymentMethodTable.IsDefault).
		SET(false).
		WHERE(
			table.PaymentMethodTable.UserID.EQ(jet.String(userId)).
				AND(table.PaymentMethodTable.IsDefault.EQ(jet.Bool(true))),
		)

	return database.ExecTx(ctx, transaction, queryBuilder)
}

func (billingRepository *BillingRepository) updateBillingInfo(
	ctx context.Context,
	transaction pgx.Tx,
	userId,
	stripeSubscriptionId,
	countryCode,
	postalCode string,
) error {
	queryBuilder := table.BillingInfoTable.
		UPDATE(
			table.BillingInfoTable.StripeSubscriptionID,
			table.BillingInfoTable.CountryCode,
			table.BillingInfoTable.PostalCode,
		).
		SET(stripeSubscriptionId, countryCode, postalCode).
		WHERE(table.BillingInfoTable.UserID.EQ(jet.String(userId)))

	return database.ExecTx(ctx, transaction, queryBuilder)
}

func (billingRepository *BillingRepository) FindBillingInfoByUserId(
	ctx context.Context,
	transaction pgx.Tx,
	userId string,
) (_jetModel.BillingInfo, error) {
	queryBuilder := table.BillingInfoTable.
		SELECT(table.BillingInfoTable.AllColumns.As("")).
		WHERE(table.BillingInfoTable.UserID.EQ(jet.String(userId))).
		LIMIT(1)

	if transaction == nil {
		return database.SelectOne[_jetModel.BillingInfo](ctx, queryBuilder)
	}

	return database.SelectOneTx[_jetModel.BillingInfo](ctx, transaction, queryBuilder)
}

func (billingRepository *BillingRepository) findBillingInfoByStripeCustomerId(
	ctx context.Context,
	stripeCustomerId string,
) (_jetModel.BillingInfo, error) {
	queryBuilder := table.BillingInfoTable.
		SELECT(table.BillingInfoTable.AllColumns.As("")).
		WHERE(table.BillingInfoTable.BillingCustomerID.EQ(jet.String(stripeCustomerId))).
		LIMIT(1)

	return database.SelectOne[_jetModel.BillingInfo](ctx, queryBuilder)
}

func (billingRepository *BillingRepository) markInProgressRefundPaymentAsSuccess(
	ctx context.Context,
	billingInfo *_jetModel.BillingInfo,
) error {
	queryBuilder := table.PaymentTable.
		UPDATE(table.PaymentTable.Status).
		SET(model.PaymentStatusRefunded).
		WHERE(
			table.PaymentTable.UserID.EQ(jet.String(billingInfo.UserID)).
				AND(table.PaymentTable.Status.EQ(jet.Int8(int8(model.PaymentStatusRefundInProgress)))),
		)

	return database.Exec(ctx, queryBuilder)
}

func (billingRepository *BillingRepository) getPayments(
	ctx context.Context,
	userId string,
	offset,
	limit int64,
) ([]model.PaymentQueryResult, error) {
	paymentTable := table.PaymentTable
	paymentMethodTable := table.PaymentMethodTable
	queryBuilder := paymentTable.
		SELECT(
			paymentTable.PaymentID.AS("payment_id"),
			paymentTable.Subtotal.AS("subtotal"),
			paymentTable.Discount.AS("discount"),
			paymentTable.Tax.AS("tax"),
			paymentTable.AmountDue.AS("amount_due"),
			paymentTable.CurrencyCode.AS("currency_code"),
			paymentTable.PaidAt.AS("paid_at"),
			paymentTable.Status.AS("status"),
			paymentTable.FailureReason.AS("failure_reason"),
			paymentTable.PaymentReason.AS("payment_reason"),
			paymentMethodTable.Last4.AS("payment_method_last4"),
			paymentMethodTable.Brand.AS("payment_method_brand"),
		).
		FROM(
			paymentTable.LEFT_JOIN(
				paymentMethodTable,
				paymentTable.PaymentMethodID.EQ(paymentMethodTable.PaymentMethodID),
			),
		).
		WHERE(paymentTable.UserID.EQ(jet.String(userId))).
		OFFSET(offset).
		LIMIT(limit).
		ORDER_BY(paymentTable.PaidAt.DESC())

	return database.SelectMany[model.PaymentQueryResult](ctx, queryBuilder)
}

func (billingRepository *BillingRepository) countTotalNumberOfPaymentsForUser(
	ctx context.Context,
	userId string,
) (int, error) {
	queryBuilder := table.PaymentTable.
		SELECT(jet.COUNT(jet.Raw("*")).AS("count")).
		WHERE(table.PaymentTable.UserID.EQ(jet.String(userId)))

	var count int

	err := database.SelectInto(ctx, queryBuilder, &count)

	return count, err
}

func (billingRepository *BillingRepository) getAllActivePaymentMethods(
	ctx context.Context,
	userId string,
) ([]_jetModel.PaymentMethod, error) {
	paymentMethodTable := table.PaymentMethodTable
	queryBuilder := paymentMethodTable.
		SELECT(paymentMethodTable.AllColumns.As("")).
		WHERE(
			paymentMethodTable.UserID.EQ(jet.String(userId)).
				AND(paymentMethodTable.IsDeleted.EQ(jet.Bool(false))).
				AND(
					jet.BoolExp(jet.Raw(`
						exp_year::integer > EXTRACT(YEAR FROM NOW()) OR
						(exp_year::integer = EXTRACT(YEAR FROM NOW()) AND exp_month::integer >= EXTRACT(MONTH FROM NOW()))
					`)),
				))

	return database.SelectMany[_jetModel.PaymentMethod](ctx, queryBuilder)
}

func (billingRepository *BillingRepository) markPaymentMethodAsDefault(
	ctx context.Context,
	transaction pgx.Tx,
	paymentMethodId string,
) error {
	queryBuilder := table.PaymentMethodTable.
		UPDATE(table.PaymentMethodTable.IsDefault).
		SET(true).
		WHERE(table.PaymentMethodTable.PaymentMethodID.EQ(jet.String(paymentMethodId)))

	return database.ExecTx(ctx, transaction, queryBuilder)
}

func (billingRepository *BillingRepository) UnsetStripeSubscriptionId(
	ctx context.Context,
	transaction pgx.Tx,
	userId string,
) error {
	queryBuilder := table.BillingInfoTable.
		UPDATE(table.BillingInfoTable.StripeSubscriptionID).
		SET(nil).
		WHERE(table.BillingInfoTable.UserID.EQ(jet.String(userId)))

	return database.ExecTx(ctx, transaction, queryBuilder)
}

func (billingRepository *BillingRepository) findPaymentById(
	ctx context.Context,
	paymentId string,
) (_jetModel.Payment, error) {
	queryBuilder := table.PaymentTable.
		SELECT(table.PaymentTable.AllColumns.As("")).
		WHERE(table.PaymentTable.PaymentID.EQ(jet.String(paymentId))).
		LIMIT(1)

	return database.SelectOne[_jetModel.Payment](ctx, queryBuilder)
}
