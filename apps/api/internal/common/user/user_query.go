package user

import (
	"context"

	"github.com/go-jet/jet/v2/postgres"
	"github.com/jackc/pgx/v5"
	"github.com/cloudy-clip/api/internal/common/database"
	"github.com/cloudy-clip/api/internal/common/database/.jet/model"
	"github.com/cloudy-clip/api/internal/common/database/.jet/table"
)

func FindUserById(
	ctx context.Context,
	transaction pgx.Tx,
	userId string,
) (model.User, error) {
	return findUserBy(ctx, transaction, "user_id", userId)
}

func findUserBy(
	ctx context.Context,
	transaction pgx.Tx,
	columnName string,
	columnValue string,
) (model.User, error) {
	queryBuilder := table.UserTable.
		SELECT(table.UserTable.AllColumns.As("")).
		WHERE(postgres.RawBool(columnName+" = #1", postgres.RawArgs{"#1": columnValue})).
		LIMIT(1)

	if transaction != nil {
		return database.SelectOneTx[model.User](ctx, transaction, queryBuilder)
	}

	return database.SelectOne[model.User](ctx, queryBuilder)
}

func FindUserByEmail(
	ctx context.Context,
	transaction pgx.Tx,
	email string,
) (model.User, error) {
	return findUserBy(ctx, transaction, "email", email)
}
