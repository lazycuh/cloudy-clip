package test

import (
	"fmt"
	"os"
	"sync"
	"testing"

	_ "github.com/jackc/pgx/v5/stdlib"
	"github.com/joho/godotenv"
	"github.com/cloudy-clip/api/internal/common/environment"
	data "github.com/cloudy-clip/api/test"
)

func Test(t *testing.T, testGroup func()) {
	var once sync.Once
	once.Do(func() {
		executionProfile := environment.ExecutionProfile(os.Getenv("TRADE_TIMELINE_EXECUTION_PROFILE"))
		loadEnvFileForExecutionProfile(executionProfile)
		environment.Initialize(executionProfile)
	})

	testGroup()
}

func loadEnvFileForExecutionProfile(executionProfile environment.ExecutionProfile) {
	envFilePath := data.ProjectRoot + "/.env." + string(executionProfile)
	err := godotenv.Load(envFilePath)
	if err != nil {
		fmt.Printf("Error: %v\n", err)
		panic(fmt.Errorf(`failed to load env file '%s'`, envFilePath))
	}
}
