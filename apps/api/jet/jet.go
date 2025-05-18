package main

import (
	"fmt"
	"os"
	"strconv"
	"strings"

	"github.com/go-jet/jet/v2/generator/metadata"
	"github.com/go-jet/jet/v2/generator/postgres"
	"github.com/go-jet/jet/v2/generator/template"
	jet "github.com/go-jet/jet/v2/postgres"
	"github.com/iancoleman/strcase"
	_billingModel "github.com/cloudy-clip/api/internal/billing/model"
	_subscriptionModel "github.com/cloudy-clip/api/internal/subscription/model"
	_taskModel "github.com/cloudy-clip/api/internal/task/model"
	_userModel "github.com/cloudy-clip/api/internal/user/model"

	_ "github.com/lib/pq"
)

func main() {
	port, err := strconv.Atoi(os.Getenv("TRADE_TIMELINE_DATABASE_PORT"))
	if err != nil {
		panic(err)
	}

	dbConnection := postgres.DBConnection{
		Host:       os.Getenv("TRADE_TIMELINE_DATABASE_HOST"),
		Port:       port,
		User:       os.Getenv("TRADE_TIMELINE_DATABASE_USERNAME"),
		Password:   os.Getenv("TRADE_TIMELINE_DATABASE_PASSWORD"),
		SslMode:    "disable",
		DBName:     os.Getenv("TRADE_TIMELINE_DATABASE_NAME"),
		SchemaName: "public",
	}

	modelPropertyToTypeMap := map[string]any{
		"Subscription:CancellationReason":   _subscriptionModel.SubscriptionCancellationReasonRequestedByUser,
		"Payment:Status":                    _billingModel.PaymentStatusDraft,
		"Payment:PaymentReason":             _billingModel.PaymentReasonSubscriptionCancellation,
		"User:Provider":                     _userModel.Oauth2ProviderNone,
		"User:Status":                       _userModel.UserStatusActive,
		"User:StatusReason":                 _userModel.UserStatusReasonNone,
		"Task:Status":                       _taskModel.TaskStatusFailure,
		"Task:Type":                         _taskModel.TaskTypeNewSubscriptionPayment,
		"VerificationCode:VerificationType": _userModel.VerificationTypeAccountVerification,
	}

	err = postgres.Generate(
		"./internal/common/database/.jet",
		dbConnection,
		template.Default(jet.Dialect).
			UseSchema(func(schema metadata.Schema) template.Schema {
				return template.DefaultSchema(schema).
					UsePath("..").
					UseSQLBuilder(
						template.DefaultSQLBuilder().
							UseTable(func(table metadata.Table) template.TableSQLBuilder {
								if strings.Contains(table.Name, "databasechangelog") {
									return template.TableSQLBuilder{
										Skip: true,
									}
								}

								return template.DefaultTableSQLBuilder(table).
									UseTypeName(strcase.ToCamel(table.Name)).
									UseDefaultAlias("").
									UseInstanceName(strcase.ToCamel(strings.Replace(table.Name, "tbl", "", 1)) + "Table").
									UseColumn(func(column metadata.Column) template.TableSQLBuilderColumn {
										return template.DefaultTableSQLBuilderColumn(column)
									})
							}),
					).
					UseModel(
						template.DefaultModel().
							UseTable(func(table metadata.Table) template.TableModel {
								if strings.Contains(table.Name, "databasechangelog") {
									return template.TableModel{
										Skip: true,
									}
								}

								modelTypeName := strcase.ToCamel(strings.Replace(table.Name, "tbl", "", 1))

								return template.DefaultTableModel(table).
									UseTypeName(modelTypeName).
									UseField(func(column metadata.Column) template.TableModelField {
										defaultTableModelField := template.DefaultTableModelField(column).
											UseTags(
												fmt.Sprintf(`db:"%s"`, column.Name),
											)

										key := modelTypeName + ":" + defaultTableModelField.Name
										fieldType, exists := modelPropertyToTypeMap[key]
										if exists {
											// Do this so that we can use pointer for fields that have byte type
											if key == "Payment:PaymentReason" {
												paymentReason := fieldType.(_billingModel.PaymentReason)
												return defaultTableModelField.UseType(template.NewType(paymentReason))
											}

											if key == "Subscription:CancellationReason" {
												cancellationReason := fieldType.(_subscriptionModel.SubscriptionCancellationReason)
												return defaultTableModelField.UseType(template.NewType(&cancellationReason))
											}

											return defaultTableModelField.UseType(template.NewType(fieldType))
										}

										return defaultTableModelField
									})
							}),
					)
			}),
	)

	if err != nil {
		panic(err)
	}
}
