package utils

import (
	"context"

	jet "github.com/go-jet/jet/v2/postgres"
	"github.com/cloudy-clip/api/internal/common/database"
	"github.com/cloudy-clip/api/internal/common/database/.jet/model"
	"github.com/cloudy-clip/api/internal/common/database/.jet/table"
)

func ResolveTaxRateByLocation(
	ctx context.Context,
	countryCode,
	postalCode string,
) ([]*string, string, error) {
	taxPercentage := "0.00"
	var defaultTaxRates []*string = nil

	taxRate, err := getTaxRateByLocation(ctx, countryCode, postalCode)
	if err == nil {
		defaultTaxRates = []*string{&taxRate.StripeTaxRateID}
		taxPercentage = taxRate.TaxPercentage
	} else if database.IsEmptyResultError(err) {
		err = nil
	}

	return defaultTaxRates, taxPercentage, err
}

func getTaxRateByLocation(ctx context.Context, countryCode, postalCode string) (model.TaxRate, error) {
	queryBuilder := table.TaxRateTable.
		SELECT(table.TaxRateTable.AllColumns.As("")).
		WHERE(
			table.TaxRateTable.CountryCode.EQ(jet.String(countryCode)).
				AND(table.TaxRateTable.PostalCode.EQ(jet.String(postalCode))),
		).
		LIMIT(1)

	return database.SelectOne[model.TaxRate](ctx, queryBuilder)

}
