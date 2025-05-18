package database

import (
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/pkg/errors"
)

const (
	PgErrorCodeUniqueViolation = "23505"
)

func IsDuplicateRecordError(err error) bool {
	originalError := errors.Unwrap(err)
	if originalError == nil {
		originalError = err
	}

	pgError, ok := originalError.(*pgconn.PgError)
	if !ok {
		return false
	}

	return pgError.SQLState() == PgErrorCodeUniqueViolation
}

func IsEmptyResultError(err error) bool {
	if err == nil {
		return false
	}

	return err.Error() == "no rows in result set"
}
