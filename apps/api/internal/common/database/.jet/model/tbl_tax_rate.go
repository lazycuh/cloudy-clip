//
// Code generated by go-jet DO NOT EDIT.
//
// WARNING: Changes to this file may cause incorrect behavior
// and will be lost if the code is regenerated
//

package model

type TaxRate struct {
	CountryCode     string `sql:"primary_key" db:"country_code"`
	PostalCode      string `sql:"primary_key" db:"postal_code"`
	TaxPercentage   string `db:"tax_percentage"`
	StripeTaxRateID string `db:"stripe_tax_rate_id"`
}
