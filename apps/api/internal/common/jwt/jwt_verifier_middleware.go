package jwt

import (
	"context"
	"errors"
	"log/slog"
	"net/http"

	"github.com/golang-jwt/jwt/v5"
	"github.com/cloudy-clip/api/internal/common/exception"
	_http "github.com/cloudy-clip/api/internal/common/http"
	"github.com/cloudy-clip/api/internal/common/logger"
)

type JwtClaim string

const (
	JwtCookieName           = "lc__jv__j"
	JwtClaimUserId JwtClaim = "userId"
	JwtClaimEmail  JwtClaim = "email"
)

func JwtVerifierMiddleware(logger *logger.Logger) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		handler := func(responseWriter http.ResponseWriter, request *http.Request) {
			jwtCookie, err := request.Cookie(JwtCookieName)
			if errors.Is(err, http.ErrNoCookie) {
				logger.ErrorAttrs(request.Context(), err, "no jwt cookie with name was found")

				_http.WriteErrorResponse(
					request,
					responseWriter,
					exception.NewUnauthorizedException("jwt is missing or empty"),
				)

				return
			}

			parsedToken, err := Verify(jwtCookie.Value)
			if err != nil {
				logger.ErrorAttrs(
					request.Context(),
					err,
					"failed to verify jwt for user",
					slog.String("emailOrSubject", getEmailOrSubjectFromJwt(request.Context(), parsedToken, logger)),
					slog.String("jwt", jwtCookie.Value),
				)

				_http.WriteErrorResponse(
					request,
					responseWriter,
					exception.NewUnauthorizedException("failed to verify jwt"))

				return
			}

			jwtClaims, ok := parsedToken.Claims.(jwt.MapClaims)
			if !ok {
				logger.ErrorAttrs(
					request.Context(),
					err,
					"jwt claims is not of jwt.MapClaims type",
					slog.Any("parsedToken", parsedToken),
				)

				_http.WriteErrorResponse(
					request,
					responseWriter,
					exception.NewUnauthorizedException("failed to verify jwt"),
				)

				return
			}

			contextWithJwtClaims := context.WithValue(request.Context(), JwtClaimUserId, jwtClaims["sub"])
			contextWithJwtClaims = context.WithValue(contextWithJwtClaims, JwtClaimEmail, jwtClaims["email"])

			next.ServeHTTP(responseWriter, request.WithContext(contextWithJwtClaims))
		}

		return http.HandlerFunc(handler)
	}
}

func getEmailOrSubjectFromJwt(ctx context.Context, token *jwt.Token, logger *logger.Logger) string {
	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok {
		logger.ErrorAttrs(
			ctx,
			errors.New("unexpected type for jwt claims"),
			"failed to type-cast jwt claims",
			slog.Any("jwt", token.Raw),
			slog.Any("claims", claims),
		)

		panic(exception.NewUnauthorizedException("failed to verify jwt"))
	}

	if email, ok := claims["email"].(string); ok {
		return email
	}

	if subject, ok := claims["sub"].(string); ok {
		return subject
	}

	logger.ErrorAttrs(
		ctx,
		errors.New("no email nor subject was present"),
		"failed to get email or subject from jwt",
		slog.Any("jwt", token.Raw),
		slog.Any("claims", claims),
	)

	panic(exception.NewUnauthorizedException("failed to verify jwt"))
}

func GetUserEmailClaim(ctx context.Context) string {
	return ctx.Value(JwtClaimEmail).(string)
}

func GetUserIdClaim(ctx context.Context) string {
	return ctx.Value(JwtClaimUserId).(string)
}
