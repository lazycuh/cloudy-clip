package model

import (
	"encoding/json"

	"github.com/pkg/errors"
)

type Oauth2Provider byte

const (
	Oauth2ProviderNone Oauth2Provider = iota
	Oauth2ProviderGoogle
	Oauth2ProviderFacebook
	Oauth2ProviderDiscord
)

func (provider Oauth2Provider) MarshalJSON() ([]byte, error) {
	return []byte(`"` + provider.String() + `"`), nil
}

func (provider Oauth2Provider) String() string {
	switch provider {
	case Oauth2ProviderGoogle:
		return "GOOGLE"
	case Oauth2ProviderFacebook:
		return "FACEBOOK"
	case Oauth2ProviderDiscord:
		return "DISCORD"
	case Oauth2ProviderNone:
		return ""
	}

	panic(errors.Errorf("unknown provider '%d'", provider))
}

func (provider *Oauth2Provider) UnmarshalJSON(buf []byte) error {
	var providerString string
	err := json.Unmarshal(buf, &providerString)
	if err != nil {
		return err
	}

	switch providerString {
	case "":
		*provider = Oauth2ProviderNone
	case "GOOGLE":
		*provider = Oauth2ProviderGoogle
	case "FACEBOOK":
		*provider = Oauth2ProviderFacebook
	case "DISCORD":
		*provider = Oauth2ProviderDiscord
	default:
		return errors.New("unknown oauth2 provider '" + providerString + "'")
	}

	return nil
}
