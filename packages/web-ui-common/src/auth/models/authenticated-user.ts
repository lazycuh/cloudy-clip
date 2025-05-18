import { CancellationReason, EntitlementType, Plan } from '../../entitlement';

import { Oauth2Provider } from './oauth2-provider';
import { UserStatus } from './user-status';
import { UserStatusReason } from './user-status-reason';

export interface AuthenticatedUser {
  createdAt: string;
  displayName: string;
  email: string;
  lastLoggedInAt: string;
  provider: Oauth2Provider;
  status: UserStatus;
  statusReason: UserStatusReason;
  subscription: {
    canceledAt: string | null;
    cancellationReason: CancellationReason | null;
    plan: {
      discountedPrice: string;
      displayName: string;
      entitlements: Array<{
        isRestricted: boolean;
        quantity: number;
        type: EntitlementType;
      }>;
      offeringId: string;
      planId: string;
      price: string;
      renewedIn: Plan['renewedIn'];
    };
  } | null;
  updatedAt: string;
}
