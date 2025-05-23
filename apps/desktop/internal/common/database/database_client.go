package database

import (
	"context"
	"database/sql"
	"sync"

	"github.com/golang-migrate/migrate/v4"
	"github.com/golang-migrate/migrate/v4/database/sqlite3"
	_ "github.com/golang-migrate/migrate/v4/source/file"
	"github.com/jmoiron/sqlx"
	_ "modernc.org/sqlite"

	jet "github.com/go-jet/jet/v2/sqlite"
	"github.com/pkg/errors"
)

var databaseClient *sqlx.DB

func InitializeDatabaseClient() {
	sync.OnceFunc(func() {
		runMigrations()
	})()
}

func runMigrations() {
	db, err := sqlx.Open("sqlite", ResolveDbConnectionString())
	if err != nil {
		panic(err)
	}

	driver, err := sqlite3.WithInstance(db.DB, &sqlite3.Config{})
	if err != nil {
		panic(err)
	}

	migrator, err := migrate.NewWithDatabaseInstance("file://./resources/database/migrations", "cloudy-clip-db", driver)
	if err != nil {
		panic(err)
	}

	err = migrator.Up()
	if err != nil && err != migrate.ErrNoChange {
		panic(err)
	}

	databaseClient = db
}

func ExecTx(ctx context.Context, transaction *sqlx.Tx, queryBuilder jet.Statement) error {
	sql, args := queryBuilder.Sql()

	_, err := transaction.Exec(sql, args...)

	return errors.WithStack(err)
}

func Exec(queryBuilder jet.Statement) error {
	sql, args := queryBuilder.Sql()

	_, err := databaseClient.Exec(sql, args...)

	return errors.WithStack(err)
}

func UseTransaction(ctx context.Context, fn func(transaction *sqlx.Tx) error) (err error) {
	transaction, err := databaseClient.BeginTxx(ctx, &sql.TxOptions{})
	if err != nil {
		return errors.WithStack(err)
	}
	defer func() {
		_ = transaction.Rollback()
	}()

	err = fn(transaction)
	if err != nil {
		return err
	}

	return errors.WithStack(transaction.Commit())
}

func SelectOne[T any](queryBuilder jet.Statement) (*T, error) {
	sql, args := queryBuilder.Sql()
	result := new(T)

	err := databaseClient.Get(result, sql, args...)

	return result, errors.WithStack(err)
}

func SelectOneTx[T any](transaction *sqlx.Tx, queryBuilder jet.Statement) (*T, error) {
	sql, args := queryBuilder.Sql()
	result := new(T)

	err := transaction.Get(result, sql, args...)

	return result, errors.WithStack(err)
}

func SelectInto(queryBuilder jet.Statement, dest ...any) error {
	sql, args := queryBuilder.Sql()

	rows := databaseClient.QueryRow(sql, args...)

	return errors.WithStack(rows.Scan(dest...))
}

func SelectIntoTx(ctx context.Context, transaction *sqlx.Tx, queryBuilder jet.Statement, dest ...any) error {
	sql, args := queryBuilder.Sql()

	rows := transaction.QueryRow(sql, args...)

	return errors.WithStack(rows.Scan(dest...))
}

func SelectMany[T any](ctx context.Context, queryBuilder jet.Statement) (*[]T, error) {
	sql, args := queryBuilder.Sql()
	result := new([]T)
	err := databaseClient.Select(result, sql, args...)

	if err != nil {
		return nil, errors.WithStack(err)
	}

	return result, errors.WithStack(err)
}

func SelectManyTx[T any](transaction *sqlx.Tx, queryBuilder jet.Statement) (*[]T, error) {
	sql, args := queryBuilder.Sql()
	result := new([]T)
	err := transaction.Select(result, sql, args...)

	if err != nil {
		return nil, errors.WithStack(err)
	}

	return result, errors.WithStack(err)
}

func Close() {
	databaseClient.Close()
}
