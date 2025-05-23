package environment

import (
	"errors"
	"fmt"
	"path/filepath"
	"runtime"

	env "github.com/caarlos0/env/v11"
)

type ExecutionProfile string
type PriceId string

const (
	ExecutionProfileCi          ExecutionProfile = "ci"
	ExecutionProfileDevelopment ExecutionProfile = "development"
	ExecutionProfileProduction  ExecutionProfile = "production"
	ExecutionProfileStaging     ExecutionProfile = "staging"
	ExecutionProfileTest        ExecutionProfile = "test"
)

type config struct {
	AccessControlAllowOrigin    string           `env:"ACCESS_CONTROL_ALLOW_ORIGIN,notEmpty"`
	DatabaseHost                string           `env:"DATABASE_HOST,notEmpty"`
	ApplicationLogLevel         int8             `env:"APPLICATION_LOG_LEVEL,notEmpty"`
	DatabaseName                string           `env:"DATABASE_NAME,notEmpty"`
	DatabasePassword            string           `env:"DATABASE_PASSWORD,notEmpty"`
	DatabasePort                string           `env:"DATABASE_PORT,notEmpty"`
	DatabaseUsername            string           `env:"DATABASE_USERNAME,notEmpty"`
	EmailProviderApiKey         string           `env:"EMAIL_PROVIDER_API_KEY,notEmpty"`
	EmailProviderDomain         string           `env:"EMAIL_PROVIDER_DOMAIN,notEmpty"`
	ExecutionProfile            ExecutionProfile `env:"EXECUTION_PROFILE,notEmpty"`
	JwtIssuer                   string           `env:"JWT_ISSUER,notEmpty"`
	JwtTtlSeconds               uint16           `env:"JWT_TTL_SECONDS,notEmpty"`
	Oauth2DiscordClientId       string           `env:"OAUTH2_DISCORD_CLIENT_ID,notEmpty"`
	Oauth2DiscordClientSecret   string           `env:"OAUTH2_DISCORD_CLIENT_SECRET,notEmpty"`
	Oauth2FacebookClientId      string           `env:"OAUTH2_FACEBOOK_CLIENT_ID,notEmpty"`
	Oauth2FacebookAppSecret     string           `env:"OAUTH2_FACEBOOK_APP_SECRET,notEmpty"`
	Oauth2GoogleClientId        string           `env:"OAUTH2_GOOGLE_CLIENT_ID,notEmpty"`
	Oauth2GoogleClientSecret    string           `env:"OAUTH2_GOOGLE_CLIENT_SECRET,notEmpty"`
	ServerHost                  string           `env:"SERVER_HOST,notEmpty"`
	ServerIdleTimeout           uint8            `env:"SERVER_IDLE_TIMEOUT,notEmpty"`
	ServerPort                  string           `env:"SERVER_PORT,notEmpty"`
	ServerReadTimeout           uint8            `env:"SERVER_READ_TIMEOUT,notEmpty"`
	ServerWriteTimeout          uint8            `env:"SERVER_WRITE_TIMEOUT,notEmpty"`
	SigningSecret               string           `env:"SIGNING_SECRET,notEmpty"`
	PaymentGatewayApiKey        string           `env:"PAYMENT_GATEWAY_API_KEY,notEmpty"`
	PaymentGatewayWebhookSecret string           `env:"PAYMENT_GATEWAY_WEBHOOK_SECRET,notEmpty"`
	PriceIdFreeMonthly          PriceId          `env:"PRICE_ID_FREE_MONTHLY,notEmpty"`
	PriceIdFreeYearly           PriceId          `env:"PRICE_ID_FREE_YEARLY,notEmpty"`
	PriceIdLiteMonthly          PriceId          `env:"PRICE_ID_LITE_MONTHLY,notEmpty"`
	PriceIdLiteYearly           PriceId          `env:"PRICE_ID_LITE_YEARLY,notEmpty"`
	PriceIdEssentialMonthly     PriceId          `env:"PRICE_ID_ESSENTIAL_MONTHLY,notEmpty"`
	PriceIdEssentialYearly      PriceId          `env:"PRICE_ID_ESSENTIAL_YEARLY,notEmpty"`
	TurnstileSecretKey          string           `env:"TURNSTILE_SECRET_KEY,notEmpty"`
	UserSessionLifeTimeSeconds  uint             `env:"USER_SESSION_LIFE_TIME_SECONDS,notEmpty"`
}

var Config config
var ProjectRoot = func() string {
	_, currentFilename, _, ok := runtime.Caller(0)
	if !ok {
		panic("Could not get caller information")
	}

	return filepath.Join(filepath.Dir(currentFilename), "..", "..", "..")
}()
var ResourcesDirectory = filepath.Join(ProjectRoot, "resources")

func Initialize(executionProfile ExecutionProfile) {
	err := env.ParseWithOptions(&Config, env.Options{
		Prefix:          "CLOUDY_CLIP_",
		RequiredIfNoDef: true,
	})
	if err != nil {
		fmt.Printf("Error: %v\n", err)
		panic(errors.New("failed to load environment variables into struct"))
	}

	Config.ExecutionProfile = executionProfile
}
