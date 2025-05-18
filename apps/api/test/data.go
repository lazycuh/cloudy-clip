package data

import (
	"path/filepath"
	"runtime"
)

var PriceTable = map[string]int64{
	FreePlanMonthlyOfferingId:      0,
	FreePlanYearlyOfferingId:       0,
	LitePlanMonthlyOfferingId:      199,
	LitePlanYearlyOfferingId:       1990,
	EssentialPlanMonthlyOfferingId: 399,
	EssentialPlanYearlyOfferingId:  3990,
}

const (
	FreePlanMonthlyOfferingId      = "01J9FAJGRYSF5Y1338HSE07SB8"
	FreePlanYearlyOfferingId       = "01J9FNB8FZ2XT4NVF9BPQP7Q5G"
	LitePlanMonthlyOfferingId      = "01J9FAJQBCAFBCG5ZV0JE1NDJA"
	LitePlanYearlyOfferingId       = "01J9FNBNXCHKKC8686BDM19C59"
	EssentialPlanMonthlyOfferingId = "01J9FAJY010PPGWYABP8VSSHCV"
	EssentialPlanYearlyOfferingId  = "01J9FNBYVG59GCHESE64WTG30W"

	NewUserPassword = "HelloWorld2024"
	StripeTaxRateId = "tx_123456789"
)

var ProjectRoot = getProjectRootDirectoryPath()

func getProjectRootDirectoryPath() string {
	_, currentFilename, _, ok := runtime.Caller(0)
	if !ok {
		panic("Could not get caller information")
	}

	return filepath.Join(filepath.Dir(currentFilename), "..")
}
