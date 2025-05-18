package jwt

import (
	"errors"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/cloudy-clip/api/internal/common/environment"
)

func Verify(jwtValue string) (*jwt.Token, error) {
	issuer := environment.Config.JwtIssuer

	token, err := jwt.Parse(
		jwtValue,
		func(token *jwt.Token) (any, error) {
			return GetJwtSigningSecret(), nil
		},
		jwt.WithValidMethods([]string{jwt.SigningMethodHS256.Name}),
		jwt.WithAudience(issuer),
		jwt.WithIssuer(issuer),
		jwt.WithIssuedAt(),
	)
	if err != nil {
		return token, err
	}

	if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
		return token, errors.New("unexpected signing method")
	}

	jwtExpiration, err := token.Claims.GetExpirationTime()
	if err != nil {
		return token, err
	}

	if jwtExpiration.Before(time.Now()) {
		return token, errors.New("jwt has expired")
	}

	return token, nil
}
