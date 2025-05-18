import { afterNextRender, ChangeDetectionStrategy, Component, inject, signal, ViewEncapsulation } from '@angular/core';
import { MatRipple } from '@angular/material/core';
import { RouterLink } from '@angular/router';
import { ConfirmationCaptureService } from '@lazycuh/angular-confirmation-capture';
import { NotificationService } from '@lazycuh/angular-notification';
import { Logger } from '@lazycuh/logging';
import { UserService } from '@lazycuh/web-ui-common/auth';
import { capitalize } from '@lazycuh/web-ui-common/capitalize';
import { fadeIn } from '@lazycuh/web-ui-common/effect/fade-in';
import { InfoTooltipComponent } from '@lazycuh/web-ui-common/info-tooltip';
import { InfoBoxComponent } from '@lazycuh/web-ui-common/message-box/info-box';
import { ProgressService } from '@lazycuh/web-ui-common/progress';
import { ContentLoadingIndicatorComponent } from '@lazycuh/web-ui-common/progress/content-loading-indicator';
import { getErrorInfo } from '@lazycuh/web-ui-common/utils/get-error-info';
import { getSupportEmailLink } from '@lazycuh/web-ui-common/utils/get-support-email-link';

import { resolveCommonErrorMessage } from '@common/resolve-common-error-message';

import { PaymentMethod } from './models';
import { PaymentMethodService } from './services';

@Component({
  animations: [fadeIn({ duration: '0.5s' })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: {
    '[@fade-in]': '',
    class: 'payment-method-list user-dashboard__section'
  },
  imports: [InfoBoxComponent, InfoTooltipComponent, RouterLink, MatRipple, ContentLoadingIndicatorComponent],
  providers: [PaymentMethodService],
  selector: 'lc-payment-method-list',
  styleUrl: './payment-method-list.component.scss',
  templateUrl: './payment-method-list.component.html'
})
export class PaymentMethodListComponent {
  protected readonly _paymentMethods = signal<PaymentMethod[] | undefined>(undefined);

  private readonly _paymentMethodService = inject(PaymentMethodService);
  private readonly _progressService = inject(ProgressService);
  private readonly _notificationService = inject(NotificationService);
  private readonly _userEmail = inject(UserService).getCurrentUserEmail();
  private readonly _confirmationCaptureService = inject(ConfirmationCaptureService);
  private readonly _logger = new Logger('PaymentMethodListComponent', this._userEmail);

  constructor() {
    afterNextRender({
      write: async () => {
        try {
          void this._progressService.openIndeterminateProgressIndicator();

          const returnedPaymentMethods = this._sortPaymentMethodList(
            await this._paymentMethodService.getAllPaymentMethods()
          );
          this._paymentMethods.set(returnedPaymentMethods);
        } catch (error) {
          const errorInfo = getErrorInfo(error);

          this._logger.error('failed to get payment methods', errorInfo);

          this._notificationService.open({
            content: resolveCommonErrorMessage(errorInfo.message)
          });
        } finally {
          this._progressService.close();
        }
      }
    });
  }

  private _sortPaymentMethodList(paymentMethodList: PaymentMethod[]) {
    return paymentMethodList.sort((a, b) => {
      if (a.isDefault) {
        return -1;
      }

      if (b.isDefault) {
        return 1;
      }

      return this._isPaymentMethodExpired(a) ? 1 : -1;
    });
  }

  private _isPaymentMethodExpired(paymentMethod: PaymentMethod) {
    return Date.now() >= new Date(Number(paymentMethod.expYear), Number(paymentMethod.expMonth) - 1).getTime();
  }

  protected _getSupportEmailLink() {
    return getSupportEmailLink(
      'Payment methods not found',
      `My payment method list shows no records. My email address is ${this._userEmail}.`
    );
  }

  protected async _onOpenPageToAddPaymentMethod() {
    try {
      void this._progressService.openIndeterminateProgressIndicator();
      window.location.href = await this._paymentMethodService.getUrlToPageForAddingPaymentMethod();
    } catch (error) {
      const errorInfo = getErrorInfo(error);

      if (errorInfo.message === 'no billing info exists') {
        this._notificationService.open({
          bypassHtmlSanitization: true,
          // eslint-disable-next-line max-len
          content: $localize`Unable to add new payment method because we don't have your billing info on file.<div style="margin-top: 4px">You can add a new payment method during checkout.</div>`
        });
      } else {
        this._logger.error('failed to get url to page to add payment method', errorInfo);

        this._notificationService.open({
          content: resolveCommonErrorMessage(errorInfo.message)
        });
      }
    } finally {
      this._progressService.close();
    }
  }

  protected async _onSetPaymentMethodAsDefault(paymentMethod: PaymentMethod) {
    try {
      void this._progressService.openIndeterminateProgressIndicator();

      await this._paymentMethodService.setPaymentMethodAsDefault(paymentMethod.paymentMethodId);

      this._paymentMethods.update(paymentMethods => {
        return paymentMethods!.map(current => {
          if (current !== paymentMethod) {
            current.isDefault = false;
          }

          return current;
        });
      });

      paymentMethod.isDefault = true;

      this._sortPaymentMethodList(this._paymentMethods()!);

      this._notificationService.open({
        content: $localize`${this._formatCardLast4(paymentMethod)} will be used by default for all future transactions.`
      });
    } catch (error) {
      const errorInfo = getErrorInfo(error);

      this._logger.error('failed to set payment method as default', errorInfo, {
        newDefaultPaymentMethod: paymentMethod
      });

      this._notificationService.open({
        content: resolveCommonErrorMessage(errorInfo.message)
      });
    } finally {
      this._progressService.close();
    }
  }

  private _formatCardLast4(paymentMethod: PaymentMethod) {
    return `<strong>${capitalize(paymentMethod.brand)} &times;&times;&times;&times;-${paymentMethod.last4}</strong>`;
  }

  protected async _onRemovePaymentMethod(paymentMethod: PaymentMethod) {
    try {
      const confirmed = await this._confirmationCaptureService.open({
        content: $localize`Are you sure you want to remove ${this._formatCardLast4(paymentMethod)}?`
      });

      if (!confirmed) {
        return;
      }

      void this._progressService.openIndeterminateProgressIndicator();

      await this._paymentMethodService.removePaymentMethod(paymentMethod.paymentMethodId);

      this._paymentMethods.update(paymentMethods => paymentMethods!.filter(current => current !== paymentMethod));

      this._notificationService.open({
        content: $localize`${this._formatCardLast4(paymentMethod)} has been removed.`
      });
    } catch (error) {
      const errorInfo = getErrorInfo(error);

      this._logger.error('failed to remove payment method', errorInfo, { paymentMethod });

      this._notificationService.open({
        content: resolveCommonErrorMessage(errorInfo.message)
      });
    } finally {
      this._progressService.close();
    }
  }
}
