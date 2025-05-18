package jwt

import (
	"time"

	"github.com/golang-jwt/jwt/v5"
)

type UserClaims struct {
	UserId         string    `json:"-"`
	Email          string    `json:"email"`
	DisplayName    string    `json:"displayName"`
	Status         string    `json:"status"`
	LastLoggedInAt time.Time `json:"lastLoggedInAt"`
	jwt.RegisteredClaims
}
