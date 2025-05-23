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
	ApplicationLogLevel int8             `env:"APPLICATION_LOG_LEVEL,notEmpty"`
	DatabaseName        string           `env:"DATABASE_NAME,notEmpty"`
	ExecutionProfile    ExecutionProfile `env:"EXECUTION_PROFILE,notEmpty"`
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
