package database

import (
	"context"
	"log/slog"
	"sync"

	jet "github.com/go-jet/jet/v2/postgres"
	pgx "github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/pkg/errors"
)

type DatabaseClient struct {
	connectionPool *pgxpool.Pool
}

var databaseClient *DatabaseClient

func InitializeDatabaseClient() {
	sync.OnceFunc(func() {
		databaseClient = &DatabaseClient{
			connectionPool: newConnectionPool(),
		}
	})()
}

func newConnectionPool() *pgxpool.Pool {
	pgxpoolConfig, err := newPgxConnConfig(newConfig())
	if err != nil {
		slog.Error("failed to create pgxpool config", "error", err)

		panic(err)
	}

	connectionPool, err := pgxpool.NewWithConfig(context.Background(), pgxpoolConfig)
	if err != nil {
		slog.Error("failed to create connection pool", "error", err)

		panic(err)
	}

	return connectionPool
}

func newPgxConnConfig(conf *config) (*pgxpool.Config, error) {
	connectionString := conf.resolveDbConnectionString()

	pgxpoolConfig, err := pgxpool.ParseConfig(connectionString)
	if err != nil {
		slog.Error("Failed to create pgxpool config", "error", err)

		return nil, err
	}

	// pgxpoolConfig.MaxConns = defaultMaxConns
	// pgxpoolConfig.MinConns = defaultMinConns
	// pgxpoolConfig.MaxConnIdleTime = defaultMaxConnIdleTime
	// pgxpoolConfig.ConnConfig.ConnectTimeout = defaultConnectTimeout

	return pgxpoolConfig, nil
}

func ExecTx(ctx context.Context, transaction pgx.Tx, queryBuilder jet.Statement) error {
	sql, args := queryBuilder.Sql()

	_, err := transaction.Exec(ctx, sql, args...)

	return errors.WithStack(err)
}

func Exec(ctx context.Context, queryBuilder jet.Statement) error {
	sql, args := queryBuilder.Sql()

	_, err := databaseClient.connectionPool.Exec(ctx, sql, args...)

	return errors.WithStack(err)
}

func UseTransaction(ctx context.Context, fn func(transaction pgx.Tx) error) (err error) {
	transaction, err := databaseClient.connectionPool.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return errors.WithStack(err)
	}
	defer func() {
		_ = transaction.Rollback(ctx)
	}()

	err = fn(transaction)
	if err != nil {
		return err
	}

	return errors.WithStack(transaction.Commit(ctx))
}

func SelectOne[T any](ctx context.Context, queryBuilder jet.Statement) (T, error) {
	sql, args := queryBuilder.Sql()

	rows, _ := databaseClient.connectionPool.Query(ctx, sql, args...)
	result, err := pgx.CollectOneRow(rows, pgx.RowToStructByName[T])

	return result, errors.WithStack(err)
}

func SelectOneTx[T any](ctx context.Context, transaction pgx.Tx, queryBuilder jet.Statement) (T, error) {
	sql, args := queryBuilder.Sql()

	// https://github.com/jackc/pgx/issues/760#issuecomment-1675866522
	rows, _ := transaction.Query(ctx, sql, args...)
	result, err := pgx.CollectOneRow(rows, pgx.RowToStructByName[T])

	return result, errors.WithStack(err)
}

func SelectInto(ctx context.Context, queryBuilder jet.Statement, dest ...any) error {
	sql, args := queryBuilder.Sql()

	rows := databaseClient.connectionPool.QueryRow(ctx, sql, args...)

	return errors.WithStack(rows.Scan(dest...))
}

func SelectIntoTx(ctx context.Context, transaction pgx.Tx, queryBuilder jet.Statement, dest ...any) error {
	sql, args := queryBuilder.Sql()

	rows := transaction.QueryRow(ctx, sql, args...)

	return errors.WithStack(rows.Scan(dest...))
}

func SelectMany[T any](ctx context.Context, queryBuilder jet.Statement) ([]T, error) {
	sql, args := queryBuilder.Sql()
	rows, err := databaseClient.connectionPool.Query(ctx, sql, args...)

	if err != nil {
		return nil, errors.WithStack(err)
	}

	defer rows.Close()

	result, err := pgx.CollectRows(rows, pgx.RowToStructByName[T])

	return result, errors.WithStack(err)
}

func SelectManyTx[T any](ctx context.Context, transaction pgx.Tx, queryBuilder jet.Statement) ([]T, error) {
	sql, args := queryBuilder.Sql()
	rows, err := transaction.Query(ctx, sql, args...)

	if err != nil {
		return nil, errors.WithStack(err)
	}

	defer rows.Close()

	result, err := pgx.CollectRows(rows, pgx.RowToStructByName[T])

	return result, errors.WithStack(err)
}

func Close() {
	databaseClient.connectionPool.Close()
}
