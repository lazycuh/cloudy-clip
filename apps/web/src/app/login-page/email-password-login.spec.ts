import { Router } from '@angular/router';
import { ExceptionCode } from '@lazycuh/http';
import { GlobalStateStore } from '@lazycuh/web-ui-common/state-store';
import { delayBy } from '@lazycuh/web-ui-common/utils/delay-by';
import { screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { LITE_MONTHLY_PLAN } from 'test/data';
import { assertCalledOnceWith, renderComponent, startMockingApiRequests } from 'test/utils';
import { generateAuthenticatedUser } from 'test/utils/generate-authenticated-user';

import { LoginPageComponent } from './login-page.component';

describe('Login with email/password', () => {
  const TEST_USER_WITH_LITE_MONTHLY_SUBSCRIPTION = generateAuthenticatedUser(LITE_MONTHLY_PLAN);
  const apiRequestMockServer = startMockingApiRequests();

  async function loginWithEmailPassword(response: ReturnType<typeof HttpResponse.json>) {
    apiRequestMockServer.resetHandlers(
      http.post(`${__ORCHESTRATOR_URL__}/v1/users/me/sessions`, () => {
        return response;
      })
    );

    const renderResult = await renderComponent(LoginPageComponent, { providers: [] });

    const user = userEvent.setup();
    await user.type(renderResult.getByLabelText('Email'), TEST_USER_WITH_LITE_MONTHLY_SUBSCRIPTION.email);
    await user.type(renderResult.getByLabelText('Password'), 'Password123');

    await user.click(renderResult.container.querySelector('[aria-label="Submit form to log in"]')!);

    return renderResult;
  }

  it('Disables "Log in" button if email is not valid', async () => {
    const renderResult = await renderComponent(LoginPageComponent);

    const loginButton = renderResult.container.querySelector('[aria-label="Submit form to log in"]');
    expect(loginButton).toBeDisabled();

    const emailInput = renderResult.getByLabelText('Email');

    const user = userEvent.setup();
    await user.type(emailInput, 'good-email@gmail.com');
    await user.type(renderResult.getByLabelText('Password'), 'Password123');

    expect(loginButton).toBeEnabled();

    await user.clear(emailInput);
    await user.type(emailInput, 'invalid-email');

    expect(loginButton).toBeDisabled();
    expect(renderResult.getByText('Email is not valid')).toBeInTheDocument();
  });

  it('Disables "Log in" button if email is empty', async () => {
    const renderResult = await renderComponent(LoginPageComponent);

    const loginButton = renderResult.container.querySelector('[aria-label="Submit form to log in"]');
    expect(loginButton).toBeDisabled();

    const emailInput = renderResult.getByLabelText('Email');

    const user = userEvent.setup();
    await user.type(emailInput, 'good-email@gmail.com');
    await user.type(renderResult.getByLabelText('Password'), 'Password123');

    expect(loginButton).toBeEnabled();

    await user.clear(emailInput);

    expect(loginButton).toBeDisabled();
    expect(renderResult.getByText('Email is required')).toBeInTheDocument();
  });

  it('Disables "Log in" button if email has more than 64 characters', async () => {
    const renderResult = await renderComponent(LoginPageComponent);

    const loginButton = renderResult.container.querySelector('[aria-label="Submit form to log in"]');
    expect(loginButton).toBeDisabled();

    const emailInput = renderResult.getByLabelText('Email');

    const user = userEvent.setup();
    await user.type(emailInput, 'good-email@gmail.com');
    await user.type(renderResult.getByLabelText('Password'), 'Password123');

    expect(loginButton).toBeEnabled();

    await user.clear(emailInput);

    await user.type(emailInput, `${'a'.repeat(60)}@gmail.com`);
    await user.tab();

    expect(loginButton).toBeDisabled();
    expect(renderResult.getByText('Email must contain at most 64 characters')).toBeInTheDocument();
  });

  it('Disables "Log in" button if password is empty', async () => {
    const renderResult = await renderComponent(LoginPageComponent);

    const loginButton = renderResult.container.querySelector('[aria-label="Submit form to log in"]');
    expect(loginButton).toBeDisabled();

    const passwordInput = renderResult.getByLabelText('Password');

    const user = userEvent.setup();
    await user.type(renderResult.getByLabelText('Email'), 'good-email@gmail.com');
    await user.type(passwordInput, 'Password123');

    expect(loginButton).toBeEnabled();

    await user.clear(passwordInput);
    await user.tab();

    expect(loginButton).toBeDisabled();
    expect(renderResult.getByText('Password is required')).toBeInTheDocument();
  });

  it('Disables "Log in" button if password has more than 64 characters', async () => {
    const renderResult = await renderComponent(LoginPageComponent);

    const loginButton = renderResult.container.querySelector('[aria-label="Submit form to log in"]');
    expect(loginButton).toBeDisabled();

    const passwordInput = renderResult.getByLabelText('Password');

    const user = userEvent.setup();
    await user.type(renderResult.getByLabelText('Email'), 'good-email@gmail.com');
    await user.type(passwordInput, 'Password123');

    expect(loginButton).toBeEnabled();

    await user.clear(passwordInput);
    await user.type(passwordInput, 'a'.repeat(65));
    await user.tab();

    expect(loginButton).toBeDisabled();
    expect(renderResult.getByText('Password must contain at most 64 characters')).toBeInTheDocument();
  });

  it('Clear email and password fields when "Clear" button is clicked', async () => {
    const renderResult = await renderComponent(LoginPageComponent);

    const loginButton = renderResult.container.querySelector('[aria-label="Submit form to log in"]');
    expect(loginButton).toBeDisabled();

    const user = userEvent.setup();
    await user.type(renderResult.getByLabelText('Email'), 'good-email@gmail.com');
    await user.type(renderResult.getByLabelText('Password'), 'Password123');

    expect(loginButton).toBeEnabled();

    await user.click(renderResult.getByText('Clear'));

    expect(loginButton).toBeDisabled();
    expect(renderResult.getByText('Clear')).toBeDisabled();
    expect(renderResult.queryByDisplayValue('good-email@gmail.com')).not.toBeInTheDocument();
    expect(renderResult.queryByDisplayValue('Password123')).not.toBeInTheDocument();
  });

  it('Submits login form and disables "Log in" button', async () => {
    apiRequestMockServer.resetHandlers(
      http.post(`${__ORCHESTRATOR_URL__}/v1/users/me/sessions`, async () => {
        await delayBy(64);

        return HttpResponse.json({ payload: TEST_USER_WITH_LITE_MONTHLY_SUBSCRIPTION });
      })
    );

    const renderResult = await renderComponent(LoginPageComponent);

    const loginButton = renderResult.container.querySelector('[aria-label="Submit form to log in"]')!;
    expect(loginButton).toBeDisabled();

    const user = userEvent.setup();
    await user.type(renderResult.getByLabelText('Email'), 'good-email@gmail.com');
    await user.type(renderResult.getByLabelText('Password'), 'Password123');

    await user.click(loginButton);

    expect(loginButton).toBeDisabled();

    await delayBy(250);
    expect(loginButton).toBeEnabled();
  });

  it('Navigate to /my/account page after successful login and there is no intercepted page', async () => {
    await loginWithEmailPassword(HttpResponse.json({ payload: TEST_USER_WITH_LITE_MONTHLY_SUBSCRIPTION }));

    assertCalledOnceWith(Router.prototype.navigateByUrl, '/my/account');
  });

  it('Navigate to intercepted page after successful login', async () => {
    apiRequestMockServer.resetHandlers(
      http.post(`${__ORCHESTRATOR_URL__}/v1/users/me/sessions`, () => {
        return HttpResponse.json({ payload: TEST_USER_WITH_LITE_MONTHLY_SUBSCRIPTION });
      })
    );

    const interceptedRoutePath = '/my/billing';

    const renderResult = await renderComponent(LoginPageComponent);

    renderResult.fixture.debugElement.injector
      .get(GlobalStateStore)
      .update({ interceptedRoute: { path: interceptedRoutePath, state: null } });

    const user = userEvent.setup();
    await user.type(renderResult.getByLabelText('Email'), 'good-email@gmail.com');
    await user.type(renderResult.getByLabelText('Password'), 'Password123');

    await user.click(renderResult.container.querySelector('[aria-label="Submit form to log in"]')!);

    assertCalledOnceWith(Router.prototype.navigateByUrl, interceptedRoutePath, {
      state: undefined
    });
  });

  it('Show error notification when login fails', async () => {
    await loginWithEmailPassword(
      HttpResponse.json({ payload: { code: ExceptionCode.INCORRECT_EMAIL_OR_PASSWORD } }, { status: 401 })
    );

    expect(screen.getByText('Email or password was incorrect.')).toBeInTheDocument();
  });
});
