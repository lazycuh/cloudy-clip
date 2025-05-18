package ulid

import (
	"github.com/cloudy-clip/api/internal/common/utils"
)

func GenerateWithRetry() (string, error) {
	return utils.RetryWithReturnedValue(Generate)
}
