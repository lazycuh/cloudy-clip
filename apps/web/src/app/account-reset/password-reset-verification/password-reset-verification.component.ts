import { HttpErrorResponse } from '@angular/common/http';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
  viewChild,
  ViewEncapsulation
} from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { MatRipple } from '@angular/material/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Logger } from '@lazycuh/logging';
import { ActionContainerComponent } from '@lazycuh/web-ui-common/action-container';
import { CarouselComponent, CarouselItemComponent } from '@lazycuh/web-ui-common/carousel';
import { slideUp } from '@lazycuh/web-ui-common/effect/slide-up';
import { FocusBoxComponent } from '@lazycuh/web-ui-common/focus-box';
import { FormComponent } from '@lazycuh/web-ui-common/form/form';
import { PasswordFormFieldComponent } from '@lazycuh/web-ui-common/form/password-form-field';
import { validatePassword } from '@lazycuh/web-ui-common/form/validators';
import { PageWithForm } from '@lazycuh/web-ui-common/page-with-form';
import { ProgressCompleteIndicatorComponent } from '@lazycuh/web-ui-common/progress-complete-indicator';
import { PulseLoaderComponent } from '@lazycuh/web-ui-common/pulse-loader';
import { getErrorInfo } from '@lazycuh/web-ui-common/utils/get-error-info';

import { TurnstileFormFieldComponent } from '@common/turnstile-form-field';

import { PasswordResetVerificationService } from './services';

@Component({
  animations: [
    slideUp({
      duration: '0.75s',
      easingFunction: 'ease',
      from: '15%',
      name: 'focusBox',
      to: '20px'
    })
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'password-reset-verification'
  },
  imports: [
    MatRipple,
    PulseLoaderComponent,
    CarouselComponent,
    CarouselItemComponent,
    ProgressCompleteIndicatorComponent,
    RouterLink,
    TurnstileFormFieldComponent,
    FormComponent,
    PasswordFormFieldComponent,
    FocusBoxComponent,
    ActionContainerComponent
  ],
  providers: [PasswordResetVerificationService],
  selector: 'lc-password-reset-verification',
  styleUrl: './password-reset-verification.component.scss',
  templateUrl: './password-reset-verification.component.html'
})
export class PasswordResetVerificationComponent extends PageWithForm {
  protected readonly _passwordResetResultMessage = signal<string | undefined>(undefined);
  protected readonly _isPasswordChangeRequestInProgress = signal(false);
  protected override readonly _form = new FormGroup({
    password: new FormControl('', [Validators.required, validatePassword]),
    turnstile: new FormControl('', [Validators.required])
  });

  private readonly _passwordResetVerificationService = inject(PasswordResetVerificationService);
  private readonly _carousel = viewChild.required(CarouselComponent);

  private _verificationCode = '';

  constructor() {
    super();

    const activatedRoute = inject(ActivatedRoute);

    afterNextRender({
      write: () => {
        this._verificationCode = activatedRoute.snapshot.queryParamMap.get('code') ?? '';

        if (!this._verificationCode) {
          this._passwordResetResultMessage.set('verification code is required');
          this._carousel().nextCarouselItem();
        }
      }
    });
  }

  protected override _clearForm(): void {
    this._form.reset({ password: '' });
  }

  protected _findFormControl(controlName: FormControlNameList<PasswordResetVerificationComponent['_form']>) {
    return this._form.get(controlName) as FormControl<string>;
  }

  protected async _resetPassword(formValue: NotNullable<PasswordResetVerificationComponent['_form']['value']>) {
    try {
      this._shouldDisableClearButton.set(true);
      this._shouldDisableSubmitButton.set(true);
      this._isPasswordChangeRequestInProgress.set(true);

      await this._passwordResetVerificationService.resetPassword(this._verificationCode, formValue);

      this._passwordResetResultMessage.set('');
    } catch (error) {
      const errorInfo = getErrorInfo(error);

      if ((error as HttpErrorResponse).status === 500) {
        new Logger('PasswordResetVerificationComponent').error('failed to reset password', errorInfo, {
          verificationCode: this._verificationCode
        });
      }

      this._passwordResetResultMessage.set(errorInfo.message);
    } finally {
      this._shouldDisableClearButton.set(false);
      this._shouldDisableSubmitButton.set(true);
      this._isPasswordChangeRequestInProgress.set(false);

      this._carousel().nextCarouselItem();
    }
  }
}
