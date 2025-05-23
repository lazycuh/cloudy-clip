package utils

import (
	"crypto/rand"
	"time"

	"github.com/oklog/ulid/v2"
	"github.com/pkg/errors"
)

func Generate() string {
	id, _ := RetryWithReturnedValue(func() (string, error) {
		ms := ulid.Timestamp(time.Now())
		result, err := ulid.New(ms, rand.Reader)

		if err == nil {
			return result.String(), nil
		}

		return "", errors.WithStack(err)
	})

	return id
}
