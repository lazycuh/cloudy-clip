package ulid

import (
	"crypto/rand"
	"time"

	ulid "github.com/oklog/ulid/v2"
	"github.com/pkg/errors"
)

func Generate() (string, error) {
	ms := ulid.Timestamp(time.Now())
	result, err := ulid.New(ms, rand.Reader)

	if err == nil {
		return result.String(), nil
	}

	return "", errors.WithStack(err)
}
