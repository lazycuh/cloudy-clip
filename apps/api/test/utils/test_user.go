package test

import (
	"context"
	"testing"

	"github.com/brianvoe/gofakeit/v7"
	jet "github.com/go-jet/jet/v2/postgres"
	"github.com/stretchr/testify/require"
	"github.com/cloudy-clip/api/internal/common/database"
	_jetModel "github.com/cloudy-clip/api/internal/common/database/.jet/model"
	"github.com/cloudy-clip/api/internal/common/database/.jet/table"
	"github.com/cloudy-clip/api/internal/common/user"
	_subscriptionDto "github.com/cloudy-clip/api/internal/subscription/dto"
	"github.com/cloudy-clip/api/internal/user/dto"
)

type TestUser struct {
	UserId               string
	StripeCustomerId     string
	StripeSubscriptionId string
	Email                string
	DisplayName          string
	Subscription         *_subscriptionDto.Subscription
}

func NewTestUser(authenticatedUser *dto.AuthenticatedUser) *TestUser {
	return &TestUser{
		UserId:               getUserId(authenticatedUser),
		StripeCustomerId:     "cus_" + gofakeit.UUID(),
		StripeSubscriptionId: "sub_" + gofakeit.UUID(),
		Email:                authenticatedUser.Email,
		DisplayName:          authenticatedUser.DisplayName,
		Subscription:         authenticatedUser.Subscription,
	}
}

func getUserId(authenticatedUser *dto.AuthenticatedUser) string {
	var userId string
	queryBuilder := table.UserTable.
		SELECT(table.UserTable.UserID).
		WHERE(table.UserTable.Email.EQ(jet.String(authenticatedUser.Email)))
	err := database.SelectInto(context.Background(), queryBuilder, &userId)
	if err != nil {
		panic(err)
	}

	return userId
}

func GetTestUserModelByEmail(t2 *testing.T, email string) *_jetModel.User {
	testUser, err := user.FindUserByEmail(context.Background(), nil, email)
	require.NoError(t2, err, "failed to find user")

	return &testUser
}
