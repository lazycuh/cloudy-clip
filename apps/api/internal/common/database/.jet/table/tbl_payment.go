//
// Code generated by go-jet DO NOT EDIT.
//
// WARNING: Changes to this file may cause incorrect behavior
// and will be lost if the code is regenerated
//

package table

import (
	"github.com/go-jet/jet/v2/postgres"
)

var PaymentTable = newTblPayment("public", "tbl_payment", "")

type tblPayment struct {
	postgres.Table

	// Columns
	PaymentID       postgres.ColumnString
	ChargeID        postgres.ColumnString // Stripe's charge ID, null for refunds
	Subtotal        postgres.ColumnString
	Discount        postgres.ColumnString
	Tax             postgres.ColumnString
	AmountDue       postgres.ColumnString
	CurrencyCode    postgres.ColumnString
	PaidAt          postgres.ColumnTimestampz
	Status          postgres.ColumnInteger
	FailureReason   postgres.ColumnString
	PaymentReason   postgres.ColumnInteger
	UserID          postgres.ColumnString
	PaymentMethodID postgres.ColumnString

	AllColumns     postgres.ColumnList
	MutableColumns postgres.ColumnList
	DefaultColumns postgres.ColumnList
}

type TblPayment struct {
	tblPayment

	EXCLUDED tblPayment
}

// AS creates new TblPayment with assigned alias
func (a TblPayment) AS(alias string) *TblPayment {
	return newTblPayment(a.SchemaName(), a.TableName(), alias)
}

// Schema creates new TblPayment with assigned schema name
func (a TblPayment) FromSchema(schemaName string) *TblPayment {
	return newTblPayment(schemaName, a.TableName(), a.Alias())
}

// WithPrefix creates new TblPayment with assigned table prefix
func (a TblPayment) WithPrefix(prefix string) *TblPayment {
	return newTblPayment(a.SchemaName(), prefix+a.TableName(), a.TableName())
}

// WithSuffix creates new TblPayment with assigned table suffix
func (a TblPayment) WithSuffix(suffix string) *TblPayment {
	return newTblPayment(a.SchemaName(), a.TableName()+suffix, a.TableName())
}

func newTblPayment(schemaName, tableName, alias string) *TblPayment {
	return &TblPayment{
		tblPayment: newTblPaymentImpl(schemaName, tableName, alias),
		EXCLUDED:   newTblPaymentImpl("", "excluded", ""),
	}
}

func newTblPaymentImpl(schemaName, tableName, alias string) tblPayment {
	var (
		PaymentIDColumn       = postgres.StringColumn("payment_id")
		ChargeIDColumn        = postgres.StringColumn("charge_id")
		SubtotalColumn        = postgres.StringColumn("subtotal")
		DiscountColumn        = postgres.StringColumn("discount")
		TaxColumn             = postgres.StringColumn("tax")
		AmountDueColumn       = postgres.StringColumn("amount_due")
		CurrencyCodeColumn    = postgres.StringColumn("currency_code")
		PaidAtColumn          = postgres.TimestampzColumn("paid_at")
		StatusColumn          = postgres.IntegerColumn("status")
		FailureReasonColumn   = postgres.StringColumn("failure_reason")
		PaymentReasonColumn   = postgres.IntegerColumn("payment_reason")
		UserIDColumn          = postgres.StringColumn("user_id")
		PaymentMethodIDColumn = postgres.StringColumn("payment_method_id")
		allColumns            = postgres.ColumnList{PaymentIDColumn, ChargeIDColumn, SubtotalColumn, DiscountColumn, TaxColumn, AmountDueColumn, CurrencyCodeColumn, PaidAtColumn, StatusColumn, FailureReasonColumn, PaymentReasonColumn, UserIDColumn, PaymentMethodIDColumn}
		mutableColumns        = postgres.ColumnList{ChargeIDColumn, SubtotalColumn, DiscountColumn, TaxColumn, AmountDueColumn, CurrencyCodeColumn, PaidAtColumn, StatusColumn, FailureReasonColumn, PaymentReasonColumn, UserIDColumn, PaymentMethodIDColumn}
		defaultColumns        = postgres.ColumnList{}
	)

	return tblPayment{
		Table: postgres.NewTable(schemaName, tableName, alias, allColumns...),

		//Columns
		PaymentID:       PaymentIDColumn,
		ChargeID:        ChargeIDColumn,
		Subtotal:        SubtotalColumn,
		Discount:        DiscountColumn,
		Tax:             TaxColumn,
		AmountDue:       AmountDueColumn,
		CurrencyCode:    CurrencyCodeColumn,
		PaidAt:          PaidAtColumn,
		Status:          StatusColumn,
		FailureReason:   FailureReasonColumn,
		PaymentReason:   PaymentReasonColumn,
		UserID:          UserIDColumn,
		PaymentMethodID: PaymentMethodIDColumn,

		AllColumns:     allColumns,
		MutableColumns: mutableColumns,
		DefaultColumns: defaultColumns,
	}
}
