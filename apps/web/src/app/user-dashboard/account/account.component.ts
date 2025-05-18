import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, signal, ViewEncapsulation } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { MatRipple } from '@angular/material/core';
import { NotificationService } from '@lazycuh/angular-notification';
import { Logger } from '@lazycuh/logging';
import { ActionContainerComponent } from '@lazycuh/web-ui-common/action-container';
import { UserService } from '@lazycuh/web-ui-common/auth';
import { CapitalizePipe } from '@lazycuh/web-ui-common/capitalize';
import { fadeIn } from '@lazycuh/web-ui-common/effect/fade-in';
import { FormComponent } from '@lazycuh/web-ui-common/form/form';
import { PasswordFormFieldComponent } from '@lazycuh/web-ui-common/form/password-form-field';
import { ShortTextFormFieldComponent } from '@lazycuh/web-ui-common/form/short-text-form-field';
import { validatePassword } from '@lazycuh/web-ui-common/form/validators';
import { IconComponent } from '@lazycuh/web-ui-common/icon';
import { InfoBoxComponent } from '@lazycuh/web-ui-common/message-box/info-box';
import { WarningBoxComponent } from '@lazycuh/web-ui-common/message-box/warning-box';
import { PageWithForm } from '@lazycuh/web-ui-common/page-with-form';
import { PulseLoaderComponent } from '@lazycuh/web-ui-common/pulse-loader';
import { getErrorInfo } from '@lazycuh/web-ui-common/utils/get-error-info';

import { resolveCommonErrorMessage } from '@common/resolve-common-error-message';
import { TurnstileFormFieldComponent } from '@common/turnstile-form-field';

import { AccountService } from './services';

@Component({
  animations: [
    fadeIn({
      duration: '0.5s',
      name: 'fade-in'
    })
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'user-account'
  },
  imports: [
    FormComponent,
    ShortTextFormFieldComponent,
    PasswordFormFieldComponent,
    IconComponent,
    MatRipple,
    PulseLoaderComponent,
    TurnstileFormFieldComponent,
    DatePipe,
    ActionContainerComponent,
    InfoBoxComponent,
    WarningBoxComponent,
    CapitalizePipe
  ],
  providers: [AccountService, InfoBoxComponent],
  selector: 'lc-account',
  styleUrl: './account.component.scss',
  templateUrl: './account.component.html'
})
export class AccountComponent extends PageWithForm {
  protected readonly _form = new FormGroup({
    currentPassword: new FormControl('', [Validators.required]),
    displayName: new FormControl('', [Validators.minLength(2), Validators.maxLength(32)]),
    email: new FormControl('', [Validators.minLength(12), Validators.email, Validators.maxLength(64)]),
    newPassword: new FormControl('', [validatePassword]),
    turnstile: new FormControl('', [Validators.required])
  });

  protected readonly _isAccountUpdateRequestInProgress = signal(false);
  protected readonly _isSendingAccountVerificationEmailRequestInProgress = signal(false);
  protected readonly _isAccountVerificationEmailSentSuccessfully = signal(false);
  protected readonly _authenticatedUser = signal(this._userService.getAuthenticatedUser());

  private readonly _logger = new Logger('AccountComponent', this._authenticatedUser().email);

  constructor(
    private readonly _userService: UserService,
    private readonly _accountService: AccountService,
    private readonly _notificationService: NotificationService
  ) {
    super();

    const authenticatedUser = _userService.getAuthenticatedUser();

    this._form.patchValue({
      displayName: authenticatedUser.displayName,
      email: authenticatedUser.email
    });

    if (authenticatedUser.provider !== '') {
      this._form.disable();
    }
  }

  protected override _clearForm() {
    this._form.reset({ currentPassword: '', displayName: '', email: '', newPassword: '' });
  }

  protected async _onSubmit(formValue: NotNullable<AccountComponent['_form']['value']>) {
    try {
      this._isAccountUpdateRequestInProgress.set(true);
      this._shouldDisableSubmitButton.set(true);
      this._shouldDisableClearButton.set(true);

      await this._accountService.update(formValue);

      this._notificationService.open({
        content: $localize`Account was updated.`
      });
    } catch (error) {
      const errorInfo = getErrorInfo(error);

      if (errorInfo.message === 'current password was not correct') {
        this._notificationService.open({
          content: $localize`Current password was not correct. Please try again.`
        });

        const currentPasswordControl = this._findFormControl('currentPassword');
        currentPasswordControl.setErrors({
          incorrect: $localize`Current password was not correct`
        });
        currentPasswordControl.markAsTouched();
      } else {
        this._logger.error('failed to update account', errorInfo);

        this._notificationService.open({
          content: resolveCommonErrorMessage(errorInfo.message)
        });

        this._shouldDisableSubmitButton.set(false);
      }
    } finally {
      this._isAccountUpdateRequestInProgress.set(false);
      this._shouldDisableClearButton.set(false);
    }
  }

  protected _findFormControl(controlName: FormControlNameList<AccountComponent['_form']>) {
    return this._form.get(controlName) as FormControl<string>;
  }

  protected _hasLoginProvider() {
    return this._authenticatedUser().provider !== '';
  }

  protected _isEmailUnverified() {
    return this._authenticatedUser().status === 'UNVERIFIED';
  }

  protected async _sendAccountVerificationEmail() {
    try {
      this._isSendingAccountVerificationEmailRequestInProgress.set(true);

      await this._accountService.sendAccountVerificationEmail();

      this._isAccountVerificationEmailSentSuccessfully.set(true);
    } catch (error) {
      const errorInfo = getErrorInfo(error);

      this._logger.error('failed to send account verification email', errorInfo);

      this._notificationService.open({
        content: resolveCommonErrorMessage(errorInfo.message)
      });
    } finally {
      this._isSendingAccountVerificationEmailRequestInProgress.set(false);
    }
  }

  protected _getBlockDateIfEmailIsNotVerified() {
    const verificationGracePeriodInDays = 7;
    const createdAt = new Date(this._authenticatedUser().createdAt);

    createdAt.setDate(createdAt.getDate() + verificationGracePeriodInDays);

    return createdAt;
  }
}
