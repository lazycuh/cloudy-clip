import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { ExceptionCode, ExceptionPayload, getAliasFor, ResponseBody } from '@lazycuh/http';
import { Logger } from '@lazycuh/logging';
import { AuthenticatedUser, Oauth2Provider, UserService, UserStatusReason } from '@lazycuh/web-ui-common/auth';
import { capitalize } from '@lazycuh/web-ui-common/capitalize';
import { getErrorInfo } from '@lazycuh/web-ui-common/utils/get-error-info';
import { catchError, firstValueFrom } from 'rxjs';

import { resolveCommonErrorMessage } from '@common/resolve-common-error-message';

@Injectable()
export class LoginService {
  private readonly _httpClient = inject(HttpClient);
  private readonly _userService = inject(UserService);
  private readonly _logger = new Logger('LoginService');

  async logInWithEmailPassword(payload: { email: string; password: string; turnstile: string }) {
    const { turnstile, ...requestPayload } = payload;

    const responseBody = await firstValueFrom(
      this._httpClient
        .post<ResponseBody<AuthenticatedUser>>(`${__ORCHESTRATOR_URL__}/v1/users/me/sessions`, requestPayload, {
          headers: { [getAliasFor('turnstileTokenHeader')]: turnstile }
        })
        .pipe(
          catchError(error => {
            throw new Error(this._resolveEmailLoginErrorMessage(getErrorInfo(error)));
          })
        )
    );

    this._userService.updateAuthenticatedUser(responseBody.payload);
  }

  private _resolveEmailLoginErrorMessage(errorInfo: ResponseBody<ExceptionPayload>) {
    const errorInfoPayload = errorInfo.payload;

    if (errorInfoPayload.code === ExceptionCode.INCORRECT_EMAIL_OR_PASSWORD) {
      const currentLoginAttempt = errorInfoPayload.extra?.currentLoginAttempt as number | undefined;
      const maxAllowedLoginAttempts = errorInfoPayload.extra?.maxLoginAttemptsAllowed as number | undefined;

      if (currentLoginAttempt === undefined || maxAllowedLoginAttempts === undefined) {
        return $localize`Email or password was incorrect.`;
      }

      const remainingAttempts = maxAllowedLoginAttempts - currentLoginAttempt;

      return remainingAttempts > 0
        ? // eslint-disable-next-line max-len
          $localize`Email or password was incorrect. Your account will be blocked after ${remainingAttempts} attempt(s).`
        : $localize`Your account has been blocked due to too many failed login attempts.`;
    } else if (errorInfoPayload.code === ExceptionCode.USER_IS_BLOCKED) {
      // eslint-disable-next-line @typescript-eslint/switch-exhaustiveness-check
      switch (errorInfoPayload.extra?.reason) {
        case UserStatusReason.UNVERIFIED_EMAIL:
          // eslint-disable-next-line max-len
          return $localize`Your account has been permanently disabled because it has not been verified for more than ${errorInfoPayload.extra.gracePeriodInDays} days. Please contact us to restore access.`;

        case UserStatusReason.TOO_MANY_FAILED_LOGIN_ATTEMPTS:
          // eslint-disable-next-line max-len
          return $localize`Your account has been blocked due to too many failed login attempts. Please reset your password to restore access.`;
      }

      return $localize`Your account has been blocked. Please contact the administrator to restore access.`;
    } else if (errorInfoPayload.code === ExceptionCode.EMAIL_PASSWORD_LOGIN_NOT_ALLOWED) {
      const provider = capitalize((errorInfoPayload.extra?.provider ?? '') as Oauth2Provider);
      const email = errorInfoPayload.extra?.email as string;

      return resolveCommonErrorMessage(
        errorInfo.message,
        // eslint-disable-next-line max-len
        $localize`You've previously logged in with ${provider} using email <strong>${email}</strong>. Please continue to log in with ${provider}.`
      );
    }

    this._logger.error('failed to log in with email and password', errorInfo);

    return resolveCommonErrorMessage(errorInfo.message);
  }

  async openGoogleConsentPage(turnstile: string) {
    const responseBody = await firstValueFrom(
      this._httpClient.get<ResponseBody<string>>(`${__ORCHESTRATOR_URL__}/v1/oauth2/google/url`, {
        headers: { [getAliasFor('turnstileTokenHeader')]: turnstile }
      })
    );

    window.location.href = responseBody.payload;
  }

  async logInWithGoogle() {
    return this._loginWithOauth2Provider('GOOGLE');
  }

  private async _loginWithOauth2Provider(provider: Oauth2Provider) {
    const url = `${__ORCHESTRATOR_URL__}/v1/oauth2/${provider.toLowerCase()}/me/sessions${window.location.search}`;
    const responseBody = await firstValueFrom(
      this._httpClient.post<ResponseBody<AuthenticatedUser>>(url, null).pipe(
        catchError(error => {
          throw new Error(this._resolveOauth2LoginErrorMessage(getErrorInfo(error), provider));
        })
      )
    );

    this._userService.updateAuthenticatedUser(responseBody.payload);
  }

  private _resolveOauth2LoginErrorMessage(
    errorInfo: ResponseBody<ExceptionPayload>,
    selectedOauth2Provider: Oauth2Provider
  ) {
    /* istanbul ignore if -- @preserve */
    if (selectedOauth2Provider === '') {
      throw new Error('Selected oauth2 provider is required');
    }

    const errorInfoPayload = errorInfo.payload;

    if (errorInfoPayload.code !== ExceptionCode.OAUTH2_LOGIN_NOT_ALLOWED) {
      this._logger.error(`failed to log in with ${selectedOauth2Provider.toLowerCase()}`, errorInfo);

      return resolveCommonErrorMessage(
        errorInfo.message,
        // eslint-disable-next-line max-len
        $localize`Unable to log in using your selected ${capitalize(selectedOauth2Provider)} account. Please try again later.`
      );
    }

    const currentProvider = capitalize((errorInfoPayload.extra?.provider ?? '') as Oauth2Provider);
    const email = errorInfoPayload.extra?.email as string;

    if (currentProvider !== '') {
      // eslint-disable-next-line max-len
      return $localize`You've previously logged in with ${currentProvider} using email <strong>${email}</strong>. Please continue to log in with ${currentProvider}.`;
    }

    // eslint-disable-next-line max-len
    return $localize`Logging in with ${capitalize(selectedOauth2Provider)} using email <strong>${email}</strong> is not allowed. Please ensure that you do not already have an account with the provided email.`;
  }

  async openFacebookConsentPage(turnstile: string) {
    const responseBody = await firstValueFrom(
      this._httpClient.get<ResponseBody<string>>(`${__ORCHESTRATOR_URL__}/v1/oauth2/facebook/url`, {
        headers: { [getAliasFor('turnstileTokenHeader')]: turnstile }
      })
    );

    window.location.href = responseBody.payload;
  }

  async logInWithFacebook() {
    return this._loginWithOauth2Provider('FACEBOOK');
  }

  async openDiscordConsentPage(turnstile: string) {
    const responseBody = await firstValueFrom(
      this._httpClient.get<ResponseBody<string>>(`${__ORCHESTRATOR_URL__}/v1/oauth2/discord/url`, {
        headers: { [getAliasFor('turnstileTokenHeader')]: turnstile }
      })
    );

    window.location.href = responseBody.payload;
  }

  async logInWithDiscord() {
    return this._loginWithOauth2Provider('DISCORD');
  }
}
