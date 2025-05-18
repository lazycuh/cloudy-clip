package exception

import (
	"net/http"

	"github.com/cloudy-clip/api/internal/common/exception"
	"github.com/cloudy-clip/api/internal/user/model"
)

type EmailPasswordLoginNotAllowedForOauth2UserException struct {
	exception.ApplicationException
}

func NewEmailPasswordLoginNotAllowedForOauth2UserException(
	email string,
	provider model.Oauth2Provider,
) EmailPasswordLoginNotAllowedForOauth2UserException {
	applicationException := exception.ApplicationException{
		Message: "oauth2 user cannot log in with email and password",
		Extra: map[string]any{
			"email":    email,
			"provider": provider,
		},
		StatusCode: http.StatusBadRequest,
	}

	return EmailPasswordLoginNotAllowedForOauth2UserException{
		applicationException,
	}

}
