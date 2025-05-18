import { afterNextRender, ChangeDetectionStrategy, Component, inject, signal, ViewEncapsulation } from '@angular/core';
import { MatRipple } from '@angular/material/core';
import { Router } from '@angular/router';
import { NotificationService } from '@lazycuh/angular-notification';
import { Logger } from '@lazycuh/logging';
import { ActionContainerComponent } from '@lazycuh/web-ui-common/action-container';
import { UserService } from '@lazycuh/web-ui-common/auth';
import { expand } from '@lazycuh/web-ui-common/effect/expand';
import { fadeIn } from '@lazycuh/web-ui-common/effect/fade-in';
import { EntitlementService, Plan } from '@lazycuh/web-ui-common/entitlement';
import { ProgressCompleteIndicatorComponent } from '@lazycuh/web-ui-common/progress-complete-indicator';
import { getSupportEmailLink } from '@lazycuh/web-ui-common/utils/get-support-email-link';
import { isBrowser } from '@lazycuh/web-ui-common/utils/is-browser';
import { StripeError } from '@stripe/stripe-js';

import { resolveCommonErrorMessage } from '@common/resolve-common-error-message';
import { TaskService } from '@common/task';

import { CheckoutSession } from '../models';

import { NewSubscriptionCheckoutComponent } from './new-subscription-checkout';
import { CheckoutService } from './services';
import { SubscriptionUpdateCheckoutComponent } from './subscription-update-checkout';

@Component({
  animations: [
    fadeIn({
      duration: '0.5s',
      name: 'fade-in'
    }),
    fadeIn({
      duration: '0.5s',
      name: 'confirm-payment'
    }),
    expand({ duration: '0.5s', height: '27.5px', name: 'discount' }),
    expand({ duration: '1.25s', height: '27.5px', name: 'renewal-interval' })
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: {
    '[@fade-in]': '',
    class: 'lc-checkout'
  },
  imports: [
    NewSubscriptionCheckoutComponent,
    ProgressCompleteIndicatorComponent,
    ActionContainerComponent,
    MatRipple,
    SubscriptionUpdateCheckoutComponent
  ],
  providers: [EntitlementService, CheckoutService, TaskService],
  selector: 'lc-checkout',
  styleUrl: './checkout.component.scss',
  templateUrl: './checkout.component.html'
})
export class CheckoutComponent {
  protected readonly _selectedPlan = signal<Plan | null>(null);
  protected readonly _checkoutSessionType = signal<CheckoutSession['type'] | null>(null);
  protected readonly _noStripeInstance = signal(false);

  private readonly _notificationService = inject(NotificationService);
  private readonly _userService = inject(UserService);

  constructor() {
    const router = inject(Router);

    const resolveCheckoutSession = () => {
      /* istanbul ignore if -- @preserve */
      if (!isBrowser()) {
        return null;
      }

      const checkoutSessionState = router.getCurrentNavigation()?.extras.state?.checkoutSession as unknown;

      if (checkoutSessionState) {
        // Save the checkout session in session storage to persist it across page reloads,
        // for example when user is navigated back to checkout page after
        // being redirected to the page for adding a payment method.
        sessionStorage.setItem('checkoutSession', JSON.stringify(checkoutSessionState));

        return checkoutSessionState as CheckoutSession | undefined;
      }

      const checkoutSessionInSessionStorage = sessionStorage.getItem('checkoutSession');

      if (checkoutSessionInSessionStorage) {
        return JSON.parse(checkoutSessionInSessionStorage) as CheckoutSession;
      }

      return null;
    };

    const entitlementService = inject(EntitlementService);
    const checkoutSession = resolveCheckoutSession();
    this._checkoutSessionType.set(checkoutSession?.type ?? null);

    afterNextRender({
      write: () => {
        if (this._checkoutSessionType() === 'NEW_SUBSCRIPTION') {
          const hasActivePaidPlan = entitlementService
            .findActiveSubscription()
            .map(e => !e.plan.isFreePlan)
            .orElse(false);

          if (hasActivePaidPlan) {
            void router.navigateByUrl('/my/account');

            return;
          }
        }

        if (!checkoutSession) {
          void router.navigateByUrl('/pricing');

          return;
        }

        if (window.stripeInstance === null) {
          new Logger('CheckoutComponent').error('stripe instance is null', new Error('stripe instance is null'));

          this._noStripeInstance.set(true);
        }

        this._selectedPlan.set(checkoutSession.selectedPlan);
      }
    });
  }

  protected _onReloadPage() {
    window.location.reload();
  }

  protected _getSupportEmailLinkForNoStripeInstance() {
    return getSupportEmailLink(
      'Unable to establish checkout session',
      `Please check why I was not able to check out. My email address is ${this._userService.getCurrentUserEmail()}`
    );
  }

  protected async _onPaymentFailure(error: StripeError) {
    this._notificationService.open({
      content: await this._resolveStripePaymentErrorMessage(error)
    });
  }

  private async _resolveStripePaymentErrorMessage(error: StripeError) {
    const errorMessages = (await import('./models/payment-error-messages')).paymentErrorMessages;

    const errorCode = error.code ?? '';
    const declineCode = error.decline_code ?? '';

    return (
      errorMessages[`${errorCode}.${declineCode}`] ??
      errorMessages[errorCode] ??
      errorMessages[declineCode] ??
      resolveCommonErrorMessage('')
    );
  }
}
