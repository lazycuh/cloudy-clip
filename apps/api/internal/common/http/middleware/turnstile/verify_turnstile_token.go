package turnstile

import (
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"net/url"
	"time"

	"github.com/maypok86/otter"
	"github.com/cloudy-clip/api/internal/common/environment"
	"github.com/cloudy-clip/api/internal/common/exception"
	"github.com/cloudy-clip/api/internal/common/logger"
)

var verifiedTurnstileTokenCache, _ = otter.MustBuilder[string, bool](1000).
	WithTTL(time.Duration(5) * time.Minute).
	Build()

func VerifyTurnstileToken(request *http.Request, logger *logger.Logger) exception.Exception {
	if verifiedTurnstileTokenCache.Has(request.RemoteAddr) {
		logger.InfoAttrs(
			request.Context(),
			"turnstile token is still active, skipping verification",
			slog.String("remoteAddr", request.RemoteAddr),
		)

		return nil
	}

	turnstileToken := request.Header.Get(TurnstileTokenHeader)
	if turnstileToken == "" {
		cause := errors.New("turnstile token is missing or empty")
		err := exception.NewValidationExceptionWithExtra(
			"failed to verify turnstile token",
			map[string]any{
				"cause": []string{cause.Error()},
			},
		)

		logger.ErrorAttrs(request.Context(), cause, err.Message, slog.Any("headers", request.Header))

		return err
	}

	if request.RemoteAddr == "" {
		cause := errors.New("client's IP is empty or missing")

		err := exception.NewValidationExceptionWithExtra(
			"failed to verify turnstile token",
			map[string]any{
				"cause": []string{cause.Error()},
			},
		)

		logger.ErrorAttrs(request.Context(), cause, err.Message, slog.Any("headers", request.Header))

		return err
	}

	var formData = make(url.Values)
	formData.Add("secret", environment.Config.TurnstileSecretKey)
	formData.Add("response", turnstileToken)
	formData.Add("remoteip", request.RemoteAddr)

	response, err := http.PostForm(
		"https://challenges.cloudflare.com/turnstile/v0/siteverify",
		formData,
	)
	if err != nil {
		unknownException := exception.NewUnknownExceptionWithExtra(
			"failed to verify turnstile token",
			map[string]any{
				"cause": []string{err.Error()},
			},
		)

		logger.Errorf(request.Context(), err, "failed to verify turnstile token")

		return unknownException
	}

	var responseBody map[string]any
	err = json.NewDecoder(response.Body).Decode(&responseBody)
	if err != nil {
		logger.ErrorAttrs(
			request.Context(),
			errors.New("failed to decode turnstile verification's response body"),
			"failed to verify turnstile token",
			slog.String("reason", err.Error()),
		)

		return exception.NewUnknownExceptionWithExtra(
			"failed to verify turnstile token",
			map[string]any{
				"cause": []string{err.Error()},
			},
		)
	}

	if success, ok := responseBody["success"]; !ok || !success.(bool) {
		cause := responseBody["error-codes"]

		err := exception.NewValidationExceptionWithExtra(
			"failed to verify turnstile token",
			map[string]any{
				"cause": cause,
			},
		)

		logger.ErrorAttrs(
			request.Context(),
			fmt.Errorf("%v", cause),
			err.Message,
		)

		return err
	}

	verifiedTurnstileTokenCache.Set(request.RemoteAddr, true)

	return nil
}

func ClearCache() {
	verifiedTurnstileTokenCache.Clear()
}
