package exception

import "github.com/pkg/errors"

func GetAsApplicationException(err error, defaultExceptionMessage string) Exception {
	if err == nil {
		return nil
	}

	if IsApplicationException(err) {
		if wrappedException := errors.Unwrap(err); wrappedException != nil {
			return wrappedException.(Exception)
		}

		return err.(Exception)
	}

	return NewUnknownException(defaultExceptionMessage)
}
