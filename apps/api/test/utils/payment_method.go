package test

import (
	"context"
	"strconv"
	"time"

	"github.com/brianvoe/gofakeit/v7"
	"github.com/go-jet/jet/v2/postgres"
	_billingDto "github.com/cloudy-clip/api/internal/billing/dto"
	"github.com/cloudy-clip/api/internal/common/database"
	_jetModel "github.com/cloudy-clip/api/internal/common/database/.jet/model"
	"github.com/cloudy-clip/api/internal/common/database/.jet/table"
)

func GetOrCreateDefaultPaymentMethod(testUser *TestUser) *_billingDto.PaymentMethod {
	queryBuilder := table.PaymentMethodTable.
		SELECT(table.PaymentMethodTable.AllColumns.As("")).
		WHERE(
			table.PaymentMethodTable.UserID.EQ(postgres.String(testUser.UserId)).
				AND(table.PaymentMethodTable.IsDefault.EQ(postgres.Bool(true))),
		)

	defaultPaymentMethod, err := database.SelectOne[_jetModel.PaymentMethod](context.Background(), queryBuilder)
	if err == nil {
		paymentMethod := _billingDto.NewPaymentMethod(defaultPaymentMethod)

		return &paymentMethod
	}

	if !database.IsEmptyResultError(err) {
		panic(err)
	}

	return GenerateDefaultPaymentMethod()
}

func GenerateDefaultPaymentMethod() *_billingDto.PaymentMethod {
	randomCard := gofakeit.CreditCard()

	return &_billingDto.PaymentMethod{
		PaymentMethodId: "pm_" + gofakeit.UUID(),
		ExpMonth:        strconv.Itoa(gofakeit.Number(1, 12)),
		ExpYear:         strconv.FormatInt(int64(time.Now().Year()), 10)[0:2] + randomCard.Exp[3:5],
		Last4:           randomCard.Number[len(randomCard.Number)-4 : len(randomCard.Number)],
		Brand:           randomCard.Type,
		IsDefault:       true,
	}
}

func GenerateNonDefaultPaymentMethod(testUser *TestUser, saveToDb bool) *_billingDto.PaymentMethod {
	randomCard := gofakeit.CreditCard()

	paymentMethod := _jetModel.PaymentMethod{
		PaymentMethodID: "pm_" + gofakeit.UUID(),
		ExpMonth:        strconv.Itoa(gofakeit.Number(1, 12)),
		ExpYear:         strconv.FormatInt(int64(time.Now().Year()), 10)[0:2] + randomCard.Exp[3:5],
		Last4:           randomCard.Number[len(randomCard.Number)-4 : len(randomCard.Number)],
		Brand:           randomCard.Type,
		IsDefault:       false,
		IsDeleted:       false,
		UserID:          testUser.UserId,
	}

	if saveToDb {
		queryBuilder := table.PaymentMethodTable.
			INSERT(table.PaymentMethodTable.AllColumns).
			MODEL(paymentMethod)

		err := database.Exec(context.Background(), queryBuilder)
		if err != nil {
			panic(err)
		}
	}

	paymentMethodDto := _billingDto.NewPaymentMethod(paymentMethod)

	return &paymentMethodDto
}
