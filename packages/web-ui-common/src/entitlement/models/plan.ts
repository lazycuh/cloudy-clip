export type Plan = {
  discountedPrice: string;
  displayName: string;
  entitlements: PlanEntitlement[];
  isFreePlan: boolean;
  offeringId: string;
  planId: string;
  price: string;
  renewedIn: '1m' | '1y';
};

export type PlanEntitlement = {
  /**
   * True if `isRestricted` is false and `quantity` is greater than 0.
   */
  enabled: boolean;
  isRestricted: boolean;
  quantity: number;
  type: EntitlementType;
};

export type EntitlementType = 'WORD_COUNT' | 'IMAGE_UPLOAD' | 'RETENTION_PERIOD';
