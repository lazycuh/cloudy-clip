import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, input, output, signal, ViewEncapsulation } from '@angular/core';
import { NotificationService } from '@lazycuh/angular-notification';
import { Logger } from '@lazycuh/logging';
import { UserService } from '@lazycuh/web-ui-common/auth';
import { fadeIn } from '@lazycuh/web-ui-common/effect/fade-in';
import { Subscription } from '@lazycuh/web-ui-common/entitlement';
import { IconComponent } from '@lazycuh/web-ui-common/icon';
import { InfoTooltipComponent } from '@lazycuh/web-ui-common/info-tooltip';
import { PulseLoaderComponent } from '@lazycuh/web-ui-common/pulse-loader';
import { getErrorInfo } from '@lazycuh/web-ui-common/utils/get-error-info';

import { SubscriptionLabelPipe } from '@common/entitlement';
import { resolveCommonErrorMessage } from '@common/resolve-common-error-message';

import { SubscriptionService } from '../services';

@Component({
  animations: [fadeIn({ duration: '0.5s' })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: {
    '[@fade-in]': '',
    class: 'user-dashboard__section__content canceled-status'
  },
  imports: [DatePipe, IconComponent, SubscriptionLabelPipe, PulseLoaderComponent, InfoTooltipComponent],
  selector: 'lc-canceled-status',
  styleUrl: './canceled-status.component.scss',
  templateUrl: './canceled-status.component.html'
})
export class CanceledStatusComponent {
  readonly subscription = input.required<Subscription>();

  readonly reactivate = output<boolean>();

  protected readonly _isSubscriptionReactivationRequestInProgress = signal(false);

  private readonly _subscriptionService = inject(SubscriptionService);
  private readonly _notificationService = inject(NotificationService);
  private readonly _logger = new Logger('CanceledStatusComponent', inject(UserService).getAuthenticatedUser().email);

  protected async _onReactivateSubscription() {
    // If not a free plan, then we notify the parent component and let it handle the reactivation
    // by navigating to the checkout page.
    if (!this.subscription().plan.isFreePlan) {
      this.reactivate.emit(false);

      return;
    }

    try {
      this._isSubscriptionReactivationRequestInProgress.set(true);

      await this._subscriptionService.reactivateFreeSubscription();

      this.reactivate.emit(true);

      this._notificationService.open({
        content: $localize`Your subscription has been reactivated. Thank you for your continuing support.`
      });
    } catch (error) {
      const errorInfo = getErrorInfo(error);

      this._logger.error('failed to reactivate subscription', errorInfo);

      this._notificationService.open({
        content: resolveCommonErrorMessage(errorInfo.message)
      });
    } finally {
      this._isSubscriptionReactivationRequestInProgress.set(false);
    }
  }

  protected _resolveCancellationReason() {
    // eslint-disable-next-line @typescript-eslint/switch-exhaustiveness-check
    switch (this.subscription().cancellationReason) {
      case 'REQUESTED_BY_USER':
        return $localize`Canceled by user`;

      case 'PAYMENT_FAILED':
        return $localize`Failed payment`;

      case 'PAYMENT_DISPUTED':
        return $localize`Disputed payment`;

      default:
        this._logger.warn(`unknown cancellation reason '${this.subscription().cancellationReason}'`);

        return $localize`Unknown`;
    }
  }
}
