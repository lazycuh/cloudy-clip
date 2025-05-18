/* eslint-disable camelcase */
import { CurrencyPipe } from '@angular/common';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
  output,
  signal,
  viewChild,
  ViewEncapsulation
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, Validators } from '@angular/forms';
import { MatRipple } from '@angular/material/core';
import { NotificationService } from '@lazycuh/angular-notification';
import { Logger } from '@lazycuh/logging';
import { ActionContainerComponent } from '@lazycuh/web-ui-common/action-container';
import { UserService } from '@lazycuh/web-ui-common/auth';
import { BackButtonComponent } from '@lazycuh/web-ui-common/back-button';
import { CarouselComponent, CarouselItemComponent } from '@lazycuh/web-ui-common/carousel';
import { expand } from '@lazycuh/web-ui-common/effect/expand';
import { fadeIn } from '@lazycuh/web-ui-common/effect/fade-in';
import { Plan } from '@lazycuh/web-ui-common/entitlement';
import { FocusBoxComponent } from '@lazycuh/web-ui-common/focus-box';
import { FormComponent } from '@lazycuh/web-ui-common/form/form';
import { SelectFormFieldComponent } from '@lazycuh/web-ui-common/form/select-form-field';
import { ShortTextFormFieldComponent } from '@lazycuh/web-ui-common/form/short-text-form-field';
import { InfoTooltipComponent } from '@lazycuh/web-ui-common/info-tooltip';
import { ProgressService } from '@lazycuh/web-ui-common/progress';
import { PulseLoaderComponent } from '@lazycuh/web-ui-common/pulse-loader';
import { getErrorInfo } from '@lazycuh/web-ui-common/utils/get-error-info';
import { StripeElements, StripeError } from '@stripe/stripe-js';
import { map } from 'rxjs';

import { calculateTax, parseCurrency } from '@common/currency';
import { RenewalIntervalPipe, SubscriptionLabelPipe } from '@common/entitlement';
import { resolveCommonErrorMessage } from '@common/resolve-common-error-message';
import { TurnstileFormFieldComponent } from '@common/turnstile-form-field';

import { EntitlementListComponent } from '../../entitlement-list';
import { countries, CountryCode, NewSubscriptionCheckoutRequest } from '../models';
import { CheckoutService } from '../services';

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
    class: 'new-subscription-checkout'
  },
  imports: [
    ActionContainerComponent,
    BackButtonComponent,
    CarouselComponent,
    CarouselItemComponent,
    CurrencyPipe,
    EntitlementListComponent,
    FocusBoxComponent,
    FormComponent,
    InfoTooltipComponent,
    MatRipple,
    PulseLoaderComponent,
    RenewalIntervalPipe,
    SelectFormFieldComponent,
    ShortTextFormFieldComponent,
    // TruncatedTextComponent,
    TurnstileFormFieldComponent
  ],
  selector: 'lc-new-subscription-checkout',
  styleUrl: './new-subscription-checkout.component.scss',
  templateUrl: './new-subscription-checkout.component.html'
})
export class NewSubscriptionCheckoutComponent {
  readonly selectedPlan = input.required<Readonly<Plan>>();

  readonly paymentFailure = output<StripeError>();

  private readonly _formBuilder = inject(NonNullableFormBuilder);

  protected readonly _isCheckoutRequestInProgress = signal(false);
  // protected readonly _couponCodeForm = this._formBuilder.group({
  //   couponCode: ['']
  // });

  protected readonly _tax = signal<string | undefined>(undefined);
  protected readonly _taxPercentage = signal('0.00');
  protected readonly _discount = signal<string>(parseCurrency(0).toString());
  protected readonly _amountDueToday = signal<string>(parseCurrency(0).toString());
  protected readonly _amountDueRecurring = signal<string>(parseCurrency(0).toString());

  // protected readonly _couponCodeValue = signal('');
  protected readonly _countryOptions = countries;
  protected readonly _billingInfoForm = this._formBuilder.group({
    countryCode: ['US' as CountryCode, Validators.required],
    fullName: this._formBuilder.control('', [Validators.required, Validators.maxLength(64)]),
    postalCode: this._formBuilder.control('', [Validators.required, Validators.maxLength(16)]),
    turnstile: ['', Validators.required]
  });

  protected readonly _isBillingInfoFormInvalid = toSignal(
    this._billingInfoForm.statusChanges.pipe(map(status => status === 'INVALID')),
    { initialValue: true }
  );

  protected readonly _shouldDisableConfirmPaymentButton = signal(true);
  protected readonly _isConfirmingPaymentRequestInProgress = signal(false);
  protected readonly _isPaymentFormReady = signal(false);
  protected readonly _shouldShowLoaderForFreePlanCheckoutButton = signal(false);
  protected readonly _shouldShowLoaderForPaidPlanCheckoutButton = signal(false);

  // private readonly _anchoredFloatingBoxService = inject(AnchoredFloatingBoxService);
  private readonly _carousel = viewChild.required(CarouselComponent);
  private readonly _checkoutService = inject(CheckoutService);
  private readonly _notificationService = inject(NotificationService);
  private readonly _userService = inject(UserService);
  private readonly _logger = new Logger('NewSubscriptionCheckoutComponent', this._userService.getCurrentUserEmail());

  private _stripeElementsInstance!: StripeElements;
  // private _couponCodeFormFloatingBoxRef?: AnchoredFloatingBoxRef;
  private _paymentTaskId = '';

  constructor() {
    const progressService = inject(ProgressService);

    afterNextRender({
      write: async () => {
        try {
          this._amountDueToday.set(parseCurrency(this.selectedPlan().discountedPrice).toString());
          this._amountDueRecurring.set(parseCurrency(this.selectedPlan().discountedPrice).toString());

          void progressService.openIndeterminateProgressIndicator();

          const billingInfo = (await this._checkoutService.findBillingInfo()).orElse(null);

          if (billingInfo !== null) {
            this._billingInfoForm.setValue({
              countryCode: billingInfo.countryCode,
              fullName: this._userService.getAuthenticatedUser().displayName,
              postalCode: billingInfo.postalCode,
              turnstile: ''
            });

            this._billingInfoForm.markAsDirty();
          }
        } catch (error) {
          this._logger.error('failed to get billing info', error, {
            userEmail: this._userService.getAuthenticatedUser().email
          });
        } finally {
          progressService.close();
        }
      }
    });
  }

  // protected _onShowCouponCodeInput(anchor: HTMLButtonElement, formTemplate: TemplateRef<void>) {
  //   this._getCouponCodeFormControl().reset(this._couponCodeValue());
  //   this._couponCodeFormFloatingBoxRef = this._anchoredFloatingBoxService.open({
  //     anchor,
  //     className: 'lc-checkout__coupon-code-form',
  //     content: formTemplate
  //   });
  // }

  // protected _getCouponCodeFormControl() {
  //   return this._couponCodeForm.get('couponCode') as FormControl<string>;
  // }

  // protected _onRemoveCoupon() {
  //   this._getCouponCodeFormControl().reset('');
  //   this._couponCodeValue.set('');
  //   this._discount.set(parseCurrency(0).toString());
  // }

  // protected _onApplyCouponCode() {
  //   this._couponCodeFormFloatingBoxRef?.close();
  //   const discountCode = this._getCouponCodeFormControl().value;

  //   this._couponCodeValue.set(discountCode);
  // }

  protected _getBillingInfoFormField<
    K extends FormControlNameList<NewSubscriptionCheckoutComponent['_billingInfoForm']>
  >(name: K) {
    return this._billingInfoForm.get(name) as unknown as FormControlType<
      NewSubscriptionCheckoutComponent['_billingInfoForm'],
      K
    >;
  }

  protected async _onCheckOutPaidPlan() {
    try {
      if (this._billingInfoForm.pristine) {
        this._carousel().nextCarouselItem();

        return;
      }

      this._shouldShowLoaderForPaidPlanCheckoutButton.set(true);

      const billingInfoFormValue = this._billingInfoForm.value as FormValue<
        NewSubscriptionCheckoutComponent['_billingInfoForm']
      >;

      const { taskId, checkoutResponse } = await this._checkoutService.checkOutNewSubscription(
        new NewSubscriptionCheckoutRequest(this.selectedPlan(), billingInfoFormValue, ''),
        billingInfoFormValue.turnstile
      );

      this._paymentTaskId = taskId;
      this._tax.set(parseCurrency(checkoutResponse.tax).toString());
      this._taxPercentage.set(checkoutResponse.taxPercentage);
      this._discount.set(parseCurrency(checkoutResponse.discount).toString());
      this._amountDueToday.set(parseCurrency(checkoutResponse.amountDue).toString());

      const taxOnRecurringAmount = calculateTax(this.selectedPlan().discountedPrice, checkoutResponse.taxPercentage);
      this._amountDueRecurring.set(
        parseCurrency(this.selectedPlan().discountedPrice).add(taxOnRecurringAmount).toString()
      );

      this._stripeElementsInstance = window.stripeInstance!.elements({
        appearance: {
          theme: 'night',
          variables: {
            fontFamily: 'YoMama',
            fontSizeBase: '16px',
            fontSmooth: 'unset'
          }
        },
        clientSecret: checkoutResponse.clientSecret,
        fonts: [{ cssSrc: '/styles.css' }],

        loader: 'always'
      });

      // Create and mount the Payment Element
      const paymentFormElement = this._stripeElementsInstance.create('payment', {
        defaultValues: {
          billingDetails: {
            address: {
              country: billingInfoFormValue.countryCode,
              postal_code: billingInfoFormValue.postalCode
            },
            email: this._userService.getAuthenticatedUser().email,
            name: billingInfoFormValue.fullName
          }
        },
        fields: { billingDetails: 'never' }
      });

      paymentFormElement.mount('.lc-checkout__payment__collection');

      paymentFormElement.once('ready', () => {
        this._isPaymentFormReady.set(true);
      });

      paymentFormElement.on('change', event => {
        this._shouldDisableConfirmPaymentButton.set(!event.complete);
      });

      paymentFormElement.once('loaderror', details => {
        this._logger.error('failed to load payment form', details.error);

        this._notificationService.open({
          content: $localize`Failed to load payment form. Please trying refreshing your browser.`
        });
      });

      this._carousel().nextCarouselItem();

      this._billingInfoForm.markAsPristine();
    } catch (error) {
      const errorInfo = getErrorInfo(error);

      this._logger.error('failed to check out paid plan', errorInfo, {
        plan: new SubscriptionLabelPipe().transform(this.selectedPlan())
      });

      this._notificationService.open({
        content: resolveCommonErrorMessage(errorInfo.message)
      });
    } finally {
      this._shouldShowLoaderForPaidPlanCheckoutButton.set(false);
    }
  }

  protected async _onCheckOutFreePlan() {
    try {
      this._shouldShowLoaderForFreePlanCheckoutButton.set(true);

      const billingInfoFormValue = this._billingInfoForm.value as FormValue<
        NewSubscriptionCheckoutComponent['_billingInfoForm']
      >;

      await this._checkoutService.checkOutNewSubscription(
        new NewSubscriptionCheckoutRequest(this.selectedPlan(), billingInfoFormValue),
        billingInfoFormValue.turnstile
      );

      window.location.href = '/purchase/confirmation';
    } catch (error) {
      const errorInfo = getErrorInfo(error);

      this._logger.error('failed to check out free plan', errorInfo, {
        plan: new SubscriptionLabelPipe().transform(this.selectedPlan())
      });

      this._notificationService.open({
        content: resolveCommonErrorMessage(errorInfo.message)
      });

      this._shouldShowLoaderForFreePlanCheckoutButton.set(false);
    }
  }

  protected _onGoToBillingInfoScreen() {
    this._carousel().previousCarouselItem();
  }

  protected async _onConfirmPayment(event: Event) {
    event.preventDefault();

    try {
      this._isConfirmingPaymentRequestInProgress.set(true);

      const billingInfoFormValue = this._billingInfoForm.value as FormValue<
        NewSubscriptionCheckoutComponent['_billingInfoForm']
      >;

      const { error } = await window.stripeInstance!.confirmPayment({
        clientSecret: '',
        confirmParams: {
          payment_method_data: {
            billing_details: {
              address: {
                city: '',
                country: billingInfoFormValue.countryCode,
                line1: '',
                line2: '',
                postal_code: billingInfoFormValue.postalCode,
                state: ''
              },
              email: this._userService.getAuthenticatedUser().email,
              name: billingInfoFormValue.fullName,
              phone: ''
            }
          },

          return_url: `${__ORIGIN__}/purchase/confirmation?task=${this._paymentTaskId}`
        },
        elements: this._stripeElementsInstance
      });

      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (!error) {
        return;
      }

      // This point will only be reached if there is an immediate error when
      // confirming the payment. Show error to your customer (for example, payment
      // details incomplete)
      this._logger.error('failed to check out paid plan', error, {
        plan: new SubscriptionLabelPipe().transform(this.selectedPlan())
      });

      this.paymentFailure.emit(error);
    } catch (error) {
      const errorInfo = getErrorInfo(error);

      this._logger.error('failed to check out paid plan', errorInfo, {
        plan: new SubscriptionLabelPipe().transform(this.selectedPlan())
      });

      this._notificationService.open({
        content: resolveCommonErrorMessage(errorInfo.message)
      });
    } finally {
      this._isConfirmingPaymentRequestInProgress.set(false);
    }
  }
}
