package utils

import (
	"errors"
	"testing"

	"github.com/stretchr/testify/require"
	"github.com/cloudy-clip/api/internal/common/utils"
	test "github.com/cloudy-clip/api/test/utils"
)

func TestRetry(t *testing.T) {
	test.Test(t, func() {
		t.Run("1. returns nil when work function completes normally", func(t2 *testing.T) {
			require.Nil(
				t2,
				utils.Retry(func() error {
					return nil
				}),
			)
		})

		t.Run("2. returns error when work function fails 3 times", func(t2 *testing.T) {
			err := errors.New("expected")
			iteration := 0
			require.Equal(
				t2,
				err,
				utils.Retry(func() error {
					iteration++
					return err
				}),
			)

			require.Equal(t2, 3, iteration)
		})

		t.Run("3. returns nil as long as work function fails fewer than 3 times", func(t2 *testing.T) {
			err := errors.New("expected")
			iteration := 0
			require.Nil(
				t2,
				utils.Retry(func() error {
					iteration++

					if iteration == 1 {
						return err
					}

					if iteration == 2 {
						return nil
					}

					return err
				}),
			)

			require.Equal(t2, 2, iteration)
		})
	})
}

func TestRetryWithReturnedValue(t *testing.T) {
	test.Test(t, func() {
		t.Run("1. returns correctly when work function completes normally", func(t2 *testing.T) {
			message, err := utils.RetryWithReturnedValue(func() (string, error) {
				return "hello world", nil
			})

			require.Nil(t2, err)
			require.Equal(t2, "hello world", message)
		})

		t.Run("2. returns error when work function fails 3 times", func(t2 *testing.T) {
			expectedError := errors.New("expected")
			iteration := 0

			_, err := utils.RetryWithReturnedValue(func() (string, error) {
				iteration++

				return "", expectedError
			})

			require.Equal(t2, expectedError, err)
			require.Equal(t2, 3, iteration)
		})

		t.Run("3. returns nil as long as work function fails fewer than 3 times", func(t2 *testing.T) {
			expectedError := errors.New("expected")
			iteration := 0

			message, err := utils.RetryWithReturnedValue(func() (string, error) {
				iteration++

				if iteration == 1 {
					return "", expectedError
				}

				if iteration == 2 {
					return "hello world", nil
				}

				return "", expectedError
			})

			require.Nil(t2, err)
			require.Equal(t2, "hello world", message)
			require.Equal(t2, 2, iteration)
		})
	})
}
