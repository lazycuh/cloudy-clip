import { Plan } from '@lazycuh/web-ui-common/entitlement';

export type CheckoutType = 'NEW_SUBSCRIPTION' | 'UPGRADE' | 'DOWNGRADE' | 'RENEWAL_INTERVAL_CHANGE' | 'REACTIVATION';

export class CheckoutSession {
  constructor(
    readonly selectedPlan: Plan,
    readonly type: CheckoutType
  ) {}
}
