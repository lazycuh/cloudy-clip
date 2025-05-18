package model

type PlanEntitlement struct {
	PlanId            string `db:"plan_id"`
	PlanDisplayName   string `db:"plan_display_name"`
	PlanEntitlementId string `db:"plan_entitlement_id"`
	Type              string `db:"type"`
	Quantity          int    `db:"quantity"`
	IsRestricted      bool   `db:"restricted"`
}
