/* eslint-disable max-len */
import { Router } from '@angular/router';
import { ExceptionCode } from '@lazycuh/http/src';
import { GlobalStateStore } from '@lazycuh/web-ui-common/state-store';
import { delayBy } from '@lazycuh/web-ui-common/utils/delay-by';
import { RenderResult, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { LITE_MONTHLY_PLAN } from 'test/data';
import {
  assertCalledOnceWith,
  convertToErrorResponsePayload,
  renderComponent,
  startMockingApiRequests
} from 'test/utils';
import { generateAuthenticatedUser } from 'test/utils/generate-authenticated-user';

import { AccountRegistrationRequestComponent } from './account-registration-request.component';

describe(AccountRegistrationRequestComponent.name, () => {
  const TEST_USER_WITH_LITE_MONTHLY_SUBSCRIPTION = generateAuthenticatedUser(LITE_MONTHLY_PLAN);
  const apiRequestMockServer = startMockingApiRequests();

  let renderResult: RenderResult<AccountRegistrationRequestComponent>;

  beforeEach(async () => {
    renderResult = await renderComponent(AccountRegistrationRequestComponent);
  });

  it('Disable "Register" button by default', () => {
    expect(
      renderResult.container.querySelector('button[aria-label="Submit form to create a new account"]')
    ).toBeDisabled();
  });

  it('Disable "Register" button after clicking', async () => {
    apiRequestMockServer.resetHandlers(
      http.post(`${__ORCHESTRATOR_URL__}/v1/users`, async () => {
        await delayBy(64);

        return HttpResponse.json({ payload: TEST_USER_WITH_LITE_MONTHLY_SUBSCRIPTION });
      })
    );

    const user = userEvent.setup();
    await user.type(renderResult.getByLabelText('Display name'), 'Hello World');
    await user.type(renderResult.getByLabelText('Email'), 'helloworld@gmail.com');
    await user.type(renderResult.getByLabelText('Password'), 'HelloWorld2024');

    const submitButton = renderResult.container.querySelector(
      'button[aria-label="Submit form to create a new account"]'
    )!;

    expect(submitButton).toBeEnabled();

    await user.click(submitButton);
    expect(submitButton).toBeDisabled();

    await delayBy(250);
    expect(submitButton).toBeEnabled();
  });

  it('"Clear" button is not disabled when failure happens', async () => {
    apiRequestMockServer.resetHandlers(
      http.post(`${__ORCHESTRATOR_URL__}/v1/users`, () => {
        return HttpResponse.json({ payload: { code: ExceptionCode.UNKNOWN } }, { status: 500 });
      })
    );

    const user = userEvent.setup();
    await user.type(renderResult.getByLabelText('Display name'), 'Hello World');
    await user.type(renderResult.getByLabelText('Email'), 'helloworld@gmail.com');
    await user.type(renderResult.getByLabelText('Password'), 'HelloWorld2024');

    await user.click(renderResult.container.querySelector('button[aria-label="Submit form to create a new account"]')!);

    expect(
      renderResult.container.querySelector('button[aria-label="Clear new account registration form"]')!
    ).toBeEnabled();
  });

  it('Show "Display name is required" when display name is empty', async () => {
    const user = userEvent.setup();

    await user.type(renderResult.getByLabelText('Display name'), 'Hello World');
    await user.click(renderResult.container.querySelector('button[aria-label="Clear Display name form field"]')!);

    expect(renderResult.getByText('Display name is required')).toBeInTheDocument();
  });

  it('Show "Display name must contain at most 32 characters" when display name has more than 32 characters', async () => {
    const user = userEvent.setup();

    await user.type(renderResult.getByLabelText('Display name'), 'a'.repeat(33));
    await user.tab();

    expect(renderResult.getByText('Display name must contain at most 32 characters')).toBeInTheDocument();
  });

  it('Show "Email is required" when email is empty', async () => {
    const user = userEvent.setup();

    await user.type(renderResult.getByLabelText('Email'), 'helloworld@gmail.com');
    await user.click(renderResult.container.querySelector('button[aria-label="Clear Email form field"]')!);

    expect(renderResult.getByText('Email is required')).toBeInTheDocument();
  });

  it('Show "Email must contain at most 64 characters" when email has more than 64 characters', async () => {
    const user = userEvent.setup();

    await user.type(renderResult.getByLabelText('Email'), `${'a'.repeat(64)}@gmail.com`);
    await user.tab();

    expect(renderResult.getByText('Email must contain at most 64 characters')).toBeInTheDocument();
  });

  it('Show "Email is not valid" when email does not have a valid email format', async () => {
    const user = userEvent.setup();

    await user.type(renderResult.getByLabelText('Email'), 'helloworld');
    await user.tab();

    expect(renderResult.getByText('Email is not valid')).toBeInTheDocument();
  });

  it('Enable "Register" button when all form fields are valid', async () => {
    const user = userEvent.setup();

    await user.type(renderResult.getByLabelText('Display name'), 'Hello World');
    await user.type(renderResult.getByLabelText('Email'), 'helloworld@gmail.com');
    await user.type(renderResult.getByLabelText('Password'), 'HelloWorld2024');

    expect(
      renderResult.container.querySelector('button[aria-label="Submit form to create a new account"]')
    ).toBeEnabled();
  });

  it('Clicking "Clear" button clears all form field', async () => {
    const user = userEvent.setup();

    const displayNameField = renderResult.getByLabelText('Display name');
    const emailField = renderResult.getByLabelText('Email');
    const passwordField = renderResult.getByLabelText('Password');

    await user.type(displayNameField, 'Hello World');
    await user.type(emailField, 'helloworld@gmail.com');
    await user.type(passwordField, 'HelloWorld2024');

    const submitButton = renderResult.container.querySelector(
      'button[aria-label="Submit form to create a new account"]'
    )!;

    expect(submitButton).toBeEnabled();

    await user.click(renderResult.container.querySelector('button[aria-label="Clear new account registration form"]')!);

    expect(displayNameField).toHaveValue('');
    expect(emailField).toHaveValue('');
    expect(passwordField).toHaveValue('');

    expect(submitButton).toBeDisabled();
  });

  it('Show notification and error message when a duplicate email is used', async () => {
    apiRequestMockServer.resetHandlers(
      http.post(`${__ORCHESTRATOR_URL__}/v1/users`, () => {
        return HttpResponse.json(convertToErrorResponsePayload({ code: ExceptionCode.RESOURCE_EXISTS }), {
          status: 409
        });
      })
    );

    const user = userEvent.setup();
    await user.type(renderResult.getByLabelText('Display name'), 'Hello World');
    await user.type(renderResult.getByLabelText('Email'), 'helloworld@gmail.com');
    await user.type(renderResult.getByLabelText('Password'), 'HelloWorld2024');

    const submitButton = renderResult.container.querySelector(
      'button[aria-label="Submit form to create a new account"]'
    )!;

    expect(submitButton).toBeEnabled();

    await user.click(submitButton);

    expect(renderResult.getByText('Email is already used by another user')).toBeInTheDocument();
    expect(screen.getByText(/is already associated with another account\./)).toBeInTheDocument();
  });

  it('Show default error message notification when an unhandled failure occurs', async () => {
    apiRequestMockServer.resetHandlers(
      http.post(`${__ORCHESTRATOR_URL__}/v1/users`, () => {
        return HttpResponse.json({ payload: { code: ExceptionCode.UNKNOWN } }, { status: 500 });
      })
    );

    const user = userEvent.setup();
    await user.type(renderResult.getByLabelText('Display name'), 'Hello World');
    await user.type(renderResult.getByLabelText('Email'), 'helloworld@gmail.com');
    await user.type(renderResult.getByLabelText('Password'), 'HelloWorld2024');

    await user.click(renderResult.container.querySelector('button[aria-label="Submit form to create a new account"]')!);

    expect(
      screen.getByText(/An unknown error has occurred while processing your request\. Please try again later\./)
    ).toBeInTheDocument();
    expect(screen.getByText(/If you continue having issues, please contact us\./)).toBeInTheDocument();
  });

  it('Show confirmation after successful registration', async () => {
    apiRequestMockServer.resetHandlers(
      http.post(`${__ORCHESTRATOR_URL__}/v1/users`, () => {
        return HttpResponse.json({ payload: TEST_USER_WITH_LITE_MONTHLY_SUBSCRIPTION });
      })
    );

    const user = userEvent.setup();
    await user.type(renderResult.getByLabelText('Display name'), 'Hello World');
    await user.type(renderResult.getByLabelText('Email'), 'helloworld@gmail.com');
    await user.type(renderResult.getByLabelText('Password'), 'HelloWorld2024');

    await user.click(renderResult.container.querySelector('button[aria-label="Submit form to create a new account"]')!);

    await delayBy(300);

    expect(screen.getByText('Your account registration request has been created')).toBeInTheDocument();
    expect(screen.getByText('Please check your email for further instructions.')).toBeInTheDocument();
    expect(screen.getByText('Go to dashboard')).toHaveAttribute('href', '/my/account');
    expect(screen.getByText('Explore plans')).toHaveAttribute('href', '/pricing');
  });

  it('Navigates to intercepted page after successful login', async () => {
    apiRequestMockServer.resetHandlers(
      http.post(`${__ORCHESTRATOR_URL__}/v1/users`, () => {
        return HttpResponse.json({ payload: TEST_USER_WITH_LITE_MONTHLY_SUBSCRIPTION });
      })
    );

    vi.spyOn(GlobalStateStore.prototype, 'valueOf').mockReturnValue({
      path: '/checkout',
      state: null
    });

    vi.spyOn(GlobalStateStore.prototype, 'update');

    const user = userEvent.setup();
    await user.type(renderResult.getByLabelText('Display name'), 'Hello World');
    await user.type(renderResult.getByLabelText('Email'), 'helloworld@gmail.com');
    await user.type(renderResult.getByLabelText('Password'), 'HelloWorld2024');

    await user.click(renderResult.container.querySelector('button[aria-label="Submit form to create a new account"]')!);

    assertCalledOnceWith(Router.prototype.navigateByUrl, '/checkout', { state: undefined });
    assertCalledOnceWith(
      GlobalStateStore.prototype.update,
      {
        interceptedRoute: { path: '/', state: null }
      },
      { persistent: true }
    );
  });

  it('Navigates to intercepted page with expected router state after successful login', async () => {
    apiRequestMockServer.resetHandlers(
      http.post(`${__ORCHESTRATOR_URL__}/v1/users`, () => {
        return HttpResponse.json({ payload: TEST_USER_WITH_LITE_MONTHLY_SUBSCRIPTION });
      })
    );

    vi.spyOn(GlobalStateStore.prototype, 'valueOf').mockReturnValue({
      path: '/checkout',
      state: { message: 'Hello World' }
    });

    vi.spyOn(GlobalStateStore.prototype, 'update');

    const user = userEvent.setup();
    await user.type(renderResult.getByLabelText('Display name'), 'Hello World');
    await user.type(renderResult.getByLabelText('Email'), 'helloworld@gmail.com');
    await user.type(renderResult.getByLabelText('Password'), 'HelloWorld2024');

    await user.click(renderResult.container.querySelector('button[aria-label="Submit form to create a new account"]')!);

    assertCalledOnceWith(Router.prototype.navigateByUrl, '/checkout', { state: { message: 'Hello World' } });
    assertCalledOnceWith(
      GlobalStateStore.prototype.update,
      {
        interceptedRoute: { path: '/', state: null }
      },
      { persistent: true }
    );
  });

  it('Has consent display', () => {
    expect(screen.getByText('By creating an account, you agree to')).toBeInTheDocument();
  });
});
