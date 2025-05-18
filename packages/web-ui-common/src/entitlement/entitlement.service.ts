import { inject, Injectable } from '@angular/core';
import { Optional } from '@lazycuh/optional';

import { UserService } from '../auth';

import { Plan, Subscription } from './models';

@Injectable()
export class EntitlementService {
  private readonly _userService = inject(UserService);

  private _activeSubscription = Optional.empty<Subscription>();

  findCurrentSubscription(): Optional<Subscription> {
    return this._userService.findAuthenticatedUser().map(user => user.subscription as Subscription);
  }

  findActiveSubscription(): Optional<Subscription> {
    if (this._activeSubscription.isPresent()) {
      return this._activeSubscription;
    }

    this._activeSubscription = this.findCurrentSubscription().filter(subscription => subscription.canceledAt === null);

    this._activeSubscription.ifPresent(activeSubscription => {
      activeSubscription.plan.isFreePlan = activeSubscription.plan.price === '0';

      for (const entitlement of activeSubscription.plan.entitlements) {
        entitlement.enabled = !entitlement.isRestricted || entitlement.quantity !== 0;
      }
    });

    return this._activeSubscription;
  }

  hasActiveSubscription() {
    return this.findActiveSubscription().isPresent();
  }

  markSubscriptionAsActive() {
    this._activeSubscription = this.findCurrentSubscription().map(subscription => {
      subscription.canceledAt = null;
      subscription.cancellationReason = null;

      return { ...subscription };
    });

    this._userService.getAuthenticatedUser().subscription = this._activeSubscription.orElse(null);
  }

  markSubscriptionAsCanceled() {
    this._activeSubscription = this.findCurrentSubscription().map(subscription => {
      subscription.canceledAt = new Date().toISOString();
      subscription.cancellationReason = 'REQUESTED_BY_USER';

      return { ...subscription };
    });

    this._userService.getAuthenticatedUser().subscription = this._activeSubscription.orElse(null);
  }

  updateSubscriptionPlan(newPlan: Plan) {
    this._activeSubscription = this.findCurrentSubscription().map(subscription => {
      subscription.plan = newPlan;

      return { ...subscription };
    });

    this._userService.getAuthenticatedUser().subscription = this._activeSubscription.orElse(null);
  }
}
