package subscription

import (
	"context"
	"time"

	jet "github.com/go-jet/jet/v2/postgres"
	"github.com/jackc/pgx/v5"
	"github.com/cloudy-clip/api/internal/common/database"
	"github.com/cloudy-clip/api/internal/subscription/model"

	_jetModel "github.com/cloudy-clip/api/internal/common/database/.jet/model"
	"github.com/cloudy-clip/api/internal/common/database/.jet/table"
)

type SubscriptionRepository struct {
}

func NewSubscriptionRepository() *SubscriptionRepository {
	return &SubscriptionRepository{}
}

func (subscriptionRepository *SubscriptionRepository) GetAllPlanEntitlements(
	ctx context.Context,
) ([]model.PlanEntitlement, error) {
	queryBuilder := table.PlanEntitlementTable.
		SELECT(table.PlanEntitlementTable.AllColumns.As(""), table.PlanTable.DisplayName.AS("plan_display_name")).
		FROM(
			table.PlanEntitlementTable.INNER_JOIN(
				table.PlanTable,
				table.PlanEntitlementTable.PlanID.EQ(table.PlanTable.PlanID),
			),
		)

	return database.SelectMany[model.PlanEntitlement](ctx, queryBuilder)
}

func (subscriptionRepository *SubscriptionRepository) GetAllPlanOfferings(
	ctx context.Context,
) ([]_jetModel.PlanOffering, error) {
	queryBuilder := table.PlanOfferingTable.SELECT(table.PlanOfferingTable.AllColumns.As(""))

	return database.SelectMany[_jetModel.PlanOffering](ctx, queryBuilder)
}

func (subscriptionRepository *SubscriptionRepository) CreateSubscription(
	ctx context.Context,
	transaction pgx.Tx,
	subscriptionModel _jetModel.Subscription,
) error {
	queryBuilder := table.SubscriptionTable.
		INSERT(table.SubscriptionTable.AllColumns).
		MODEL(subscriptionModel)

	if transaction != nil {
		return database.ExecTx(ctx, transaction, queryBuilder)
	}

	return database.Exec(ctx, queryBuilder)
}

func (subscriptionRepository *SubscriptionRepository) UpdateSubscriptionPlan(
	ctx context.Context,
	transaction pgx.Tx,
	userId,
	newOfferingId string,
) error {
	queryBuilder := table.SubscriptionTable.
		UPDATE(
			table.SubscriptionTable.PlanOfferingID,
			table.SubscriptionTable.CanceledAt,
			table.SubscriptionTable.CancellationReason,
		).
		SET(newOfferingId, nil, nil).
		WHERE(table.SubscriptionTable.UserID.EQ(jet.String(userId)))

	if transaction != nil {
		return database.ExecTx(ctx, transaction, queryBuilder)
	}

	return database.Exec(ctx, queryBuilder)
}

func (subscriptionRepository *SubscriptionRepository) MarkSubscriptionAsActive(
	ctx context.Context,
	transaction pgx.Tx,
	userId string,
) error {
	queryBuilder := table.SubscriptionTable.
		UPDATE(table.SubscriptionTable.CanceledAt, table.SubscriptionTable.CancellationReason).
		SET(nil, nil).
		WHERE(table.SubscriptionTable.UserID.EQ(jet.String(userId)))

	if transaction != nil {
		return database.ExecTx(ctx, transaction, queryBuilder)
	}

	return database.Exec(ctx, queryBuilder)
}

func (subscriptionRepository *SubscriptionRepository) FindSubscriptionByUserId(
	ctx context.Context,
	transaction pgx.Tx,
	userId string,
) (_jetModel.Subscription, error) {
	queryBuilder := table.SubscriptionTable.
		SELECT(table.SubscriptionTable.AllColumns.As("")).
		WHERE(table.SubscriptionTable.UserID.EQ(jet.String(userId))).
		LIMIT(1)

	if transaction != nil {
		return database.SelectOneTx[_jetModel.Subscription](ctx, transaction, queryBuilder)
	}

	return database.SelectOne[_jetModel.Subscription](ctx, queryBuilder)
}

func (subscriptionRepository *SubscriptionRepository) DeleteSubscriptionByUserId(
	ctx context.Context,
	userId string,
) error {
	queryBuilder := table.SubscriptionTable.
		DELETE().
		WHERE(table.SubscriptionTable.UserID.EQ(jet.String(userId)))

	return database.Exec(ctx, queryBuilder)
}

func (subscriptionRepository *SubscriptionRepository) DeleteSubscriptionByUserIdTx(
	ctx context.Context,
	transaction pgx.Tx,
	userId string,
) error {
	queryBuilder := table.SubscriptionTable.
		DELETE().
		WHERE(table.SubscriptionTable.UserID.EQ(jet.String(userId)))

	return database.ExecTx(ctx, transaction, queryBuilder)
}

func (subscriptionRepository *SubscriptionRepository) markSubscriptionAsCanceled(
	ctx context.Context,
	transaction pgx.Tx,
	userId string,
	canceledAt time.Time,
	reason model.SubscriptionCancellationReason,
) error {
	queryBuilder := table.SubscriptionTable.
		UPDATE(table.SubscriptionTable.CanceledAt, table.SubscriptionTable.CancellationReason).
		SET(canceledAt, reason).
		WHERE(table.SubscriptionTable.UserID.EQ(jet.String(userId)))

	if transaction != nil {
		return database.ExecTx(ctx, transaction, queryBuilder)
	}

	return database.Exec(ctx, queryBuilder)
}
