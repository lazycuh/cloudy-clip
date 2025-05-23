package database

import (
	"github.com/pkg/errors"
	"modernc.org/sqlite"
)

const (
	SqliteErrorCodeUniqueViolation = 2067
)

func IsDuplicateRecordError(err error) bool {
	originalError := errors.Unwrap(err)
	if originalError == nil {
		originalError = err
	}

	sqliteError, ok := originalError.(*sqlite.Error)
	if !ok {
		return false
	}

	return sqliteError.Code() == SqliteErrorCodeUniqueViolation
}

func IsEmptyResultError(err error) bool {
	if err == nil {
		return false
	}

	return err.Error() == "no rows in result set"
}
