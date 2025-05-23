package main

import (
	"cloudy-clip/desktop/internal/clipboard"
	"cloudy-clip/desktop/internal/clipboard/dto"
	"cloudy-clip/desktop/internal/common/database"
	"cloudy-clip/desktop/internal/common/environment"
	"context"
	"fmt"
	"os"

	"github.com/joho/godotenv"
)

// App struct
type App struct {
	ctx context.Context
}

// NewApp creates a new App application struct
func NewApp() *App {
	return &App{}
}

// startup is called when the app starts. The context is saved
// so we can call the runtime methods
func (a *App) startup(ctx context.Context) {
	executionProfile := os.Getenv("CLOUDY_CLIP_EXECUTION_PROFILE")
	if executionProfile == "" {
		executionProfile = string(environment.ExecutionProfileDevelopment)
	}
	envFileName := ".env." + executionProfile
	err := godotenv.Load(envFileName)
	if err != nil {
		panic(fmt.Errorf(`failed to load env file "%s"`, envFileName))
	}

	environment.Initialize(environment.ExecutionProfile(executionProfile))

	a.ctx = ctx
	database.InitializeDatabaseClient()
}

func (a *App) shutdown(_ context.Context) bool {
	database.Close()

	return true
}

func (a *App) GetLatestClipboardItem() dto.ClipboardItem {
	return clipboard.GetLatestClipboardItem()
}
