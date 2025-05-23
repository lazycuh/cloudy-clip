package database

import (
	"cloudy-clip/desktop/internal/common/environment"
	"cloudy-clip/desktop/internal/common/utils"
	"fmt"
)

type config struct {
	DatabaseName string `validate:"required"`
}

func ResolveDbConnectionString() string {
	conf := config{
		DatabaseName: environment.Config.DatabaseName,
	}

	return fmt.Sprintf(
		"%s/%s.db",
		utils.GetAppHomeDirectory(),
		conf.DatabaseName,
	)
}
