import { ChangeDetectionStrategy, Component, inject, signal, ViewEncapsulation } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Logger } from '@lazycuh/logging';
import { UserService } from '@lazycuh/web-ui-common/auth';
import { fadeIn } from '@lazycuh/web-ui-common/effect/fade-in';
import { EntitlementService, Subscription } from '@lazycuh/web-ui-common/entitlement';
import { WarningBoxComponent } from '@lazycuh/web-ui-common/message-box/warning-box';
import { PulseLoaderComponent } from '@lazycuh/web-ui-common/pulse-loader';
import { getErrorInfo } from '@lazycuh/web-ui-common/utils/get-error-info';
import { CheckoutSession } from 'src/app/pricing/models';

import { Payment } from '../billing-history/models';
import { BillingService } from '../billing-history/services';

import { ActiveStatusComponent } from './active-status';
import { CanceledStatusComponent } from './canceled-status';
import { SubscriptionService } from './services';
import { StatusNoSubscriptionComponent } from './status-no-subscription';

@Component({
  animations: [fadeIn({ duration: '0.5s' }), fadeIn({ duration: '1s', name: 'failed-payment' })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: {
    '[@fade-in]': '',
    class: 'my-subscription user-dashboard__section'
  },
  imports: [
    StatusNoSubscriptionComponent,
    ActiveStatusComponent,
    CanceledStatusComponent,
    PulseLoaderComponent,
    WarningBoxComponent,
    RouterLink
  ],
  providers: [EntitlementService, SubscriptionService, BillingService],
  selector: 'lc-subscription',
  styleUrl: './subscription.component.scss',
  templateUrl: './subscription.component.html'
})
export class SubscriptionComponent {
  protected readonly _activeSubscription = signal<Subscription | null>(null);
  protected readonly _shouldShowCancellationConfirmation = signal(false);
  protected readonly _user = inject(UserService).getAuthenticatedUser();
  protected readonly _failedRenewalPayment = signal<Payment | null>(null);

  private readonly _entitlementService = inject(EntitlementService);
  private readonly _router = inject(Router);

  constructor() {
    if (this._hasActivePaidSubscription()) {
      void this._fetchLatestFailedRenewalPayment();
    }
  }

  private _hasActivePaidSubscription() {
    const currentSubscription = this._entitlementService.findCurrentSubscription().orElse(null);
    this._activeSubscription.set(currentSubscription);

    return this._entitlementService.hasActiveSubscription() && !currentSubscription!.plan.isFreePlan;
  }

  private async _fetchLatestFailedRenewalPayment() {
    try {
      const latestPayment = (await inject(BillingService).findLatestPayment()).orElse(null);

      if (latestPayment?.status === 'FAILED' && latestPayment.paymentReason === 'SUBSCRIPTION_RENEWAL') {
        this._failedRenewalPayment.set(latestPayment);
      }
    } catch (error) {
      new Logger('SubscriptionComponent', this._user.email).error(
        'failed to fetch latest payment',
        getErrorInfo(error)
      );
    }
  }

  protected _onSubscriptionCanceled() {
    this._entitlementService.markSubscriptionAsCanceled();

    this._activeSubscription.set(this._entitlementService.findCurrentSubscription().orElseThrow());
  }

  protected _onReactivateSubscription(reactivated: boolean) {
    if (!reactivated) {
      void this._router.navigateByUrl('/checkout', {
        state: {
          checkoutSession: new CheckoutSession(this._activeSubscription()!.plan, 'REACTIVATION')
        }
      });
    } else {
      this._entitlementService.markSubscriptionAsActive();
      this._activeSubscription.set(this._entitlementService.findCurrentSubscription().orElseThrow());
    }
  }
}
