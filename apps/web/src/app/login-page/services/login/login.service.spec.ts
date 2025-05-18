/* eslint-disable max-len */
import { HttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { ExceptionCode, getAliasFor } from '@lazycuh/http/src';
import { Logger } from '@lazycuh/logging';
import { UserService, UserStatusReason } from '@lazycuh/web-ui-common/auth';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';

import { LITE_MONTHLY_PLAN } from 'test/data';
import {
  assertCalledOnceWith,
  configureTestingModuleForService,
  convertToErrorResponsePayload,
  convertToResponsePayload,
  startMockingApiRequests
} from 'test/utils';
import { generateAuthenticatedUser } from 'test/utils/generate-authenticated-user';

import { LoginService } from './login.service';

describe(LoginService.name, () => {
  const TEST_USER_WITH_LITE_MONTHLY_SUBSCRIPTION = generateAuthenticatedUser(LITE_MONTHLY_PLAN);
  const apiRequestMockServer = startMockingApiRequests();

  let service: LoginService;
  let userService: UserService;

  beforeEach(() => {
    service = configureTestingModuleForService(LoginService);

    userService = TestBed.inject(UserService);
  });

  it('#logInWithEmailPassword() sends expected request body', async () => {
    apiRequestMockServer.resetHandlers(
      http.post(`${__ORCHESTRATOR_URL__}/v1/users/me/sessions`, () => {
        return HttpResponse.json({ payload: TEST_USER_WITH_LITE_MONTHLY_SUBSCRIPTION });
      })
    );

    expect(userService.findAuthenticatedUser().isEmpty()).toEqual(true);

    const payload = { email: 'helloworld@gmail.com', password: 'HelloWorld123', turnstile: 'turnstile' };

    await service.logInWithEmailPassword(payload);

    expect(userService.findAuthenticatedUser().isPresent()).toEqual(true);

    expect(HttpClient.prototype.post).toHaveBeenCalledOnce();
    assertCalledOnceWith(
      HttpClient.prototype.post,
      `${__ORCHESTRATOR_URL__}/v1/users/me/sessions`,
      { email: payload.email, password: payload.password },
      { headers: { [getAliasFor('turnstileTokenHeader')]: payload.turnstile } }
    );
  });

  it('#logInWithEmailPassword() throws error with message "Email or password was incorrect." when login fails and no login attempt tracker is found', async () => {
    apiRequestMockServer.resetHandlers(
      http.post(`${__ORCHESTRATOR_URL__}/v1/users/me/sessions`, () => {
        return HttpResponse.json({ payload: { code: ExceptionCode.INCORRECT_EMAIL_OR_PASSWORD } }, { status: 401 });
      })
    );

    expect(userService.findAuthenticatedUser().isEmpty()).toEqual(true);

    const payload = { email: 'helloworld@gmail.com', password: 'HelloWorld123', turnstile: 'turnstile' };

    await expect(service.logInWithEmailPassword(payload)).rejects.toThrow(
      new Error('Email or password was incorrect.')
    );

    expect(userService.findAuthenticatedUser().isEmpty()).toEqual(true);
  });

  it('#logInWithEmailPassword() throws error with message with current login attempts remaining', async () => {
    apiRequestMockServer.resetHandlers(
      http.post(`${__ORCHESTRATOR_URL__}/v1/users/me/sessions`, () => {
        return HttpResponse.json(
          {
            payload: {
              code: ExceptionCode.INCORRECT_EMAIL_OR_PASSWORD,
              extra: { currentLoginAttempt: 1, maxLoginAttemptsAllowed: 3 }
            }
          },
          { status: 401 }
        );
      })
    );

    expect(userService.findAuthenticatedUser().isEmpty()).toEqual(true);

    const payload = { email: 'helloworld@gmail.com', password: 'HelloWorld123', turnstile: 'turnstile' };

    await expect(service.logInWithEmailPassword(payload)).rejects.toThrow(
      'Email or password was incorrect. Your account will be blocked after 2 attempt(s).'
    );

    expect(userService.findAuthenticatedUser().isEmpty()).toEqual(true);

    apiRequestMockServer.resetHandlers(
      http.post(`${__ORCHESTRATOR_URL__}/v1/users/me/sessions`, () => {
        return HttpResponse.json(
          {
            payload: {
              code: ExceptionCode.INCORRECT_EMAIL_OR_PASSWORD,
              extra: { currentLoginAttempt: 2, maxLoginAttemptsAllowed: 3 }
            }
          },
          { status: 401 }
        );
      })
    );

    await expect(service.logInWithEmailPassword(payload)).rejects.toThrow(
      'Email or password was incorrect. Your account will be blocked after 1 attempt(s).'
    );

    expect(userService.findAuthenticatedUser().isEmpty()).toEqual(true);
  });

  it('#logInWithEmailPassword() throws error with message "Your account has been blocked due to too many failed login attempts." after too many failed login attempts', async () => {
    apiRequestMockServer.resetHandlers(
      http.post(`${__ORCHESTRATOR_URL__}/v1/users/me/sessions`, () => {
        return HttpResponse.json(
          {
            payload: {
              code: ExceptionCode.INCORRECT_EMAIL_OR_PASSWORD,
              extra: { currentLoginAttempt: 3, maxLoginAttemptsAllowed: 3 }
            }
          },
          { status: 401 }
        );
      })
    );

    expect(userService.findAuthenticatedUser().isEmpty()).toEqual(true);

    const payload = { email: 'helloworld@gmail.com', password: 'HelloWorld123', turnstile: 'turnstile' };

    await expect(service.logInWithEmailPassword(payload)).rejects.toThrow(
      new Error('Your account has been blocked due to too many failed login attempts.')
    );

    expect(userService.findAuthenticatedUser().isEmpty()).toEqual(true);
  });

  it('#logInWithEmailPassword() throws error when logging in with an email that has been used for oauth2 login before', async () => {
    apiRequestMockServer.resetHandlers(
      http.post(`${__ORCHESTRATOR_URL__}/v1/users/me/sessions`, () => {
        return HttpResponse.json(
          {
            payload: {
              code: ExceptionCode.EMAIL_PASSWORD_LOGIN_NOT_ALLOWED,
              extra: { email: TEST_USER_WITH_LITE_MONTHLY_SUBSCRIPTION.email, provider: 'GOOGLE' }
            }
          },
          { status: 400 }
        );
      })
    );

    expect(userService.findAuthenticatedUser().isEmpty()).toEqual(true);

    const payload = { email: 'helloworld@gmail.com', password: 'HelloWorld123', turnstile: 'turnstile' };

    await expect(service.logInWithEmailPassword(payload)).rejects.toThrow(
      new Error(
        `You've previously logged in with Google using email <strong>${TEST_USER_WITH_LITE_MONTHLY_SUBSCRIPTION.email}</strong>. Please continue to log in with Google.`
      )
    );

    expect(userService.findAuthenticatedUser().isEmpty()).toEqual(true);
  });

  it('#logInWithEmailPassword() throws error with default error message for unhandled failure', async () => {
    apiRequestMockServer.resetHandlers(
      http.post(`${__ORCHESTRATOR_URL__}/v1/users/me/sessions`, () => {
        return HttpResponse.json(convertToResponsePayload({ code: ExceptionCode.UNKNOWN }, 'expected'), {
          status: 500
        });
      })
    );

    expect(userService.findAuthenticatedUser().isEmpty()).toEqual(true);

    const payload = { email: 'helloworld@gmail.com', password: 'HelloWorld123', turnstile: 'turnstile' };

    await expect(service.logInWithEmailPassword(payload)).rejects.toThrow(
      new Error(
        'An unknown error has occurred while processing your request. Please try again later.<br/><br/>If you continue having issues, please contact us.'
      )
    );

    assertCalledOnceWith(Logger.prototype.error, 'failed to log in with email and password', {
      message: 'expected',
      payload: { code: ExceptionCode.UNKNOWN }
    });

    expect(userService.findAuthenticatedUser().isEmpty()).toEqual(true);
  });

  it('#logInWithEmailPassword() throws error with expected error message when user has been blocked due to unverified email', async () => {
    apiRequestMockServer.resetHandlers(
      http.post(`${__ORCHESTRATOR_URL__}/v1/users/me/sessions`, () => {
        return HttpResponse.json(
          convertToErrorResponsePayload({
            code: ExceptionCode.USER_IS_BLOCKED,
            extra: { gracePeriodInDays: 7, reason: UserStatusReason.UNVERIFIED_EMAIL }
          }),
          { status: 403 }
        );
      })
    );

    expect(userService.findAuthenticatedUser().isEmpty()).toEqual(true);

    const payload = { email: 'helloworld@gmail.com', password: 'HelloWorld123', turnstile: 'turnstile' };

    await expect(service.logInWithEmailPassword(payload)).rejects.toThrow(
      new Error(
        'Your account has been permanently disabled because it has not been verified for more than 7 days. Please contact us to restore access.'
      )
    );

    expect(userService.findAuthenticatedUser().isEmpty()).toEqual(true);
  });

  it('#logInWithEmailPassword() throws error with expected error message when user has been blocked due to too many failed logins', async () => {
    apiRequestMockServer.resetHandlers(
      http.post(`${__ORCHESTRATOR_URL__}/v1/users/me/sessions`, () => {
        return HttpResponse.json(
          convertToErrorResponsePayload({
            code: ExceptionCode.USER_IS_BLOCKED,
            extra: { reason: UserStatusReason.TOO_MANY_FAILED_LOGIN_ATTEMPTS }
          }),
          { status: 403 }
        );
      })
    );

    expect(userService.findAuthenticatedUser().isEmpty()).toEqual(true);

    const payload = { email: 'helloworld@gmail.com', password: 'HelloWorld123', turnstile: 'turnstile' };

    await expect(service.logInWithEmailPassword(payload)).rejects.toThrow(
      new Error(
        'Your account has been blocked due to too many failed login attempts. Please reset your password to restore access.'
      )
    );

    expect(userService.findAuthenticatedUser().isEmpty()).toEqual(true);
  });

  it('#logInWithEmailPassword() throws error with expected error message when user has been blocked but reason is not handled', async () => {
    apiRequestMockServer.resetHandlers(
      http.post(`${__ORCHESTRATOR_URL__}/v1/users/me/sessions`, () => {
        return HttpResponse.json(
          convertToErrorResponsePayload({
            code: ExceptionCode.USER_IS_BLOCKED
          }),
          { status: 403 }
        );
      })
    );

    expect(userService.findAuthenticatedUser().isEmpty()).toEqual(true);

    const payload = { email: 'helloworld@gmail.com', password: 'HelloWorld123', turnstile: 'turnstile' };

    await expect(service.logInWithEmailPassword(payload)).rejects.toThrow(
      new Error('Your account has been blocked. Please contact the administrator to restore access.')
    );

    expect(userService.findAuthenticatedUser().isEmpty()).toEqual(true);
  });

  it('#openGoogleConsentPage() opens Google consent page', async () => {
    const googleConsentPageUrl = 'https://google.com/consent';

    apiRequestMockServer.resetHandlers(
      http.get(`${__ORCHESTRATOR_URL__}/v1/oauth2/google/url`, () => {
        return HttpResponse.json({ payload: googleConsentPageUrl });
      })
    );

    expect(window.location.href).not.toEqual(googleConsentPageUrl);

    await service.openGoogleConsentPage('turnstile');

    assertCalledOnceWith(HttpClient.prototype.get, `${__ORCHESTRATOR_URL__}/v1/oauth2/google/url`, {
      headers: { [getAliasFor('turnstileTokenHeader')]: 'turnstile' }
    });
  });

  it('#logInWithGoogle() calls the right endpoint', async () => {
    window.location.search = '?code=google-code&state=google-state';

    apiRequestMockServer.resetHandlers(
      http.post(`${__ORCHESTRATOR_URL__}/v1/oauth2/google/me/sessions`, ({ request }) => {
        const url = new URL(request.url);

        if (url.searchParams.get('code') !== 'google-code') {
          throw new Error('URL does not contain the expected code');
        }

        if (url.searchParams.get('state') !== 'google-state') {
          throw new Error('URL does not contain the expected state');
        }

        return HttpResponse.json({ payload: TEST_USER_WITH_LITE_MONTHLY_SUBSCRIPTION });
      })
    );

    expect(userService.findAuthenticatedUser().isEmpty()).toEqual(true);

    await service.logInWithGoogle();

    expect(userService.findAuthenticatedUser().isPresent()).toEqual(true);

    assertCalledOnceWith(
      HttpClient.prototype.post,
      `${__ORCHESTRATOR_URL__}/v1/oauth2/google/me/sessions?code=google-code&state=google-state`,
      null
    );
  });

  it('#logInWithGoogle() throws error when logging in with an email that has been used with another oauth2 provided before', async () => {
    apiRequestMockServer.resetHandlers(
      http.post(`${__ORCHESTRATOR_URL__}/v1/oauth2/google/me/sessions`, () => {
        return HttpResponse.json(
          {
            payload: {
              code: ExceptionCode.OAUTH2_LOGIN_NOT_ALLOWED,
              extra: { email: TEST_USER_WITH_LITE_MONTHLY_SUBSCRIPTION.email, provider: 'FACEBOOK' }
            }
          },
          { status: 400 }
        );
      })
    );

    expect(userService.findAuthenticatedUser().isEmpty()).toEqual(true);

    await expect(service.logInWithGoogle()).rejects.toThrow(
      new Error(
        `You've previously logged in with Facebook using email <strong>${TEST_USER_WITH_LITE_MONTHLY_SUBSCRIPTION.email}</strong>. Please continue to log in with Facebook.`
      )
    );

    expect(userService.findAuthenticatedUser().isEmpty()).toEqual(true);
  });

  it('#logInWithGoogle() throws error when logging in with an email that was used to create account before', async () => {
    apiRequestMockServer.resetHandlers(
      http.post(`${__ORCHESTRATOR_URL__}/v1/oauth2/google/me/sessions`, () => {
        return HttpResponse.json(
          {
            payload: {
              code: ExceptionCode.OAUTH2_LOGIN_NOT_ALLOWED,
              extra: { email: TEST_USER_WITH_LITE_MONTHLY_SUBSCRIPTION.email, provider: '' }
            }
          },
          { status: 400 }
        );
      })
    );

    expect(userService.findAuthenticatedUser().isEmpty()).toEqual(true);

    await expect(service.logInWithGoogle()).rejects.toThrow(
      new Error(
        `Logging in with Google using email <strong>${TEST_USER_WITH_LITE_MONTHLY_SUBSCRIPTION.email}</strong> is not allowed. Please ensure that you do not already have an account with the provided email.`
      )
    );

    expect(userService.findAuthenticatedUser().isEmpty()).toEqual(true);
  });

  it('#logInWithGoogle() throws error with default error message for unhandled failure', async () => {
    apiRequestMockServer.resetHandlers(
      http.post(`${__ORCHESTRATOR_URL__}/v1/oauth2/google/me/sessions`, () => {
        return HttpResponse.json(convertToResponsePayload({ code: ExceptionCode.UNKNOWN }, 'expected'), {
          status: 500
        });
      })
    );

    expect(userService.findAuthenticatedUser().isEmpty()).toEqual(true);

    await expect(service.logInWithGoogle()).rejects.toThrow(
      new Error('Unable to log in using your selected Google account. Please try again later.')
    );

    assertCalledOnceWith(Logger.prototype.error, 'failed to log in with google', {
      message: 'expected',
      payload: { code: ExceptionCode.UNKNOWN }
    });

    expect(userService.findAuthenticatedUser().isEmpty()).toEqual(true);
  });

  it('#openFacebookConsentPage() opens facebook consent page', async () => {
    const facebookConsentPageUrl = 'https://facebook.com/consent';

    apiRequestMockServer.resetHandlers(
      http.get(`${__ORCHESTRATOR_URL__}/v1/oauth2/facebook/url`, () => {
        return HttpResponse.json({ payload: facebookConsentPageUrl });
      })
    );

    expect(window.location.href).not.toEqual(facebookConsentPageUrl);

    await service.openFacebookConsentPage('turnstile');

    assertCalledOnceWith(HttpClient.prototype.get, `${__ORCHESTRATOR_URL__}/v1/oauth2/facebook/url`, {
      headers: { [getAliasFor('turnstileTokenHeader')]: 'turnstile' }
    });

    expect(window.location.href).toEqual(facebookConsentPageUrl);
  });

  it('#logInWithFacebook() calls the right endpoint', async () => {
    window.location.search = '?code=facebook-code&state=facebook-state';

    apiRequestMockServer.resetHandlers(
      http.post(`${__ORCHESTRATOR_URL__}/v1/oauth2/facebook/me/sessions`, ({ request }) => {
        const url = new URL(request.url);

        if (url.searchParams.get('code') !== 'facebook-code') {
          throw new Error('URL does not contain the expected code');
        }

        if (url.searchParams.get('state') !== 'facebook-state') {
          throw new Error('URL does not contain the expected state');
        }

        return HttpResponse.json({ payload: TEST_USER_WITH_LITE_MONTHLY_SUBSCRIPTION });
      })
    );

    expect(userService.findAuthenticatedUser().isEmpty()).toEqual(true);

    await service.logInWithFacebook();

    expect(userService.findAuthenticatedUser().isPresent()).toEqual(true);

    assertCalledOnceWith(
      HttpClient.prototype.post,
      `${__ORCHESTRATOR_URL__}/v1/oauth2/facebook/me/sessions?code=facebook-code&state=facebook-state`,
      null
    );
  });

  it('#logInWithFacebook() throws error when logging in with an email that has been used with another oauth2 provided before', async () => {
    apiRequestMockServer.resetHandlers(
      http.post(`${__ORCHESTRATOR_URL__}/v1/oauth2/facebook/me/sessions`, () => {
        return HttpResponse.json(
          {
            payload: {
              code: ExceptionCode.OAUTH2_LOGIN_NOT_ALLOWED,
              extra: { email: TEST_USER_WITH_LITE_MONTHLY_SUBSCRIPTION.email, provider: 'GOOGLE' }
            }
          },
          { status: 400 }
        );
      })
    );

    expect(userService.findAuthenticatedUser().isEmpty()).toEqual(true);

    await expect(service.logInWithFacebook()).rejects.toThrow(
      new Error(
        `You've previously logged in with Google using email <strong>${TEST_USER_WITH_LITE_MONTHLY_SUBSCRIPTION.email}</strong>. Please continue to log in with Google.`
      )
    );

    expect(userService.findAuthenticatedUser().isEmpty()).toEqual(true);
  });

  it('#logInWithFacebook() throws error when logging in with an email that was used to create account before', async () => {
    apiRequestMockServer.resetHandlers(
      http.post(`${__ORCHESTRATOR_URL__}/v1/oauth2/facebook/me/sessions`, () => {
        return HttpResponse.json(
          {
            payload: {
              code: ExceptionCode.OAUTH2_LOGIN_NOT_ALLOWED,
              extra: { email: TEST_USER_WITH_LITE_MONTHLY_SUBSCRIPTION.email, provider: '' }
            }
          },
          { status: 400 }
        );
      })
    );

    expect(userService.findAuthenticatedUser().isEmpty()).toEqual(true);

    await expect(service.logInWithFacebook()).rejects.toThrow(
      new Error(
        `Logging in with Facebook using email <strong>${TEST_USER_WITH_LITE_MONTHLY_SUBSCRIPTION.email}</strong> is not allowed. Please ensure that you do not already have an account with the provided email.`
      )
    );

    expect(userService.findAuthenticatedUser().isEmpty()).toEqual(true);
  });

  it('#logInWithFacebook() throws error with default error message for unhandled failure', async () => {
    apiRequestMockServer.resetHandlers(
      http.post(`${__ORCHESTRATOR_URL__}/v1/oauth2/facebook/me/sessions`, () => {
        return HttpResponse.json(convertToResponsePayload({ code: ExceptionCode.UNKNOWN }, 'expected'), {
          status: 500
        });
      })
    );

    expect(userService.findAuthenticatedUser().isEmpty()).toEqual(true);

    await expect(service.logInWithFacebook()).rejects.toThrow(
      new Error('Unable to log in using your selected Facebook account. Please try again later.')
    );

    assertCalledOnceWith(Logger.prototype.error, 'failed to log in with facebook', {
      message: 'expected',
      payload: { code: ExceptionCode.UNKNOWN }
    });

    expect(userService.findAuthenticatedUser().isEmpty()).toEqual(true);
  });

  it('#openDiscordConsentPage() opens facebook consent page', async () => {
    const consentPageUrl = 'https://discord.com/consent';

    apiRequestMockServer.resetHandlers(
      http.get(`${__ORCHESTRATOR_URL__}/v1/oauth2/discord/url`, () => {
        return HttpResponse.json({ payload: consentPageUrl });
      })
    );

    expect(window.location.href).not.toEqual(consentPageUrl);

    await service.openDiscordConsentPage('turnstile');

    assertCalledOnceWith(HttpClient.prototype.get, `${__ORCHESTRATOR_URL__}/v1/oauth2/discord/url`, {
      headers: { [getAliasFor('turnstileTokenHeader')]: 'turnstile' }
    });

    expect(window.location.href).toEqual(consentPageUrl);
  });

  it('#logInWithDiscord() calls the right endpoint', async () => {
    window.location.search = '?code=discord-code&state=discord-state';

    apiRequestMockServer.resetHandlers(
      http.post(`${__ORCHESTRATOR_URL__}/v1/oauth2/discord/me/sessions`, ({ request }) => {
        const url = new URL(request.url);

        if (url.searchParams.get('code') !== 'discord-code') {
          throw new Error('URL does not contain the expected code');
        }

        if (url.searchParams.get('state') !== 'discord-state') {
          throw new Error('URL does not contain the expected state');
        }

        return HttpResponse.json({ payload: TEST_USER_WITH_LITE_MONTHLY_SUBSCRIPTION });
      })
    );

    expect(userService.findAuthenticatedUser().isEmpty()).toEqual(true);

    await service.logInWithDiscord();

    expect(userService.findAuthenticatedUser().isPresent()).toEqual(true);

    assertCalledOnceWith(
      HttpClient.prototype.post,
      `${__ORCHESTRATOR_URL__}/v1/oauth2/discord/me/sessions?code=discord-code&state=discord-state`,
      null
    );
  });

  it('#logInWithDiscord() throws error when logging in with an email that has been used with another oauth2 provided before', async () => {
    apiRequestMockServer.resetHandlers(
      http.post(`${__ORCHESTRATOR_URL__}/v1/oauth2/discord/me/sessions`, () => {
        return HttpResponse.json(
          {
            payload: {
              code: ExceptionCode.OAUTH2_LOGIN_NOT_ALLOWED,
              extra: { email: TEST_USER_WITH_LITE_MONTHLY_SUBSCRIPTION.email, provider: 'GOOGLE' }
            }
          },
          { status: 400 }
        );
      })
    );

    expect(userService.findAuthenticatedUser().isEmpty()).toEqual(true);

    await expect(service.logInWithDiscord()).rejects.toThrow(
      new Error(
        `You've previously logged in with Google using email <strong>${TEST_USER_WITH_LITE_MONTHLY_SUBSCRIPTION.email}</strong>. Please continue to log in with Google.`
      )
    );

    expect(userService.findAuthenticatedUser().isEmpty()).toEqual(true);
  });

  it('#logInWithDiscord() throws error when logging in with an email that was used to create account before', async () => {
    apiRequestMockServer.resetHandlers(
      http.post(`${__ORCHESTRATOR_URL__}/v1/oauth2/discord/me/sessions`, () => {
        return HttpResponse.json(
          {
            payload: {
              code: ExceptionCode.OAUTH2_LOGIN_NOT_ALLOWED,
              extra: { email: TEST_USER_WITH_LITE_MONTHLY_SUBSCRIPTION.email, provider: '' }
            }
          },
          { status: 400 }
        );
      })
    );

    expect(userService.findAuthenticatedUser().isEmpty()).toEqual(true);

    await expect(service.logInWithDiscord()).rejects.toThrow(
      new Error(
        `Logging in with Discord using email <strong>${TEST_USER_WITH_LITE_MONTHLY_SUBSCRIPTION.email}</strong> is not allowed. Please ensure that you do not already have an account with the provided email.`
      )
    );

    expect(userService.findAuthenticatedUser().isEmpty()).toEqual(true);
  });

  it('#logInWithDiscord() throws error with default error message for unhandled failure', async () => {
    apiRequestMockServer.resetHandlers(
      http.post(`${__ORCHESTRATOR_URL__}/v1/oauth2/discord/me/sessions`, () => {
        return HttpResponse.json(convertToResponsePayload({ code: ExceptionCode.UNKNOWN }, 'expected'), {
          status: 500
        });
      })
    );

    expect(userService.findAuthenticatedUser().isEmpty()).toEqual(true);

    await expect(service.logInWithDiscord()).rejects.toThrow(
      new Error('Unable to log in using your selected Discord account. Please try again later.')
    );

    assertCalledOnceWith(Logger.prototype.error, 'failed to log in with discord', {
      message: 'expected',
      payload: { code: ExceptionCode.UNKNOWN }
    });

    expect(userService.findAuthenticatedUser().isEmpty()).toEqual(true);
  });
});
