import { Router } from '@angular/router';
import { ExceptionCode } from '@lazycuh/http';
import { Logger } from '@lazycuh/logging';
import { Oauth2Provider } from '@lazycuh/web-ui-common/auth';
import { ProgressService } from '@lazycuh/web-ui-common/progress';
import { GlobalStateStore } from '@lazycuh/web-ui-common/state-store';
import { delayBy } from '@lazycuh/web-ui-common/utils/delay-by';
import { screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';

import { LITE_MONTHLY_PLAN } from 'test/data';
import { assertCalledOnceWith, convertToResponsePayload, renderComponent, startMockingApiRequests } from 'test/utils';
import { generateAuthenticatedUser } from 'test/utils/generate-authenticated-user';

import { LoginPageComponent } from './login-page.component';

describe('Discord login', () => {
  const TEST_USER_WITH_LITE_MONTHLY_SUBSCRIPTION = generateAuthenticatedUser(LITE_MONTHLY_PLAN);
  const apiRequestMockServer = startMockingApiRequests();

  async function logInWithOauth2Provider(
    provider: Exclude<Oauth2Provider, ''>,
    response: ReturnType<typeof HttpResponse.json>
  ) {
    apiRequestMockServer.resetHandlers(
      http.post(`${__ORCHESTRATOR_URL__}/v1/oauth2/${provider.toLowerCase()}/me/sessions`, () => {
        return response;
      })
    );

    return renderComponent(LoginPageComponent, { providers: [] });
  }

  it('Disables discord login button after clicking it', async () => {
    apiRequestMockServer.resetHandlers(
      http.get(`${__ORCHESTRATOR_URL__}/v1/oauth2/discord/url`, () => {
        return HttpResponse.json(convertToResponsePayload(TEST_USER_WITH_LITE_MONTHLY_SUBSCRIPTION));
      })
    );

    const renderResult = await renderComponent(LoginPageComponent);

    const loginButton = renderResult.container.querySelector('[aria-label="Log in with Discord"]')!;
    expect(loginButton).toBeEnabled();

    const user = userEvent.setup();
    await user.click(loginButton);

    expect(loginButton).toBeDisabled();
  });

  it('Shows a notification with default message when opening consent page fails', async () => {
    apiRequestMockServer.resetHandlers(
      http.get(`${__ORCHESTRATOR_URL__}/v1/oauth2/discord/url`, async () => {
        await delayBy(64);

        return HttpResponse.json(convertToResponsePayload({ code: ExceptionCode.UNKNOWN }, 'expected'), {
          status: 500
        });
      })
    );

    const renderResult = await renderComponent(LoginPageComponent);

    const user = userEvent.setup();

    const loginButton = renderResult.container.querySelector('[aria-label="Log in with Discord"]')!;
    expect(loginButton).toBeEnabled();

    await user.click(loginButton);
    expect(loginButton).toBeDisabled();

    await delayBy(250);

    expect(ProgressService.prototype.openIndeterminateProgressIndicator).toHaveBeenCalledOnce();
    expect(loginButton).toBeEnabled();

    expect(
      screen.getByText('There was an unknown error trying to redirect to Discord. Please try again later.')
    ).toBeInTheDocument();

    expect(ProgressService.prototype.close).toHaveBeenCalledOnce();

    assertCalledOnceWith(Logger.prototype.error, 'failed to open discord consent page', {
      message: 'expected',
      payload: {
        code: ExceptionCode.UNKNOWN
      }
    });
  });

  it('Navigates to /my/account page after successful login and there is no intercepted page', async () => {
    vi.stubGlobal('location', {
      pathname: '/discord',
      search: '?state=state&code=code'
    });

    await logInWithOauth2Provider('DISCORD', HttpResponse.json({ payload: TEST_USER_WITH_LITE_MONTHLY_SUBSCRIPTION }));

    assertCalledOnceWith(Router.prototype.navigateByUrl, '/my/account');
  });

  it('Navigates to intercepted page after successful login', async () => {
    vi.stubGlobal('location', {
      pathname: '/discord',
      search: '?state=state&code=code'
    });

    const interceptedRoutePath = '/my/billing';

    vi.spyOn(GlobalStateStore.prototype, 'valueOf').mockImplementation(() => {
      return { path: interceptedRoutePath, state: null };
    });

    await logInWithOauth2Provider('DISCORD', HttpResponse.json({ payload: TEST_USER_WITH_LITE_MONTHLY_SUBSCRIPTION }));

    await delayBy(500);

    assertCalledOnceWith(Router.prototype.navigateByUrl, interceptedRoutePath, { state: undefined });
  });

  it('Shows error notification when login fails with an unhandled error', async () => {
    await logInWithOauth2Provider(
      'DISCORD',
      HttpResponse.json(convertToResponsePayload({ code: ExceptionCode.UNKNOWN }, 'expected'), { status: 500 })
    );

    expect(
      screen.getByText('Unable to log in using your selected Discord account. Please try again later.')
    ).toBeInTheDocument();
  });
});
