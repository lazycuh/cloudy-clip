package jwt

import (
	"encoding/hex"
	"fmt"
	"sync"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/pkg/errors"
	"github.com/cloudy-clip/api/internal/common/environment"
)

var jwtSigningSecret []byte
var once sync.Once

func Sign(userClaims *UserClaims) (string, error) {
	issuer := environment.Config.JwtIssuer
	now := jwt.NewNumericDate(time.Now())

	userClaims.RegisteredClaims = jwt.RegisteredClaims{
		ExpiresAt: jwt.NewNumericDate(now.Add(time.Duration(environment.Config.JwtTtlSeconds) * time.Second)),
		IssuedAt:  now,
		NotBefore: now,
		Issuer:    issuer,
		Subject:   userClaims.UserId,
		Audience:  []string{issuer},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, userClaims)

	jwt.NewParser()

	result, err := token.SignedString(GetJwtSigningSecret())

	return result, errors.WithStack(err)
}

func GetJwtSigningSecret() []byte {
	once.Do(func() {
		jwtSigningSecretByteArray, err := hex.DecodeString(environment.Config.SigningSecret)
		if err != nil {
			panic(fmt.Errorf("failed to decode jwt signing secret. Root cause was %v", err))
		}

		jwtSigningSecret = jwtSigningSecretByteArray
	})

	return jwtSigningSecret
}
