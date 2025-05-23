package exception

import "net/http"

type FailedPaymentException struct {
	ApplicationException
}

func NewFailedPaymentException(failureReason string) FailedPaymentException {
	applicationException := ApplicationException{
		Message:    "payment failed with reason \"" + failureReason + "\"",
		StatusCode: http.StatusPaymentRequired,
		Extra: map[string]any{
			"failureReason": failureReason,
		},
	}

	return FailedPaymentException{
		applicationException,
	}
}
