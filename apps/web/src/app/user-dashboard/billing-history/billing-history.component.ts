import { CurrencyPipe, DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  resource,
  signal,
  ViewEncapsulation
} from '@angular/core';
import { MatRipple } from '@angular/material/core';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatTableModule } from '@angular/material/table';
import { RouterLink } from '@angular/router';
import { NotificationService } from '@lazycuh/angular-notification';
import { TooltipDirective } from '@lazycuh/angular-tooltip';
import { Logger } from '@lazycuh/logging';
import { UserService } from '@lazycuh/web-ui-common/auth';
import { fadeIn } from '@lazycuh/web-ui-common/effect/fade-in';
import { IconComponent } from '@lazycuh/web-ui-common/icon';
import { InfoTooltipComponent } from '@lazycuh/web-ui-common/info-tooltip';
import { InfoBoxComponent } from '@lazycuh/web-ui-common/message-box/info-box';
import { WarningBoxComponent } from '@lazycuh/web-ui-common/message-box/warning-box';
import { ProgressService } from '@lazycuh/web-ui-common/progress';
import { ContentLoadingIndicatorComponent } from '@lazycuh/web-ui-common/progress/content-loading-indicator';
import { getErrorInfo } from '@lazycuh/web-ui-common/utils/get-error-info';
import { getSupportEmailLink } from '@lazycuh/web-ui-common/utils/get-support-email-link';
import { paymentErrorMessages } from 'src/app/pricing/checkout/models/payment-error-messages';

import { parseCurrency, ParseCurrencyPipe } from '@common/currency';
import { resolveCommonErrorMessage } from '@common/resolve-common-error-message';

import { Payment } from './models';
import { BillingService } from './services';

@Component({
  animations: [fadeIn({ duration: '0.5s' })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: {
    '[@fade-in]': '',
    class: 'billing-history user-dashboard__section'
  },
  imports: [
    MatTableModule,
    MatPaginatorModule,
    IconComponent,
    MatRipple,
    DatePipe,
    CurrencyPipe,
    ParseCurrencyPipe,
    TooltipDirective,
    InfoBoxComponent,
    RouterLink,
    InfoTooltipComponent,
    WarningBoxComponent,
    ContentLoadingIndicatorComponent
  ],
  providers: [BillingService],
  selector: 'lc-billing-history',
  styleUrl: './billing-history.component.scss',
  templateUrl: './billing-history.component.html'
})
export class BillingHistoryComponent {
  protected readonly _offset = signal(0);
  protected readonly _limit = signal(25);
  protected readonly _paymentsResource = resource({
    loader: params => this._billingService.getPayments(params.request.offset, params.request.limit),
    request: computed(() => ({
      limit: this._limit(),
      offset: this._offset()
    }))
  });

  protected readonly _paymentQueryResult = computed(() => this._paymentsResource.value() ?? { page: [], total: 0 });

  private readonly _billingService = inject(BillingService);
  private readonly _progressService = inject(ProgressService);
  private readonly _notificationService = inject(NotificationService);
  private readonly _userEmail = inject(UserService).getCurrentUserEmail();

  protected _onReloadPage() {
    window.location.reload();
  }

  protected _getSupportEmailLinkForBillingHistoryRetrievalError() {
    return getSupportEmailLink(
      'Billing history retrieval error',
      `I keep getting an error viewing my billing history. My email address is ${this._userEmail}.`
    );
  }

  protected _getSupportEmailLinkForNoBillingHistoryRecords() {
    return getSupportEmailLink(
      'Billing history not found',
      `My billing history shows no records. My email address is ${this._userEmail}.`
    );
  }

  protected _getSupportEmailLinkForFailedRefund(payment: Payment) {
    return getSupportEmailLink(
      'My refund was not successfully processed',
      // eslint-disable-next-line max-len
      `Something went wrong during the processing of my refund of $${parseCurrency(payment.amountDue).multiply(-1).toString()}. My email address is ${this._userEmail}.`
    );
  }

  protected async _onOpenPaymentReceiptPage(payment: Payment) {
    try {
      void this._progressService.openIndeterminateProgressIndicator();
      window.open(await this._billingService.getPaymentReceiptUrl(payment.paymentId), '_blank');
    } catch (error) {
      const errorInfo = getErrorInfo(error);

      new Logger('BillingHistoryComponent', this._userEmail).error('failed to get payment invoice url', errorInfo);

      if ((error as HttpErrorResponse).status === 404) {
        this._notificationService.open({
          // eslint-disable-next-line max-len
          content: $localize`Receipt could not be located. Please try again later or contact us for assistance if the issue persists.`
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

  protected _resolvePaymentReasonTooltipInfoText(payment: Payment) {
    const paymentReason = this._resolvePaymentReason(payment);

    if (payment.paymentReason === 'SUBSCRIPTION_CANCELLATION' || payment.paymentReason === 'SUBSCRIPTION_DOWNGRADE') {
      // eslint-disable-next-line max-len
      return $localize`${paymentReason}. It will be issued back to the original payment method used within 5-10 business days.`;
    }

    return paymentReason;
  }

  private _resolvePaymentReason(payment: Payment) {
    // eslint-disable-next-line @typescript-eslint/switch-exhaustiveness-check
    switch (payment.paymentReason) {
      case 'SUBSCRIPTION_CANCELLATION':
        return $localize`Refund for subscription cancellation`;

      case 'SUBSCRIPTION_DOWNGRADE':
        return $localize`Refund for subscription downgrade`;

      case 'NEW_SUBSCRIPTION':
        return $localize`Initial subscription payment`;

      case 'SUBSCRIPTION_REACTIVATION':
        return $localize`Subscription reactivation payment`;

      case 'SUBSCRIPTION_RENEWAL':
        return $localize`Subscription renewal payment`;

      case 'SUBSCRIPTION_UPGRADE':
        return $localize`Subscription upgrade payment`;

      default:
        return '';
    }
  }

  protected _resolvePaymentFailureReason(payment: Payment) {
    const failureReason = paymentErrorMessages[payment.failureReason ?? ''] ?? $localize`Unknown.`;
    const paymentReason = this._resolvePaymentReason(payment);

    return paymentReason !== '' ? `[${paymentReason}] ${failureReason}` : failureReason;
  }

  protected _onPaginationChanged(pageEvent: PageEvent) {
    this._offset.set(pageEvent.pageIndex);
    this._limit.set(pageEvent.pageSize);
  }
}
