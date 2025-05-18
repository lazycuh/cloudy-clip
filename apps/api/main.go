package main

import (
	"fmt"
	"log"
	"os"

	"github.com/go-chi/chi/v5"
	"github.com/cloudy-clip/api/cmd"
	"github.com/cloudy-clip/api/internal/common/environment"
	"github.com/cloudy-clip/api/internal/orchestrator"

	"github.com/joho/godotenv"
)

func main() {
	executionProfile := os.Getenv("TRADE_TIMELINE_EXECUTION_PROFILE")
	envFileName := ".env." + executionProfile
	err := godotenv.Load(envFileName)
	if err != nil {
		panic(fmt.Errorf(`failed to load env file "%s"`, envFileName))
	}

	environment.Initialize(environment.ExecutionProfile(executionProfile))

	if err := cmd.Run(orchestrator.NewConfig(), chi.NewRouter()); err != nil {
		log.Fatal(err)
		return
	}
}
