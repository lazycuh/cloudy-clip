package orchestrator

import (
	"fmt"
	"sync"
	"time"

	"github.com/cloudy-clip/api/internal/common/environment"
)

type Config struct {
	Addr                       string
	ReadTimeout                time.Duration
	WriteTimeout               time.Duration
	IdleTimeout                time.Duration
	AccessControlAllowedOrigin string
}

var (
	once     sync.Once
	instance *Config
)

func NewConfig() *Config {
	once.Do(func() {
		instance = &Config{
			Addr: fmt.Sprintf(
				"%s:%s",
				environment.Config.ServerHost,
				environment.Config.ServerPort,
			),
			ReadTimeout:                time.Duration(environment.Config.ServerReadTimeout) * time.Second,
			WriteTimeout:               time.Duration(environment.Config.ServerWriteTimeout) * time.Second,
			IdleTimeout:                time.Duration(environment.Config.ServerIdleTimeout) * time.Second,
			AccessControlAllowedOrigin: environment.Config.AccessControlAllowOrigin,
		}
	})

	return instance
}
