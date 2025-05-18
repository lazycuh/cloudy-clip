package database

import (
	"fmt"
	"net/url"

	"github.com/cloudy-clip/api/internal/common/environment"
)

type config struct {
	Host     string `validate:"required"`
	Port     string `validate:"required"`
	Name     string `validate:"required"`
	Username string `validate:"required"`
	Password string `validate:"required"`
}

func newConfig() *config {
	return &config{
		Host:     environment.Config.DatabaseHost,
		Port:     environment.Config.DatabasePort,
		Name:     environment.Config.DatabaseName,
		Username: environment.Config.DatabaseUsername,
		Password: environment.Config.DatabasePassword,
	}
}

func (conf *config) resolveDbConnectionString() string {
	return fmt.Sprintf(
		"postgres://%s:%s@%s:%s/%s",
		url.QueryEscape(conf.Username),
		url.QueryEscape(conf.Password),
		conf.Host,
		conf.Port,
		conf.Name,
	)
}
