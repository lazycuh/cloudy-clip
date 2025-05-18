package test

import (
	"context"
	"testing"

	jet "github.com/go-jet/jet/v2/postgres"
	"github.com/stretchr/testify/require"
	"github.com/cloudy-clip/api/internal/common/database"
	_jetModel "github.com/cloudy-clip/api/internal/common/database/.jet/model"
	"github.com/cloudy-clip/api/internal/common/database/.jet/table"
)

func UpdateTestUser(t *testing.T, updatedUser *_jetModel.User) {
	queryBuilder := table.UserTable.
		UPDATE(table.UserTable.AllColumns).
		MODEL(updatedUser).
		WHERE(table.UserTable.UserID.EQ(jet.String(updatedUser.UserID)))

	err := database.Exec(context.Background(), queryBuilder)

	require.NoError(t, err, "failed to update test user")
}
