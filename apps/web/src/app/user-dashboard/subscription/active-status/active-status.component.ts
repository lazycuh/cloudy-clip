import { CurrencyPipe, DatePipe } from '@angular/common';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
  TemplateRef,
  ViewEncapsulation
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { NotificationService } from '@lazycuh/angular-notification';
import { Logger } from '@lazycuh/logging';
import { AuthenticatedUser } from '@lazycuh/web-ui-common/auth';
import { DialogService } from '@lazycuh/web-ui-common/dialog';
import { fadeIn } from '@lazycuh/web-ui-common/effect/fade-in';
import { Subscription } from '@lazycuh/web-ui-common/entitlement';
import { IconComponent } from '@lazycuh/web-ui-common/icon';
import { InfoTooltipComponent } from '@lazycuh/web-ui-common/info-tooltip';
import { WarningBoxComponent } from '@lazycuh/web-ui-common/message-box/warning-box';
import { ProgressService } from '@lazycuh/web-ui-common/progress';
import { PulseLoaderComponent } from '@lazycuh/web-ui-common/pulse-loader';
import { getErrorInfo } from '@lazycuh/web-ui-common/utils/get-error-info';
import { getSupportEmailLink } from '@lazycuh/web-ui-common/utils/get-support-email-link';

import { parseCurrency, ParseCurrencyPipe } from '@common/currency';
import { RenewalIntervalPipe, SubscriptionLabelPipe } from '@common/entitlement';
import { resolveCommonErrorMessage } from '@common/resolve-common-error-message';

import { UpcomingPayment } from '../models';
import { SubscriptionService } from '../services';

@Component({
  animations: [fadeIn({ duration: '0.5s' })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: {
    '[@fade-in]': '',
    class: 'user-dashboard__section__content active-status'
  },
  imports: [
    RouterLink,
    WarningBoxComponent,
    CurrencyPipe,
    ParseCurrencyPipe,
    DatePipe,
    IconComponent,
    SubscriptionLabelPipe,
    PulseLoaderComponent,
    RenewalIntervalPipe,
    InfoTooltipComponent
  ],
  selector: 'lc-active-status',
  styleUrl: './active-status.component.scss',
  templateUrl: './active-status.component.html'
})
export class ActiveStatusComponent {
  readonly subscription = input.required<Subscription>();
  readonly user = input.required<AuthenticatedUser>();

  readonly subscriptionCanceled = output();

  protected readonly _refundedAmount = signal<string>(parseCurrency('0').toString());
  protected readonly _isFetchingPaymentMethodUpdateUrlRequestInProgress = signal(false);
  // null if fetching fails
  protected readonly _upcomingPayment = signal<UpcomingPayment | undefined | null>(undefined);
  protected readonly _isFetchingUpcomingPayment = signal(true);

  private readonly _subscriptionService = inject(SubscriptionService);
  private readonly _dialogService = inject(DialogService);
  private readonly _notificationService = inject(NotificationService);
  private readonly _isCancellingSubscriptionRequestInProgress = signal(false);
  private readonly _progressService = inject(ProgressService);
  private readonly _logger = new Logger('ActiveStatusComponent');

  constructor() {
    afterNextRender({
      write: () => {
        void this._fetchUpcomingPaymentIfNeeded();
      }
    });
  }

  private async _fetchUpcomingPaymentIfNeeded() {
    if (this.subscription().plan.isFreePlan) {
      return;
    }

    try {
      this._isFetchingUpcomingPayment.set(true);

      this._upcomingPayment.set(await this._subscriptionService.getUpcomingPayment());
    } catch (error) {
      this._logger.error('failed to retrieve upcoming payment', getErrorInfo(error));

      this._upcomingPayment.set(null);
    } finally {
      this._isFetchingUpcomingPayment.set(false);
    }
  }

  protected async _onOpenCancellationConfirmation(cancellationConfirmationTemplateRef: TemplateRef<unknown>) {
    try {
      if (!this.subscription().plan.isFreePlan) {
        void this._progressService.openIndeterminateProgressIndicator();

        const amount = await this._subscriptionService.getSubscriptionCancellationRefund();
        this._refundedAmount.set(parseCurrency(amount).toString());
      }

      this._dialogService
        .setClassName('active-status')
        .setTitle($localize`We're truly saddened to see you go, ${this.user().displayName}!`)
        .setContent(cancellationConfirmationTemplateRef)
        .addButton({
          class: 'lc-button lc-primary',
          label: $localize`Close`,
          state: computed(() => (this._isCancellingSubscriptionRequestInProgress() ? 'DISABLED' : 'NONE'))
        })
        .addButton({
          class: 'lc-filled-button lc-warn',
          label: $localize`Confirm cancellation`,
          onClick: () => {
            void this._cancelSubscription();
          },
          requiresConsent: true,
          state: computed(() => (this._isCancellingSubscriptionRequestInProgress() ? 'LOADING' : 'NONE'))
        })
        .setConsent($localize`I have read and agreed to the previous statements.`)
        .open();
    } catch (error) {
      const errorInfo = getErrorInfo(error);

      new Logger('ActiveStatusComponent', this.user().email).error(
        'failed to get subscription cancellation refund',
        errorInfo
      );

      if (errorInfo.message === 'subscription was created less than 7 days ago') {
        const startDate = new DatePipe(document.documentElement.lang || 'en', undefined, {
          dateFormat: 'longDate'
        }).transform(errorInfo.payload.extra!.startDate as string);

        this._notificationService.open({
          // eslint-disable-next-line max-len
          content: $localize`Our apologies, our abuse prevention procedures only allow cancellation at least 7 days after your subscription was first created which was on ${startDate}.`
        });
      } else {
        this._notificationService.open({
          content: resolveCommonErrorMessage(errorInfo.message)
        });
      }
    } finally {
      this._progressService.close();
    }
  }

  private async _cancelSubscription() {
    try {
      this._isCancellingSubscriptionRequestInProgress.set(true);
      await this._subscriptionService.cancelSubscription();

      this.subscriptionCanceled.emit();
      this._dialogService.close();

      if (!this.subscription().plan.isFreePlan) {
        this._notificationService.open({
          bypassHtmlSanitization: true,
          // eslint-disable-next-line max-len
          content: $localize`Your subscription has been canceled. A refund of approximately <strong>${new CurrencyPipe('en').transform(this._refundedAmount())}</strong> will be issued back to the original payment method within 5-10 business days.<div style="margin-top: 8px">To check the status of your refund, please go to <strong>Billing history</strong> page.</div>`
        });
      } else {
        this._notificationService.open({
          bypassHtmlSanitization: true,

          content: $localize`Your subscription has been canceled.`
        });
      }
    } catch (error) {
      const errorInfo = getErrorInfo(error);

      new Logger(ActiveStatusComponent.name, this.user().email).error('failed to cancel subscription', errorInfo);

      this._notificationService.open({
        content: resolveCommonErrorMessage(errorInfo.message)
      });
      this._isCancellingSubscriptionRequestInProgress.set(false);
    }
  }

  protected _onReloadPage() {
    window.location.reload();
  }

  protected _getSupportEmailLink() {
    return getSupportEmailLink(
      'Upcoming payment amount retrieval error',
      `I keep getting error retrieving upcoming payment amount. My email address is ${this.user().email}.`
    );
  }
}
