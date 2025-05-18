import { ChangeDetectionStrategy, Component, inject, signal, viewChild, ViewEncapsulation } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { MatRipple } from '@angular/material/core';
import { RouterLink } from '@angular/router';
import { NotificationService } from '@lazycuh/angular-notification';
import { ExceptionCode } from '@lazycuh/http';
import { Logger } from '@lazycuh/logging';
import { ActionContainerComponent } from '@lazycuh/web-ui-common/action-container';
import { BackButtonComponent } from '@lazycuh/web-ui-common/back-button';
import { capitalize } from '@lazycuh/web-ui-common/capitalize';
import { CarouselComponent, CarouselItemComponent } from '@lazycuh/web-ui-common/carousel';
import { slideUp } from '@lazycuh/web-ui-common/effect/slide-up';
import { FocusBoxComponent } from '@lazycuh/web-ui-common/focus-box';
import { FormComponent } from '@lazycuh/web-ui-common/form/form';
import { ShortTextFormFieldComponent } from '@lazycuh/web-ui-common/form/short-text-form-field';
import { PageWithForm } from '@lazycuh/web-ui-common/page-with-form';
import { ProgressCompleteIndicatorComponent } from '@lazycuh/web-ui-common/progress-complete-indicator';
import { PulseLoaderComponent } from '@lazycuh/web-ui-common/pulse-loader';
import { getErrorInfo } from '@lazycuh/web-ui-common/utils/get-error-info';

import { resolveCommonErrorMessage } from '@common/resolve-common-error-message';
import { TurnstileFormFieldComponent } from '@common/turnstile-form-field';

import { PasswordResetRequestService } from './services';

@Component({
  animations: [
    slideUp({
      duration: '0.75s',
      easingFunction: 'ease',
      from: '10%',
      name: 'focusBox',
      to: '-5%'
    })
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'password-reset-request'
  },
  imports: [
    FormComponent,
    ShortTextFormFieldComponent,
    MatRipple,
    PulseLoaderComponent,
    CarouselComponent,
    CarouselItemComponent,
    ProgressCompleteIndicatorComponent,
    RouterLink,
    TurnstileFormFieldComponent,
    FocusBoxComponent,
    ActionContainerComponent,
    BackButtonComponent
  ],
  providers: [PasswordResetRequestService],
  selector: 'lc-password-reset-request',
  styleUrl: './password-reset-request.component.scss',
  templateUrl: './password-reset-request.component.html'
})
export class PasswordResetRequestComponent extends PageWithForm {
  protected readonly _form = new FormGroup({
    email: new FormControl('', [Validators.required, Validators.email, Validators.maxLength(64)]),
    turnstile: new FormControl('', [Validators.required])
  });

  protected readonly _isPasswordResetRequestInProgress = signal(false);
  protected readonly _isPasswordResetRequestCreated = signal(false);

  private readonly _carousel = viewChild.required(CarouselComponent);
  private readonly _logger = new Logger('PasswordResetRequestComponent');
  private readonly _notificationService = inject(NotificationService);
  private readonly _passwordResetRequestService = inject(PasswordResetRequestService);

  protected override _clearForm() {
    this._form.reset({ email: '' });
  }

  protected async _onSubmit(formValue: NotNullable<PasswordResetRequestComponent['_form']['value']>) {
    try {
      this._isPasswordResetRequestInProgress.set(true);
      this._shouldDisableSubmitButton.set(true);
      this._shouldDisableClearButton.set(true);

      await this._passwordResetRequestService.sendPasswordResetRequest(formValue);

      this._isPasswordResetRequestCreated.set(true);
      this._carousel().nextCarouselItem();
    } catch (error) {
      const errorInfo = getErrorInfo(error);

      this._logger.error('failed to submit password reset request', errorInfo);

      const errorInfoPayload = errorInfo.payload;

      if (errorInfoPayload.code === ExceptionCode.PASSWORD_RESET_NOT_ALLOWED_FOR_OAUTH2_USER) {
        const provider = errorInfoPayload.extra!.provider as string;

        this._notificationService.open({
          autoCloseMs: 30_000,
          // eslint-disable-next-line max-len
          content: $localize`Resetting password is not allowed because you've previously logged in with ${capitalize(provider)} using email <strong>${formValue.email}</strong>.`
        });
      } else {
        this._isPasswordResetRequestCreated.set(false);
        this._carousel().nextCarouselItem();

        this._notificationService.open({
          autoCloseMs: 30_000,
          content: resolveCommonErrorMessage(errorInfo.message)
        });
      }
    } finally {
      this._isPasswordResetRequestInProgress.set(false);
      this._shouldDisableClearButton.set(false);
      this._shouldDisableSubmitButton.set(true);
    }
  }

  protected _findFormControl(controlName: FormControlNameList<PasswordResetRequestComponent['_form']>) {
    return this._form.get(controlName) as FormControl<string>;
  }
}
