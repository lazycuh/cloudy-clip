package utils

import (
	"time"
)

// Retry the provided `work` if it fails at most 3 times, after which
// an error will be returned, wait 1s by default between retries.
func Retry(work func() error) error {
	retryCount := 0

	for {
		err := work()

		if err == nil {
			return nil
		}

		retryCount++

		if retryCount == 3 {
			return err
		}

		time.Sleep(time.Duration(1) * time.Second)
	}
}

// Retry the provided `work` if it fails at most 3 times, after which
// an error will be returned, wait 1s by default between retries.
func RetryWithReturnedValue[T any](work func() (T, error)) (T, error) {
	retryCount := 0

	for {
		value, err := work()
		if err == nil {
			return value, nil
		}

		time.Sleep(time.Duration(1) * time.Second)
		retryCount++

		if retryCount == 3 {
			return value, err
		}
	}
}
