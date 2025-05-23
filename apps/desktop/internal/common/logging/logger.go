package logging

import (
	"context"
	"fmt"
	"log/slog"
	"os"

	"cloudy-clip/desktop/internal/common/exception"

	"github.com/pkg/errors"
)

type LoggerContextKey string

const (
	LoggerContextCallSiteKey   LoggerContextKey = "callSite"
	LoggerContextRemoteAddrKey LoggerContextKey = "remoteAddr"
)

type Logger struct {
	instance *slog.Logger
}

func NewLogger(loggerName string, level slog.Level) *Logger {
	handler := slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: level}).
		WithAttrs([]slog.Attr{slog.String("logger", loggerName)})

	return &Logger{
		instance: slog.New(handler),
	}
}

func (logger *Logger) InfoAttrs(ctx context.Context, message string, attrs ...slog.Attr) {
	logger.
		setupBaseLogger(ctx).
		LogAttrs(ctx, slog.LevelInfo, message, attrs...)
}

func (logger *Logger) setupBaseLogger(ctx context.Context) *slog.Logger {
	callSite := ctx.Value(LoggerContextCallSiteKey)
	if callSite == nil {
		panic(fmt.Sprintf("no '%s' key was found in context %v", LoggerContextCallSiteKey, ctx))
	}

	return logger.instance.With(
		slog.String(string(LoggerContextCallSiteKey), callSite.(string)),
	)
}

func (logger *Logger) WarnAttrs(ctx context.Context, message string, attrs ...slog.Attr) {
	logger.
		setupBaseLogger(ctx).
		LogAttrs(ctx, slog.LevelWarn, message, attrs...)
}

func (logger *Logger) ErrorAttrs(ctx context.Context, err error, message string, attrs ...slog.Attr) {
	attrs = append(attrs, slog.Any("stacktrace", exception.PrettifyStacktrace(err)))

	logger.
		setupErrorLogger(ctx, err).
		LogAttrs(ctx, slog.LevelError, message, attrs...)
}

func (logger *Logger) setupErrorLogger(ctx context.Context, err error) *slog.Logger {
	unwrappedError := errors.Unwrap(err)
	if unwrappedError == nil {
		unwrappedError = err
	}

	errorLogger := logger.
		setupBaseLogger(ctx).
		With(slog.Any("cause", unwrappedError), slog.String("errorType", fmt.Sprintf("%T", unwrappedError)))

	if exception.IsApplicationException(unwrappedError) {
		return errorLogger.With(
			slog.Any("extra", exception.GetAsApplicationException(unwrappedError, unwrappedError.Error()).GetExtra()),
		)
	}

	return errorLogger
}

func (logger *Logger) Errorf(ctx context.Context, err error, messageFormat string, args ...any) {
	logger.ErrorAttrs(ctx, err, fmt.Sprintf(messageFormat, args...))
}

func (logger *Logger) Debugf(ctx context.Context, messageFormat string, args ...any) {
	if logger.instance.Enabled(ctx, slog.LevelDebug) {
		logger.DebugAttrs(ctx, fmt.Sprintf(messageFormat, args...))
	}
}

func (logger *Logger) DebugAttrs(ctx context.Context, message string, attrs ...slog.Attr) {
	if logger.instance.Enabled(ctx, slog.LevelDebug) {
		logger.
			setupBaseLogger(ctx).
			LogAttrs(ctx, slog.LevelDebug, message, attrs...)
	}
}
