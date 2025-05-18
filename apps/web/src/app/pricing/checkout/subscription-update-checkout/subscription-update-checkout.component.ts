import { CurrencyPipe } from '@angular/common';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
  output,
  signal,
  ViewEncapsulation
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, Validators } from '@angular/forms';
import { MatRipple } from '@angular/material/core';
import { Router } from '@angular/router';
import { NotificationService } from '@lazycuh/angular-notification';
import { TimeoutError } from '@lazycuh/execute-until';
import { ExceptionCode } from '@lazycuh/http/src';
import { Logger } from '@lazycuh/logging';
import { ActionContainerComponent } from '@lazycuh/web-ui-common/action-container';
import { UserService } from '@lazycuh/web-ui-common/auth';
import { BackButtonComponent } from '@lazycuh/web-ui-common/back-button';
import { capitalize } from '@lazycuh/web-ui-common/capitalize';
import { expand } from '@lazycuh/web-ui-common/effect/expand';
import { fadeIn } from '@lazycuh/web-ui-common/effect/fade-in';
import { EntitlementService, Plan } from '@lazycuh/web-ui-common/entitlement';
import { FocusBoxComponent } from '@lazycuh/web-ui-common/focus-box';
import { CheckboxFormFieldComponent } from '@lazycuh/web-ui-common/form/checkbox-form-field';
import { InfoTooltipComponent } from '@lazycuh/web-ui-common/info-tooltip';
import { MenuComponent, MenuOption } from '@lazycuh/web-ui-common/menu';
import { ProgressService } from '@lazycuh/web-ui-common/progress';
import { PulseLoaderComponent } from '@lazycuh/web-ui-common/pulse-loader';
import { delayBy } from '@lazycuh/web-ui-common/utils/delay-by';
import { getErrorInfo } from '@lazycuh/web-ui-common/utils/get-error-info';
import { getErrorPagePath } from '@lazycuh/web-ui-common/utils/get-error-page-path';
import { StripeError } from '@stripe/stripe-js';
import { map } from 'rxjs';
import { BillingService } from 'src/app/user-dashboard/billing-history/services';
import { PaymentMethod } from 'src/app/user-dashboard/payment-method-list/models';
import { PaymentMethodService } from 'src/app/user-dashboard/payment-method-list/services';

import { calculateTax, parseCurrency, ParseCurrencyPipe } from '@common/currency';
import { RenewalIntervalPipe, SubscriptionLabelPipe } from '@common/entitlement';
import { resolveCommonErrorMessage } from '@common/resolve-common-error-message';

import { EntitlementListComponent } from '../../entitlement-list';
import { CheckoutSession, CheckoutType } from '../../models';
import { CheckoutService } from '../services';

@Component({
  animations: [
    fadeIn({
      duration: '0.5s',
      name: 'fade-in'
    }),
    expand({ duration: '0.5s', height: '27.5px', name: 'discount' }),
    expand({ duration: '1.25s', height: '27.5px', name: 'renewal-interval' })
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: {
    '[@fade-in]': '',
    class: 'subscription-update-checkout'
  },
  imports: [
    ActionContainerComponent,
    BackButtonComponent,
    CurrencyPipe,
    EntitlementListComponent,
    FocusBoxComponent,
    InfoTooltipComponent,
    MatRipple,
    PulseLoaderComponent,
    RenewalIntervalPipe,
    // ShortTextFormFieldComponent,
    // TruncatedTextComponent,
    CheckboxFormFieldComponent,
    // FormComponent,
    SubscriptionLabelPipe,
    ParseCurrencyPipe,
    MenuComponent
  ],
  providers: [BillingService, PaymentMethodService],
  selector: 'lc-subscription-update-checkout',
  styleUrl: './subscription-update-checkout.component.scss',
  templateUrl: './subscription-update-checkout.component.html'
})
export class SubscriptionUpdateCheckoutComponent {
  readonly selectedPlan = input.required<Plan>();
  readonly checkoutType = input.required<Exclude<CheckoutType, 'NEW_SUBSCRIPTION'>>();

  readonly paymentFailure = output<StripeError>();

  protected readonly _currentSubscription = inject(EntitlementService).findCurrentSubscription().orElseThrow();
  protected readonly _isFetchingCheckoutPreview = signal(false);
  // protected readonly _couponCodeForm = new FormGroup({
  //   couponCode: new FormControl('', { nonNullable: true })
  // });

  protected readonly _selectedPaymentMethodControl = new FormControl<PaymentMethod | null>(null, {
    nonNullable: true,
    validators: Validators.required
  });

  protected readonly _paymentConsentFormControl = new FormControl(false, {
    nonNullable: true,
    validators: Validators.requiredTrue
  });

  protected readonly _tax = signal<string | undefined>(undefined);
  protected readonly _taxPercentage = signal('0.00');
  protected readonly _discount = signal(parseCurrency(0).toString());
  protected readonly _refund = signal(parseCurrency(0).toString());
  protected readonly _amountDueToday = signal(parseCurrency(0).toString());
  protected readonly _amountDueRecurring = signal(parseCurrency(0).toString());
  // protected readonly _couponCodeValue = signal('');
  protected readonly _isSubmitRequestInProgress = signal(false);
  protected readonly _storedPaymentMethodOptions = signal<Array<MenuOption<PaymentMethod>>>([]);
  protected readonly _selectedPaymentMethodLabel = toSignal(
    this._selectedPaymentMethodControl.valueChanges.pipe(
      map(value => (value ? this._formatPaymentMethod(value, false) : ''))
    ),
    { initialValue: $localize`your payment method on file` }
  );

  // private readonly _anchoredFloatingBoxService = inject(AnchoredFloatingBoxService);
  private readonly _checkoutService = inject(CheckoutService);
  private readonly _logger = new Logger(
    'SubscriptionUpdateCheckoutComponent',
    inject(UserService).getCurrentUserEmail()
  );

  private readonly _notificationService = inject(NotificationService);
  private readonly _router = inject(Router);
  private readonly _entitlementService = inject(EntitlementService);
  private readonly _billingService = inject(BillingService);
  private readonly _paymentMethodService = inject(PaymentMethodService);
  private readonly _progressService = inject(ProgressService);

  // private _couponCodeFormFloatingBoxRef?: AnchoredFloatingBoxRef;

  constructor() {
    afterNextRender({
      write: async () => {
        try {
          this._isFetchingCheckoutPreview.set(true);
          const checkoutPreviewResponse = await this._checkoutService.previewCheckout(this.selectedPlan().offeringId);

          this._tax.set(parseCurrency(checkoutPreviewResponse.tax).toString());
          this._amountDueToday.set(parseCurrency(checkoutPreviewResponse.amountDue).toString());
          this._refund.set(parseCurrency(checkoutPreviewResponse.refund).toString());
          this._storedPaymentMethodOptions.set(
            checkoutPreviewResponse.storedPaymentMethods
              .sort(a => (a.isDefault ? -1 : 1))
              .map(
                paymentMethod =>
                  new MenuOption(
                    this._formatPaymentMethod(paymentMethod, true),
                    paymentMethod,
                    this._formatPaymentMethod(paymentMethod, false)
                  )
              )
          );

          this._selectedPaymentMethodControl.setValue(
            this._storedPaymentMethodOptions().find(option => option.value.isDefault)?.value ?? null
          );

          if (checkoutPreviewResponse.taxPercentage !== '0.00') {
            const taxOnRecurringAmount = calculateTax(
              this.selectedPlan().discountedPrice,
              checkoutPreviewResponse.taxPercentage
            );
            this._amountDueRecurring.set(
              parseCurrency(this.selectedPlan().discountedPrice).add(taxOnRecurringAmount).toString()
            );
            this._taxPercentage.set(checkoutPreviewResponse.taxPercentage);
          } else {
            this._amountDueRecurring.set(parseCurrency(this.selectedPlan().discountedPrice).toString());
          }

          /* istanbul ignore if -- @preserve */
          if (!__IS_TEST__) {
            // Added an artificial delay to avoid flashes
            await delayBy(500);
          }

          this._isFetchingCheckoutPreview.set(false);
        } catch (error) {
          const errorInfo = getErrorInfo(error);

          if (
            errorInfo.message === 'no stripe subscription was found' ||
            errorInfo.message === 'no billing info was found'
          ) {
            // Going back to previous page so that navigating to '/checkout' can work properly
            // because we're already on '/checkout' page, so navigating to '/checkout' again won't work
            await this._router.navigateByUrl('..');
            void this._router.navigateByUrl('/checkout', {
              state: {
                checkoutSession: new CheckoutSession(this.selectedPlan(), 'NEW_SUBSCRIPTION')
              }
            });
          } else {
            this._logger.error('failed to get checkout preview', errorInfo);

            void this._router.navigateByUrl(getErrorPagePath('unknown'), {
              skipLocationChange: true,
              state: {
                requestId: errorInfo.payload.requestId
              }
            });
          }
        }
      }
    });
  }

  private _formatPaymentMethod(paymentMethod: PaymentMethod, showExpDate: boolean) {
    if (showExpDate) {
      // eslint-disable-next-line max-len
      return `${capitalize(paymentMethod.brand)} ××××-${paymentMethod.last4}<div style="font-size: small; color: #bbb">${paymentMethod.expMonth} / ${paymentMethod.expYear}</div>`;
    }

    return `${capitalize(paymentMethod.brand)} ××××-${paymentMethod.last4}`;
  }

  // protected _getCouponCodeFormControl() {
  //   return this._couponCodeForm.get('couponCode') as FormControl<string>;
  // }

  // protected _onShowCouponCodeInput(anchor: HTMLButtonElement, formTemplate: TemplateRef<void>) {
  //   this._couponCodeForm.reset({ couponCode: this._couponCodeValue() });
  //   this._couponCodeFormFloatingBoxRef = this._anchoredFloatingBoxService.open({
  //     anchor,
  //     className: 'lc-checkout__coupon-code-form',
  //     content: formTemplate
  //   });
  // }

  // protected _onRemoveCoupon() {
  //   this._couponCodeForm.reset({ couponCode: this._couponCodeValue() });
  //   this._couponCodeValue.set('');
  //   this._discount.set('0');
  // }

  // protected _onApplyCouponCode() {
  //   this._couponCodeFormFloatingBoxRef?.close();
  //   this._couponCodeValue.set(this._getCouponCodeFormControl().value);
  // }

  protected async _onAddPaymentMethod() {
    try {
      void this._progressService.openIndeterminateProgressIndicator();

      location.href = await this._paymentMethodService.getUrlToPageForAddingPaymentMethod(location.pathname);
    } catch (error) {
      this._progressService.close();

      const errorInfo = getErrorInfo(error);

      if (errorInfo.message === 'no billing info exists') {
        this._notificationService.open({
          bypassHtmlSanitization: true,

          content: $localize`Unable to add new payment method because we don't have your billing info on file.`
        });
      } else {
        this._logger.error('failed to get URL to page to add payment method', errorInfo);

        this._notificationService.open({
          content: resolveCommonErrorMessage(errorInfo.message)
        });
      }
    }
  }

  protected _formatMessageAboutRefund() {
    if (this._amountDueToday().startsWith('-')) {
      const defaultPaymentMethod = this._storedPaymentMethodOptions().find(option => option.value.isDefault)!.value;
      const refundAmount = this._amountDueToday().replace('-', '');

      // eslint-disable-next-line max-len
      return $localize`A refund in the amount of ${new CurrencyPipe(document.documentElement.lang || 'en').transform(refundAmount)} will be issued back to your ${this._formatPaymentMethod(defaultPaymentMethod, false)} within 5-10 business days.`;
    }

    return '';
  }

  protected _shouldDisableSubmitButton() {
    return (
      this._isSubmitRequestInProgress() ||
      this._isFetchingCheckoutPreview() ||
      (this._selectedPaymentMethodControl.invalid && this.checkoutType() !== 'DOWNGRADE') ||
      this._paymentConsentFormControl.invalid
    );
  }

  protected _onSubmit() {
    if (this.checkoutType() !== 'REACTIVATION') {
      void this._updateSubscription();
    } else {
      void this._reactivateSubscription();
    }
  }

  private async _updateSubscription() {
    try {
      this._isSubmitRequestInProgress.set(true);
      const success = await this._checkoutService.updatePaidSuscription(
        this.selectedPlan().offeringId,
        this._selectedPaymentMethodControl.value!
      );

      if (!success) {
        const latestPayment = (await this._billingService.findLatestPayment()).orElseThrow();

        // If the payment status is 'FAILED_REFUND', it means that the payment was successful but the refund failed,
        // in this case, we don't want to show the payment failure message
        if (latestPayment.status !== 'FAILED_REFUND') {
          if (latestPayment.failureReason === null) {
            throw new Error('subscription update task has encountered an unknown error');
          }

          this._handlePaymentFailure(latestPayment.failureReason);

          this._isSubmitRequestInProgress.set(false);

          return;
        }
      }

      this._entitlementService.updateSubscriptionPlan(this.selectedPlan());

      void this._router.navigateByUrl('/my/subscription');

      this._notificationService.open({
        bypassHtmlSanitization: true,
        content: this._resolvePaymentSuccessMessage()
      });
    } catch (error) {
      const errorInfo = getErrorInfo(error);

      const currentPlan = new SubscriptionLabelPipe().transform(this._currentSubscription.plan);
      const selectedPlan = new SubscriptionLabelPipe().transform(this.selectedPlan());
      const errorExtra = {
        currentPlan,
        paymentMethodId: this._selectedPaymentMethodControl.value?.paymentMethodId ?? '',
        selectedPlan
      };

      /* istanbul ignore if -- @preserve */
      if (error instanceof TimeoutError) {
        this._logger.error('subscription update task status task polling has timed out', errorInfo, errorExtra);

        this._notificationService.open({
          content: resolveCommonErrorMessage('')
        });
      } else if (errorInfo.payload.code === ExceptionCode.FAILED_PAYMENT) {
        this._handlePaymentFailure(errorInfo.payload.extra!.failureReason as string);
      } else {
        this._logger.error('failed to update subscription', errorInfo, errorExtra);

        this._notificationService.open({
          content: resolveCommonErrorMessage(errorInfo.message)
        });
      }

      this._isSubmitRequestInProgress.set(false);
    }
  }

  private _handlePaymentFailure(failureReason: string) {
    const [code, declineCode] = failureReason.split('.');
    // eslint-disable-next-line camelcase
    this.paymentFailure.emit({ code, decline_code: declineCode, type: 'card_error' });
  }

  private _resolvePaymentSuccessMessage() {
    // eslint-disable-next-line max-len
    const commonMessage = $localize`Your request to change to ${new SubscriptionLabelPipe().transform(this.selectedPlan())} plan has been processed successfully.`;

    if (!this._isAmountDueTodayARefund()) {
      return commonMessage;
    }

    const refund = this._amountDueToday().replace('-', '');

    // eslint-disable-next-line max-len
    return $localize`${commonMessage}<div style="margin-top: 8px; margin-bottom: 8px">A refund of approximately <strong>${new CurrencyPipe('en').transform(refund)}</strong> will be issued back to the original payment method within 5-10 business days.</div>To check the status of your refund, please go to <strong>Billing history</strong> page.`;
  }

  protected _isAmountDueTodayARefund() {
    return this._amountDueToday().startsWith('-');
  }

  private async _reactivateSubscription() {
    try {
      this._isSubmitRequestInProgress.set(true);

      const success = await this._checkoutService.reactivatePaidSubscription(this._selectedPaymentMethodControl.value!);

      if (!success) {
        const latestPayment = (await this._billingService.findLatestPayment()).orElseThrow();

        if (latestPayment.failureReason === null) {
          throw new Error('subscription reactivation task has encountered an unknown error');
        }

        this._handlePaymentFailure(latestPayment.failureReason);

        this._isSubmitRequestInProgress.set(false);

        return;
      }

      this._entitlementService.markSubscriptionAsActive();

      void this._router.navigateByUrl('/my/subscription');

      this._notificationService.open({
        // eslint-disable-next-line max-len
        content: $localize`Your ${new SubscriptionLabelPipe().transform(this._currentSubscription.plan)} subscription has been reactivated. Thank you for your continuing support.`
      });
    } catch (error) {
      const errorInfo = getErrorInfo(error);

      this._logger.error('failed to reactivate subscription', errorInfo, {
        paymentMethodId: this._selectedPaymentMethodControl.value?.paymentMethodId ?? '',
        plan: new SubscriptionLabelPipe().transform(this._currentSubscription.plan)
      });

      this._isSubmitRequestInProgress.set(false);

      if (errorInfo.payload.code === ExceptionCode.FAILED_PAYMENT) {
        this._handlePaymentFailure(errorInfo.payload.extra!.failureReason as string);
      } else if (errorInfo.message === 'subscription reactivation task has encountered an unknown error') {
        this._notificationService.open({
          // eslint-disable-next-line max-len
          content: $localize`Your payment was successful, but we encountered an issue while reactivating your subscription. Please contact support for further assistance.`
        });
      } else {
        this._notificationService.open({
          content: resolveCommonErrorMessage(errorInfo.message)
        });
      }
    }
  }
}
