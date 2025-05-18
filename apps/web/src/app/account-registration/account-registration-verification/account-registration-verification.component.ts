import { AsyncPipe } from '@angular/common';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  signal,
  viewChild,
  ViewEncapsulation
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, Validators } from '@angular/forms';
import { MatRipple } from '@angular/material/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Logger } from '@lazycuh/logging';
import { UserService, UserStatusReason } from '@lazycuh/web-ui-common/auth';
import { CarouselComponent, CarouselItemComponent } from '@lazycuh/web-ui-common/carousel';
import { slideUp } from '@lazycuh/web-ui-common/effect/slide-up';
import { FocusBoxComponent } from '@lazycuh/web-ui-common/focus-box';
import { DotDotDotComponent } from '@lazycuh/web-ui-common/progress/dot-dot-dot';
import { ProgressCompleteIndicatorComponent } from '@lazycuh/web-ui-common/progress-complete-indicator';
import { getErrorInfo } from '@lazycuh/web-ui-common/utils/get-error-info';

import { TurnstileFormFieldComponent } from '@common/turnstile-form-field';

import { AccountRegistrationVerificationService } from './services';

@Component({
  animations: [
    slideUp({
      duration: '0.75s',
      easingFunction: 'ease',
      from: '125px',
      name: 'focusBox',
      to: '50px'
    })
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'account-registration-verification'
  },
  imports: [
    MatRipple,
    CarouselComponent,
    CarouselItemComponent,
    ProgressCompleteIndicatorComponent,
    RouterLink,
    TurnstileFormFieldComponent,
    DotDotDotComponent,
    FocusBoxComponent,
    AsyncPipe
  ],
  providers: [AccountRegistrationVerificationService],
  selector: 'lc-account-registration-verification',
  styleUrl: './account-registration-verification.component.scss',
  templateUrl: './account-registration-verification.component.html'
})
export class AccountRegistrationVerificationComponent {
  protected readonly _turnstileFormControl = new FormControl('', [Validators.required]);
  protected readonly _verificationResultMessage = signal<string | undefined>(undefined);

  private readonly _carousel = viewChild.required(CarouselComponent);

  constructor() {
    const accountRegistrationVerificationService = inject(AccountRegistrationVerificationService);
    const activatedRoute = inject(ActivatedRoute);
    const destroyRef = inject(DestroyRef);
    const userService = inject(UserService);

    afterNextRender({
      write: () => {
        const code = activatedRoute.snapshot.queryParamMap.get('code');

        if (!code) {
          this._verificationResultMessage.set('verification code is required');
          this._carousel().nextCarouselItem();

          return;
        }

        const verifyAccountRegistrationCode = async () => {
          try {
            await accountRegistrationVerificationService.verifyAccountRegistrationCode(
              code,
              this._turnstileFormControl.value!
            );

            if (userService.isUserAlreadyLoggedIn()) {
              userService.getAuthenticatedUser().status = 'ACTIVE';
              userService.getAuthenticatedUser().statusReason = UserStatusReason.NONE;
            }

            this._verificationResultMessage.set('');
          } catch (error) {
            const errorInfo = getErrorInfo(error);

            new Logger('AccountRegistrationVerificationComponent').error(
              'failed to verify account registration code',
              errorInfo,
              { verificationCode: code }
            );

            this._verificationResultMessage.set(errorInfo.message);
          } finally {
            this._carousel().nextCarouselItem();
          }
        };

        this._turnstileFormControl.statusChanges.pipe(takeUntilDestroyed(destroyRef)).subscribe({
          next: status => {
            /* istanbul ignore if -- @preserve */
            if (status === 'VALID') {
              void verifyAccountRegistrationCode();
            }
          }
        });
      }
    });
  }
}
