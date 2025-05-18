package exception

import "errors"

func IsOfExceptionType[T any](err error) bool {
	originalError := errors.Unwrap(err)
	if originalError == nil {
		originalError = err
	}

	_, ok := originalError.(T)

	return ok

}
