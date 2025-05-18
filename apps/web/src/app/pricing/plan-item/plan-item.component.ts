import { CurrencyPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, input, output, ViewEncapsulation } from '@angular/core';
import { MatRipple } from '@angular/material/core';
import { RouterLink } from '@angular/router';
import { Optional } from '@lazycuh/optional';
import { fadeIn } from '@lazycuh/web-ui-common/effect/fade-in';
import { EntitlementService, Plan } from '@lazycuh/web-ui-common/entitlement';

import { ParseCurrencyPipe } from '@common/currency';
import { RenewalIntervalPipe } from '@common/entitlement';

import { EntitlementListComponent } from '../entitlement-list';

@Component({
  animations: [
    fadeIn({
      duration: '0.5s',
      enteringTransition: '1m <=> 1y, :enter',
      name: 'priceChange'
    })
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: {
    '[class.active-plan]': '_hasActiveSubscription() && _shouldShowManageButton()',
    class: 'plan-item'
  },
  imports: [MatRipple, CurrencyPipe, EntitlementListComponent, RouterLink, RenewalIntervalPipe, ParseCurrencyPipe],
  providers: [EntitlementService],
  selector: 'lc-plan-item',
  styleUrl: './plan-item.component.scss',
  templateUrl: './plan-item.component.html'
})
export class PlanItemComponent {
  readonly plan = input.required<Plan>();

  readonly subscribe = output<Plan>();
  readonly upgrade = output<Plan>();
  readonly downgrade = output<Plan>();
  readonly changeRenewalInterval = output<Plan>();

  private readonly _entitlementService = inject(EntitlementService);

  protected _hasActiveSubscription() {
    return this._entitlementService.hasActiveSubscription();
  }

  protected _isActivePlan() {
    return this._findPurchasedPlan()
      .map(activePlan => activePlan.planId === this.plan().planId)
      .orElse(false);
  }

  private _findPurchasedPlan(): Optional<Plan> {
    return this._entitlementService.findActiveSubscription().map(subscription => subscription.plan);
  }

  protected _shouldShowManageButton() {
    return this._findPurchasedPlan()
      .map(activePlan => {
        // If the active plan is the free plan, then we consider both monthly and annually offerings to be the same
        return activePlan.offeringId === this.plan().offeringId || (activePlan.isFreePlan && this.plan().isFreePlan);
      })
      .orElse(false);
  }

  protected _onSubscribe() {
    this.subscribe.emit(this.plan());
  }

  protected _onChangeRenewalInterval() {
    this.changeRenewalInterval.emit(this.plan());
  }

  protected _resolvePlanSwitchButtonLabel() {
    return this.plan().renewedIn === '1m' ? $localize`Switch to monthly` : $localize`Switch to yearly`;
  }

  protected _isCheaperThanActivePlan() {
    return this._findPurchasedPlan()
      .map(activePlan => {
        if (this.plan().renewedIn === activePlan.renewedIn) {
          return this.plan().price < activePlan.price;
        }

        const thisPlanMonthlyPrice =
          this.plan().renewedIn === '1y' ? Number(this.plan().discountedPrice) / 10 : this.plan().price;
        const activePlanMonthlyPrice =
          activePlan.renewedIn === '1y' ? Number(activePlan.discountedPrice) / 10 : activePlan.price;

        return thisPlanMonthlyPrice < activePlanMonthlyPrice;
      })
      .orElse(false);
  }

  protected _onDowngrade() {
    this.downgrade.emit(this.plan());
  }

  protected _onUpgrade() {
    this.upgrade.emit(this.plan());
  }
}
