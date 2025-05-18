package exception

import (
	"net/http"

	"github.com/cloudy-clip/api/internal/common/exception"
	"github.com/cloudy-clip/api/internal/user/model"
)

type PasswordResetNotAllowedForOauth2UserException struct {
	exception.ApplicationException
}

func NewPasswordResetNotAllowedForOauth2UserException(
	provider model.Oauth2Provider,
) PasswordResetNotAllowedForOauth2UserException {
	applicationException := exception.ApplicationException{
		Message:    "resetting password for oauth2 user is not allowed",
		StatusCode: http.StatusBadRequest,
		Extra: map[string]any{
			"provider": provider,
		},
	}

	return PasswordResetNotAllowedForOauth2UserException{
		applicationException,
	}

}
