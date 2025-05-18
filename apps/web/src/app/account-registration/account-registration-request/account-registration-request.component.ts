import { ChangeDetectionStrategy, Component, inject, signal, viewChild, ViewEncapsulation } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { MatRipple } from '@angular/material/core';
import { Router, RouterLink } from '@angular/router';
import { NotificationService } from '@lazycuh/angular-notification';
import { ExceptionCode } from '@lazycuh/http';
import { ActionContainerComponent } from '@lazycuh/web-ui-common/action-container';
import { BackButtonComponent } from '@lazycuh/web-ui-common/back-button';
import { CarouselComponent, CarouselItemComponent } from '@lazycuh/web-ui-common/carousel';
import { slideUp } from '@lazycuh/web-ui-common/effect/slide-up';
import { FocusBoxComponent } from '@lazycuh/web-ui-common/focus-box';
import { FormComponent } from '@lazycuh/web-ui-common/form/form';
import { PasswordFormFieldComponent } from '@lazycuh/web-ui-common/form/password-form-field';
import { ShortTextFormFieldComponent } from '@lazycuh/web-ui-common/form/short-text-form-field';
import { validatePassword } from '@lazycuh/web-ui-common/form/validators';
import { PageWithForm } from '@lazycuh/web-ui-common/page-with-form';
import { ProgressCompleteIndicatorComponent } from '@lazycuh/web-ui-common/progress-complete-indicator';
import { PulseLoaderComponent } from '@lazycuh/web-ui-common/pulse-loader';
import { GlobalStateStore } from '@lazycuh/web-ui-common/state-store';
import { delayBy } from '@lazycuh/web-ui-common/utils/delay-by';
import { getErrorInfo } from '@lazycuh/web-ui-common/utils/get-error-info';
import { scrollToTop } from '@lazycuh/web-ui-common/utils/scroller';

import { ConsentDisplayComponent } from '@common/consent-display';
import { resolveCommonErrorMessage } from '@common/resolve-common-error-message';
import { TurnstileFormFieldComponent } from '@common/turnstile-form-field';

import { AccountRegistrationRequestService } from './services';

@Component({
  animations: [
    slideUp({
      duration: '0.75s',
      easingFunction: 'ease',
      from: '10%',
      name: 'focusBox',
      to: '0'
    })
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'account-registration-request'
  },
  imports: [
    FormComponent,
    ShortTextFormFieldComponent,
    PasswordFormFieldComponent,
    MatRipple,
    PulseLoaderComponent,
    CarouselComponent,
    CarouselItemComponent,
    ProgressCompleteIndicatorComponent,
    RouterLink,
    TurnstileFormFieldComponent,
    FocusBoxComponent,
    ActionContainerComponent,
    BackButtonComponent,
    ConsentDisplayComponent
  ],
  providers: [AccountRegistrationRequestService],
  selector: 'lc-account-registration-request',
  styleUrl: './account-registration-request.component.scss',
  templateUrl: './account-registration-request.component.html'
})
export class AccountRegistrationRequestComponent extends PageWithForm {
  protected readonly _form = new FormGroup({
    displayName: new FormControl('', [Validators.required, Validators.maxLength(32)]),
    email: new FormControl('', [Validators.required, Validators.email, Validators.maxLength(64)]),
    password: new FormControl('', [Validators.required, validatePassword]),
    turnstile: new FormControl('', [Validators.required])
  });

  protected readonly _isRegistrationRequestInProgress = signal(false);
  protected readonly _isRegistrationRequestCreated = signal(false);

  private readonly _accountRegistrationRequestService = inject(AccountRegistrationRequestService);
  private readonly _notificationService = inject(NotificationService);
  private readonly _carousel = viewChild.required(CarouselComponent);
  private readonly _globalStateStore = inject(GlobalStateStore);
  private readonly _router = inject(Router);

  protected override _clearForm() {
    this._form.reset({ displayName: '', email: '', password: '' });
  }

  protected async _onSubmit(formValue: NotNullable<AccountRegistrationRequestComponent['_form']['value']>) {
    try {
      this._isRegistrationRequestInProgress.set(true);
      this._shouldDisableSubmitButton.set(true);
      this._shouldDisableClearButton.set(true);

      await this._accountRegistrationRequestService.registerNewAccount(formValue);

      void this._handleRegistrationSuccess();
    } catch (error) {
      const errorInfo = getErrorInfo(error);
      const exceptionPayload = errorInfo.payload;

      if (exceptionPayload.code === ExceptionCode.RESOURCE_EXISTS) {
        this._notificationService.open({
          content: $localize`Email <strong>${formValue.email}</strong> is already associated with another account.`
        });

        this._findFormControl('email').setErrors({
          exists: $localize`Email is already used by another user`
        });
      } else {
        this._notificationService.open({
          content: resolveCommonErrorMessage(errorInfo.message)
        });
      }
    } finally {
      this._isRegistrationRequestInProgress.set(false);
      this._shouldDisableClearButton.set(false);
      this._shouldDisableSubmitButton.set(false);
    }
  }

  private async _handleRegistrationSuccess() {
    /*
     * We want to see whether the registration page was opened by some other page
     * and if so, we want to redirect back to that page.
     */
    const interceptedRoute = this._globalStateStore.valueOf('interceptedRoute');

    if (interceptedRoute.path !== '/') {
      this._globalStateStore.update(
        {
          interceptedRoute: { path: '/', state: null }
        },
        { persistent: true }
      );

      await this._router.navigateByUrl(interceptedRoute.path, {
        state: interceptedRoute.state ?? undefined
      });
    } else {
      scrollToTop();
      await delayBy(250);
      this._carousel().nextCarouselItem();
      this._isRegistrationRequestCreated.set(true);
    }
  }

  protected _findFormControl(controlName: FormControlNameList<AccountRegistrationRequestComponent['_form']>) {
    return this._form.get(controlName) as FormControl<string>;
  }
}
