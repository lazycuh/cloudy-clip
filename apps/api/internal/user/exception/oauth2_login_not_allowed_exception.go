package exception

import (
	"net/http"

	"github.com/cloudy-clip/api/internal/common/exception"
	"github.com/cloudy-clip/api/internal/user/model"
)

type Oauth2LoginNotAllowedException struct {
	exception.ApplicationException
}

func NewOauth2LoginNotAllowedException(email string, provider model.Oauth2Provider) Oauth2LoginNotAllowedException {
	applicationException := exception.ApplicationException{
		Message:    "oauth2 login is not allowed",
		StatusCode: http.StatusBadRequest,
		Extra: map[string]any{
			"email":    email,
			"provider": provider,
		},
	}

	return Oauth2LoginNotAllowedException{
		applicationException,
	}

}
