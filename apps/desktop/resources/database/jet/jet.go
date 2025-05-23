package main

import (
	"cloudy-clip/desktop/internal/clipboard/dto"
	"cloudy-clip/desktop/internal/common/database"
	"cloudy-clip/desktop/internal/common/utils"
	"cloudy-clip/desktop/test/debug"
	"fmt"
	"os"
	"slices"
	"strings"

	"github.com/go-jet/jet/v2/generator/metadata"
	"github.com/go-jet/jet/v2/generator/sqlite"
	"github.com/go-jet/jet/v2/generator/template"
	jet "github.com/go-jet/jet/v2/sqlite"
	"github.com/iancoleman/strcase"

	_ "modernc.org/sqlite"
)

func main() {
	modelPropertyToTypeMap := map[string]any{
		"ClipboardItem:Type":      dto.ClipboardItemTypeText,
		"ClipboardItem:CreatedAt": uint64(0),
		"ClipboardItem:PinnedAt":  uint64(0),
	}

	debug.Debugf("Generating jet code for %s", database.ResolveDbConnectionString())

	tableNamesToSkip := []string{
		"schema_migrations",
		"table_use_schema",
	}
	err := sqlite.GenerateDSN(
		fmt.Sprintf("%s/%s.db", utils.GetAppHomeDirectory(), os.Getenv("CLOUDY_CLIP_DATABASE_NAME")),
		"./internal/common/database/generated",
		template.Default(jet.Dialect).
			UseSchema(func(schema metadata.Schema) template.Schema {
				return template.DefaultSchema(schema).
					UseSQLBuilder(
						template.DefaultSQLBuilder().
							UseTable(func(table metadata.Table) template.TableSQLBuilder {
								if slices.Contains(tableNamesToSkip, table.Name) {
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
											// if key == "Payment:PaymentReason" {
											// 	paymentReason := fieldType.(_billingModel.PaymentReason)
											// 	return defaultTableModelField.UseType(template.NewType(paymentReason))
											// }

											// if key == "Subscription:CancellationReason" {
											// 	cancellationReason := fieldType.(_subscriptionModel.SubscriptionCancellationReason)
											// 	return defaultTableModelField.UseType(template.NewType(&cancellationReason))
											// }

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
