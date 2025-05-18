import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  signal,
  ViewEncapsulation
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, StatusChangeEvent, Validators } from '@angular/forms';
import { MatRipple } from '@angular/material/core';
import { Router, RouterLink } from '@angular/router';
import { NotificationService } from '@lazycuh/angular-notification';
import { Logger } from '@lazycuh/logging';
import { ActionContainerComponent } from '@lazycuh/web-ui-common/action-container';
import { Oauth2Provider, UserService } from '@lazycuh/web-ui-common/auth';
import { slideUp } from '@lazycuh/web-ui-common/effect/slide-up';
import { FocusBoxComponent } from '@lazycuh/web-ui-common/focus-box';
import { FormComponent } from '@lazycuh/web-ui-common/form/form';
import { PasswordFormFieldComponent } from '@lazycuh/web-ui-common/form/password-form-field';
import { ShortTextFormFieldComponent } from '@lazycuh/web-ui-common/form/short-text-form-field';
import { PageWithForm } from '@lazycuh/web-ui-common/page-with-form';
import { ProgressService } from '@lazycuh/web-ui-common/progress';
import { PulseLoaderComponent } from '@lazycuh/web-ui-common/pulse-loader';
import { GlobalStateStore } from '@lazycuh/web-ui-common/state-store';
import { getErrorInfo } from '@lazycuh/web-ui-common/utils/get-error-info';

import { ConsentDisplayComponent } from '@common/consent-display';
import { TurnstileFormFieldComponent } from '@common/turnstile-form-field';

import { LoginService } from './services/login';

@Component({
  animations: [
    slideUp({
      duration: '1s',
      easingFunction: 'cubic-bezier(0.04, 0.54, 0.25, 1)',
      from: '-10%',
      name: 'focusBox',
      to: '0'
    })
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'login-page'
  },
  imports: [
    FormComponent,
    ShortTextFormFieldComponent,
    PasswordFormFieldComponent,
    MatRipple,
    RouterLink,
    PulseLoaderComponent,
    TurnstileFormFieldComponent,
    FocusBoxComponent,
    ActionContainerComponent,
    ConsentDisplayComponent
  ],
  providers: [LoginService],
  selector: 'lc-login-page',
  styleUrl: './login-page.component.scss',
  templateUrl: './login-page.component.html'
})
export class LoginPageComponent extends PageWithForm {
  protected override readonly _form = new FormGroup({
    email: new FormControl('', [Validators.required, Validators.email, Validators.maxLength(64)]),
    password: new FormControl('', [Validators.required, Validators.maxLength(64)]),
    turnstile: new FormControl('', [Validators.required])
  });

  protected readonly _isLoginRequestInProgress = signal(false);
  protected readonly _isGoogleLoginRequestInProgress = signal(false);
  protected readonly _isFacebookLoginRequestInProgress = signal(false);
  protected readonly _isDiscordLoginRequestInProgress = signal(false);
  protected readonly _isTurnstileTokenReady = signal(false);

  private readonly _logger = new Logger('LoginPageComponent');
  private readonly _loginService = inject(LoginService);
  private readonly _userService = inject(UserService);
  private readonly _notificationService = inject(NotificationService);
  private readonly _progressService = inject(ProgressService);
  private readonly _router = inject(Router);
  private readonly _globalStateStore = inject(GlobalStateStore);

  constructor() {
    super();

    const destroyRef = inject(DestroyRef);

    afterNextRender({
      write: () => {
        if (this._userService.isUserAlreadyLoggedIn()) {
          void this._router.navigateByUrl('/my/account');

          return;
        }

        this._findFormControl('turnstile')
          .events.pipe(takeUntilDestroyed(destroyRef))
          .subscribe({
            next: event => {
              if (event instanceof StatusChangeEvent) {
                this._isTurnstileTokenReady.set(event.status === 'VALID');
              }
            }
          });

        if (this._isRedirectedFrom('GOOGLE')) {
          void this._signInWithGoogle();
        } else if (this._isRedirectedFrom('FACEBOOK')) {
          void this._signInWithFacebook();
        } else if (this._isRedirectedFrom('DISCORD')) {
          void this._signInWithDiscord();
        }
      }
    });
  }

  protected override _clearForm(): void {
    this._form.reset({
      email: '',
      password: ''
    });
  }

  protected _findFormControl(controlName: FormControlNameList<LoginPageComponent['_form']>) {
    return this._form.get(controlName) as FormControl<string>;
  }

  private _isRedirectedFrom(provider: Oauth2Provider) {
    return (
      window.location.pathname.endsWith(`/${provider.toLowerCase()}`) &&
      window.location.search.includes('code=') &&
      window.location.search.includes('state=')
    );
  }

  private async _signInWithGoogle() {
    try {
      void this._progressService.openIndeterminateProgressIndicator();
      await this._loginService.logInWithGoogle();
      await this._handleLoginSuccess();
    } catch (error) {
      this._handleLoginError(error);
    } finally {
      this._progressService.close();
    }
  }

  private async _handleLoginSuccess() {
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
      await this._router.navigateByUrl('/my/account');
    }
  }

  private _handleLoginError(error: unknown) {
    this._notificationService.open({
      content: getErrorInfo(error).message
    });
  }

  private async _signInWithFacebook() {
    try {
      void this._progressService.openIndeterminateProgressIndicator();
      await this._loginService.logInWithFacebook();
      await this._handleLoginSuccess();
    } catch (error) {
      this._handleLoginError(error);
    } finally {
      this._progressService.close();
    }
  }

  private async _signInWithDiscord() {
    try {
      void this._progressService.openIndeterminateProgressIndicator();
      await this._loginService.logInWithDiscord();
      await this._handleLoginSuccess();
    } catch (error) {
      this._handleLoginError(error);
    } finally {
      this._progressService.close();
    }
  }

  protected async _onSubmit(formValue: NotNullable<LoginPageComponent['_form']['value']>) {
    try {
      this._isLoginRequestInProgress.set(true);
      this._shouldDisableSubmitButton.set(true);
      this._shouldDisableClearButton.set(true);

      await this._loginService.logInWithEmailPassword(formValue);
      await this._handleLoginSuccess();
    } catch (error) {
      this._handleLoginError(error);
    } finally {
      this._isLoginRequestInProgress.set(false);
      this._shouldDisableClearButton.set(false);
      this._shouldDisableSubmitButton.set(false);
    }
  }

  protected async _openDiscordConsentPage() {
    try {
      void this._progressService.openIndeterminateProgressIndicator();

      this._isDiscordLoginRequestInProgress.set(true);

      await this._loginService.openDiscordConsentPage(this._findFormControl('turnstile').value);
    } catch (error) {
      this._isDiscordLoginRequestInProgress.set(false);
      this._progressService.close();

      this._logger.error('failed to open discord consent page', getErrorInfo(error));

      this._notificationService.open({
        content: $localize`There was an unknown error trying to redirect to Discord. Please try again later.`
      });
    }
  }

  protected async _openFacebookConsentPage() {
    try {
      void this._progressService.openIndeterminateProgressIndicator();

      this._isFacebookLoginRequestInProgress.set(true);

      await this._loginService.openFacebookConsentPage(this._findFormControl('turnstile').value);
    } catch (error) {
      this._isFacebookLoginRequestInProgress.set(false);
      this._progressService.close();

      this._logger.error('failed to open facebook consent page', getErrorInfo(error));

      this._notificationService.open({
        content: $localize`There was an unknown error trying to redirect to Facebook. Please try again later.`
      });
    }
  }

  protected async _openGoogleConsentPage() {
    try {
      void this._progressService.openIndeterminateProgressIndicator();

      this._isGoogleLoginRequestInProgress.set(true);

      await this._loginService.openGoogleConsentPage(this._findFormControl('turnstile').value);
    } catch (error) {
      this._isGoogleLoginRequestInProgress.set(false);
      this._progressService.close();

      this._logger.error('failed to open google consent page', getErrorInfo(error));

      this._notificationService.open({
        content: $localize`There was an unknown error trying to redirect to Google. Please try again later.`
      });
    }
  }
}
