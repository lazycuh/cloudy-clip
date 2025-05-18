package user

import (
	"log/slog"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/pkg/errors"
	"github.com/cloudy-clip/api/internal/common/environment"
	"github.com/cloudy-clip/api/internal/common/exception"
	_http "github.com/cloudy-clip/api/internal/common/http"
	"github.com/cloudy-clip/api/internal/common/http/middleware/context"
	"github.com/cloudy-clip/api/internal/common/http/middleware/turnstile"
	"github.com/cloudy-clip/api/internal/common/jwt"
	"github.com/cloudy-clip/api/internal/common/logger"
	"github.com/cloudy-clip/api/internal/user/dto"
)

const (
	SessionIdCookieName   = "lc__uc__ss"
	Oauth2StateCookieName = "lc__uc__st"
)

var userService *UserService
var userRepository *UserRepository
var userControllerLogger *logger.Logger

func SetupUserControllerEndpoints(parentRouter chi.Router) {
	userRepository = NewUserRepository()
	userService = NewUserService()
	userControllerLogger = logger.NewLogger(
		"UserController", slog.Level(environment.Config.ApplicationLogLevel),
	)

	parentRouter.Route("/v1/users", func(v1Router chi.Router) {
		v1Router.Group(func(router chi.Router) {
			router.Use(
				context.CallSiteMiddleware("handleUserCreation"),
				turnstile.TurnstileTokenVerifierMiddleware(userControllerLogger),
			)
			router.Post("/", handleUserCreation())
		})

		v1Router.Group(func(router chi.Router) {
			router.Use(
				context.CallSiteMiddleware("handlePartialUserUpdate"),
				turnstile.TurnstileTokenVerifierMiddleware(userControllerLogger),
				jwt.JwtVerifierMiddleware(userControllerLogger),
			)
			router.Patch("/me", handlePartialUserUpdate())
		})

		v1Router.Group(func(router chi.Router) {
			router.Use(
				context.CallSiteMiddleware("handleAnotherAccountVerificationRequest"),
				jwt.JwtVerifierMiddleware(userControllerLogger),
			)
			router.Post("/me/verification", handleAnotherAccountVerificationRequest())
		})

		v1Router.Group(func(router chi.Router) {
			router.Use(
				context.CallSiteMiddleware("handleAccountVerification"),
				turnstile.TurnstileTokenVerifierMiddleware(userControllerLogger),
			)
			router.Patch("/me/verification", handleAccountVerification())
		})

		v1Router.Group(func(router chi.Router) {
			router.Use(
				context.CallSiteMiddleware("handleLogin"),
				turnstile.TurnstileTokenVerifierMiddleware(userControllerLogger),
			)
			router.Post("/me/sessions", handleLogin())
		})

		v1Router.Group(func(router chi.Router) {
			router.Use(
				context.CallSiteMiddleware("handleUserSessionRestoration"),
			)
			router.Get("/me/sessions/my", handleUserSessionRestoration())
		})

		v1Router.Group(func(router chi.Router) {
			router.Use(
				context.CallSiteMiddleware("handleLogout"),
				jwt.JwtVerifierMiddleware(userControllerLogger),
			)
			router.Delete("/me/sessions/my", handleLogout)
		})

		v1Router.Group(func(router chi.Router) {
			router.Use(
				context.CallSiteMiddleware("handlePasswordResetRequest"),
				turnstile.TurnstileTokenVerifierMiddleware(userControllerLogger),
			)
			router.Post("/me/reset/password", handlePasswordResetRequest())
		})

		v1Router.Group(func(router chi.Router) {
			router.Use(
				context.CallSiteMiddleware("handlePasswordReset"),
				turnstile.TurnstileTokenVerifierMiddleware(userControllerLogger),
			)
			router.Patch("/me/reset/password", handlePasswordReset())
		})
	})

	parentRouter.Route("/v1/oauth2", func(v1Router chi.Router) {
		v1Router.Group(func(router chi.Router) {
			router.Use(
				context.CallSiteMiddleware("handleGettingGoogleAuthorizationUrl"),
				turnstile.TurnstileTokenVerifierMiddleware(userControllerLogger),
			)
			router.Get("/google/url", handleGettingGoogleAuthorizationUrl())
		})

		v1Router.Group(func(router chi.Router) {
			router.Use(
				context.CallSiteMiddleware("handleGoogleLogin"),
			)
			router.Post("/google/me/sessions", handleGoogleLogin())
		})

		v1Router.Group(func(router chi.Router) {
			router.Use(
				context.CallSiteMiddleware("handleGettingFacebookAuthorizationUrl"),
				turnstile.TurnstileTokenVerifierMiddleware(userControllerLogger),
			)
			router.Get("/facebook/url", handleGettingFacebookAuthorizationUrl())
		})

		v1Router.Group(func(router chi.Router) {
			router.Use(
				context.CallSiteMiddleware("handleFacebookLogin"),
			)
			router.Post("/facebook/me/sessions", handleFacebookLogin())
		})

		v1Router.Group(func(router chi.Router) {
			router.Use(
				context.CallSiteMiddleware("handleGettingDiscordAuthorizationUrl"),
				turnstile.TurnstileTokenVerifierMiddleware(userControllerLogger),
			)
			router.Get("/discord/url", handleGettingDiscordAuthorizationUrl())
		})

		v1Router.Group(func(router chi.Router) {
			router.Use(
				context.CallSiteMiddleware("handleDiscordLogin"),
			)
			router.Post("/discord/me/sessions", handleDiscordLogin())
		})
	})
}

func handleUserCreation() http.HandlerFunc {
	return _http.GetResponseSender(
		http.StatusCreated,
		func(request *http.Request, responseWriter http.ResponseWriter) (any, error) {
			var createUserRequestPayload dto.CreateUserRequestPayload
			err := _http.ReadRequestBodyAs(request, nil, &createUserRequestPayload)
			if err != nil {
				createUserRequestPayload.Password = "..."

				userControllerLogger.ErrorAttrs(
					request.Context(),
					err,
					"failed to validate request body",
					slog.Any("requestBody", createUserRequestPayload),
				)

				return nil, err
			}

			ctx := request.Context()
			authenticatedUser, err := userService.createUser(
				ctx,
				&createUserRequestPayload,
				request.RemoteAddr,
				request.UserAgent(),
			)
			if err == nil {
				setAuthenticationCookies(responseWriter, authenticatedUser)
			}

			return authenticatedUser, err
		},
	)
}

func setAuthenticationCookies(responseWriter http.ResponseWriter, authenticatedUser *dto.AuthenticatedUser) {
	if authenticatedUser != nil {
		_http.SetCookieWithExpiration(
			responseWriter,
			jwt.JwtCookieName,
			authenticatedUser.AccessToken,
			authenticatedUser.AccessTokenExpiration,
		)
		_http.SetCookieWithExpiration(
			responseWriter,
			SessionIdCookieName,
			authenticatedUser.Session.Id,
			authenticatedUser.Session.ExpiresAt,
		)
	} else {
		_http.RemoveCookie(responseWriter, jwt.JwtCookieName)
		_http.RemoveCookie(responseWriter, SessionIdCookieName)
	}
}

func handlePartialUserUpdate() http.HandlerFunc {
	return _http.GetEmptyResponseSender(func(request *http.Request, responseWriter http.ResponseWriter) error {
		var patchUserPayload dto.PatchUserRequestPayload
		err := _http.ReadRequestBodyAs(request, nil, &patchUserPayload)
		if err != nil {
			patchUserPayload.CurrentPassword = "..."

			if patchUserPayload.NewPassword != "" {
				patchUserPayload.NewPassword = "..."
			}

			userControllerLogger.ErrorAttrs(
				request.Context(),
				err,
				"failed to validate request body",
				slog.Any("requestBody", patchUserPayload),
			)

			return err
		}

		return userService.patchUser(request.Context(), &patchUserPayload)
	})

}

func handleAnotherAccountVerificationRequest() http.HandlerFunc {
	return _http.GetEmptyResponseSender(func(request *http.Request, responseWriter http.ResponseWriter) error {
		return userService.requestAnotherAccountVerificationEmail(request.Context())
	})
}

func handleAccountVerification() http.HandlerFunc {
	return _http.GetEmptyResponseSender(func(request *http.Request, responseWriter http.ResponseWriter) error {
		verificationCode, err := _http.GetQueryParam(request.URL.Query(), "code")
		if err != nil {
			return err
		}

		return userService.verifyAccount(request.Context(), verificationCode)
	})
}

func handleLogin() http.HandlerFunc {
	return _http.GetResponseSender(
		http.StatusOK,
		func(request *http.Request, responseWriter http.ResponseWriter) (any, error) {
			var loginRequestPayload dto.LoginRequestPayload
			err := _http.ReadRequestBodyAs(request, userControllerLogger, &loginRequestPayload)
			if err != nil {
				return nil, err
			}

			authenticatedUser, err := userService.login(
				request.Context(),
				&loginRequestPayload,
				request.RemoteAddr,
				request.UserAgent(),
			)
			if err == nil {
				setAuthenticationCookies(responseWriter, authenticatedUser)
			}

			return authenticatedUser, err
		},
	)
}

func handleUserSessionRestoration() http.HandlerFunc {
	return _http.GetResponseSender(
		http.StatusOK,
		func(request *http.Request, responseWriter http.ResponseWriter) (any, error) {
			sessionIdCookie, err := request.Cookie(SessionIdCookieName)
			if err != nil {
				if errors.Is(err, http.ErrNoCookie) {
					userControllerLogger.DebugAttrs(
						request.Context(),
						"no session ID cookie was found",
						slog.String("sessionIdCookieName", SessionIdCookieName),
					)
				} else {
					userControllerLogger.ErrorAttrs(
						request.Context(),
						err,
						"failed to find session ID cookie",
						slog.String("sessionIdCookieName", SessionIdCookieName),
					)
				}

				return nil, exception.NewNotFoundException("no existing session was found")
			}

			authenticatedUser, err := userService.restoreUserSession(
				request.Context(),
				sessionIdCookie.Value,
				request.RemoteAddr,
				request.UserAgent(),
			)
			if authenticatedUser != nil {
				setAuthenticationCookies(responseWriter, authenticatedUser)
			}

			return authenticatedUser, err
		},
	)
}

func handleLogout(responseWriter http.ResponseWriter, request *http.Request) {
	setAuthenticationCookies(responseWriter, nil)

	_http.WriteNoContentResponse(responseWriter)

	userControllerLogger.InfoAttrs(
		request.Context(),
		"logged out user",
		slog.String("userEmail", jwt.GetUserEmailClaim(request.Context())),
	)
}

func handlePasswordResetRequest() http.HandlerFunc {
	return _http.GetEmptyResponseSender(func(request *http.Request, responseWriter http.ResponseWriter) error {
		var passwordResetRequestPayload dto.PasswordResetRequestPayload
		err := _http.ReadRequestBodyAs(request, userControllerLogger, &passwordResetRequestPayload)
		if err != nil {
			userServiceLogger.ErrorAttrs(
				request.Context(),
				err,
				"failed to validate request body",
				slog.Any("requestBody", passwordResetRequestPayload),
			)

			return err
		}

		return userService.requestPasswordReset(request.Context(), &passwordResetRequestPayload)
	})
}

func handlePasswordReset() http.HandlerFunc {
	return _http.GetEmptyResponseSender(func(request *http.Request, responseWriter http.ResponseWriter) error {
		var resetPasswordRequestPayload dto.ResetPasswordRequestPayload
		err := _http.ReadRequestBodyAs(request, userControllerLogger, &resetPasswordRequestPayload)
		if err != nil {
			if resetPasswordRequestPayload.Password != "" {
				resetPasswordRequestPayload.Password = "..."
			}

			userServiceLogger.ErrorAttrs(
				request.Context(),
				err,
				"failed to validate request body",
				slog.Any("requestBody", resetPasswordRequestPayload),
			)

			return err
		}

		return userService.resetPassword(request.Context(), &resetPasswordRequestPayload)
	})
}

func handleGettingGoogleAuthorizationUrl() http.HandlerFunc {
	return _http.GetResponseSender(
		http.StatusOK,
		func(request *http.Request, responseWriter http.ResponseWriter) (any, error) {
			url, state, err := userService.getGoogleAuthorizationUrl(request.Context())
			if err == nil {
				_http.SetCookieWithMaxAge(responseWriter, Oauth2StateCookieName, state, 5)

			}

			return url, nil
		},
	)
}

func handleGoogleLogin() http.HandlerFunc {
	return _http.GetResponseSender(
		http.StatusOK,
		func(request *http.Request, responseWriter http.ResponseWriter) (any, error) {
			storedStateCookie, err := request.Cookie(Oauth2StateCookieName)
			if err != nil {
				userControllerLogger.ErrorAttrs(request.Context(), err, "failed to retrieve state cookie")

				return nil, exception.NewUnknownException("failed to login with google")
			}

			authenticatedUser, err := userService.logInWithGoogle(
				request.Context(),
				request.URL.Query(),
				storedStateCookie,
				request.RemoteAddr,
				request.UserAgent(),
			)
			if err == nil {
				setAuthenticationCookies(responseWriter, authenticatedUser)

				_http.RemoveCookie(responseWriter, Oauth2StateCookieName)
			}

			return authenticatedUser, err
		},
	)
}

func handleGettingFacebookAuthorizationUrl() http.HandlerFunc {
	return _http.GetResponseSender(
		http.StatusOK,
		func(request *http.Request, responseWriter http.ResponseWriter) (any, error) {
			url, state, err := userService.getFacebookAuthorizationUrl(request.Context())
			if err == nil {
				_http.SetCookieWithMaxAge(responseWriter, Oauth2StateCookieName, state, 5)
			}

			return url, nil
		},
	)
}

func handleFacebookLogin() http.HandlerFunc {
	return _http.GetResponseSender(
		http.StatusOK,
		func(request *http.Request, responseWriter http.ResponseWriter) (any, error) {
			storedStateCookie, err := request.Cookie(Oauth2StateCookieName)
			if err != nil {
				userControllerLogger.ErrorAttrs(request.Context(), err, "failed to retrieve state cookie")

				return nil, exception.NewUnknownException("failed to login with facebook")
			}

			authenticatedUser, err := userService.logInWithFacebook(
				request.Context(),
				request.URL.Query(),
				storedStateCookie,
				request.RemoteAddr,
				request.UserAgent(),
			)
			if err == nil {
				setAuthenticationCookies(responseWriter, authenticatedUser)

				_http.RemoveCookie(responseWriter, Oauth2StateCookieName)
			}

			return authenticatedUser, err
		},
	)
}

func handleGettingDiscordAuthorizationUrl() http.HandlerFunc {
	return _http.GetResponseSender(
		http.StatusOK,
		func(request *http.Request, responseWriter http.ResponseWriter) (any, error) {
			url, state, err := userService.getDiscordAuthorizationUrl(request.Context())
			if err == nil {
				_http.SetCookieWithMaxAge(responseWriter, Oauth2StateCookieName, state, 5)
			}

			return url, err
		},
	)
}

func handleDiscordLogin() http.HandlerFunc {
	return _http.GetResponseSender(
		http.StatusOK,
		func(request *http.Request, responseWriter http.ResponseWriter) (any, error) {
			storedStateCookie, err := request.Cookie(Oauth2StateCookieName)
			if err != nil {
				userControllerLogger.ErrorAttrs(request.Context(), err, "failed to retrieve state cookie")

				return nil, exception.NewUnknownException("failed to login with discord")
			}

			authenticatedUser, err := userService.logInWithDiscord(
				request.Context(),
				request.URL.Query(),
				storedStateCookie,
				request.RemoteAddr,
				request.UserAgent(),
			)
			if err == nil {
				setAuthenticationCookies(responseWriter, authenticatedUser)

				_http.RemoveCookie(responseWriter, Oauth2StateCookieName)
			}

			return authenticatedUser, err
		},
	)
}
