import { Plan } from '@lazycuh/web-ui-common/entitlement';

import { BillingInfo } from './billing-info';

export class NewSubscriptionCheckoutRequest {
  readonly offeringId: string;
  readonly fullName: string;
  readonly countryCode: string;
  readonly postalCode: string;

  constructor(
    selectedPlan: Plan,
    billingInfo: BillingInfo,
    readonly couponCode = ''
  ) {
    this.offeringId = selectedPlan.offeringId;
    this.fullName = billingInfo.fullName;
    this.countryCode = billingInfo.countryCode;
    this.postalCode = billingInfo.postalCode;
  }
}
