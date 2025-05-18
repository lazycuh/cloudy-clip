import { HttpClient } from '@angular/common/http';
import { ExceptionCode, getAliasFor } from '@lazycuh/http/src';
import { screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { assertCalledOnceWith, renderComponent, startMockingApiRequests } from 'test/utils';
import { generateAuthenticatedUser } from 'test/utils/generate-authenticated-user';

import { PasswordResetRequestComponent } from './password-reset-request.component';

describe(PasswordResetRequestComponent.name, () => {
  const TEST_USER_WITHOUT_SUBSCRIPTION = generateAuthenticatedUser();
  const apiRequestMockServer = startMockingApiRequests();

  it('Disable "Submit" button by default', async () => {
    const renderResult = await renderComponent(PasswordResetRequestComponent);

    expect(
      renderResult.container.querySelector('button[aria-label="Submit form to send password reset request"]')
    ).toBeDisabled();
  });

  it('Disable "Submit" button when email field is empty', async () => {
    const renderResult = await renderComponent(PasswordResetRequestComponent);

    const emailField = screen.getByLabelText('Email');

    const user = userEvent.setup();
    await user.type(emailField, TEST_USER_WITHOUT_SUBSCRIPTION.email);

    const submitButton = renderResult.container.querySelector(
      'button[aria-label="Submit form to send password reset request"]'
    );

    expect(submitButton).toBeEnabled();

    await user.clear(emailField);

    expect(submitButton).toBeDisabled();
  });

  it('Disable "Submit" button when email field is not valid', async () => {
    const renderResult = await renderComponent(PasswordResetRequestComponent);

    const emailField = screen.getByLabelText('Email');

    const user = userEvent.setup();
    await user.type(emailField, 'helloworld#gmail.com');

    expect(
      renderResult.container.querySelector('button[aria-label="Submit form to send password reset request"]')
    ).toBeDisabled();
  });

  it('Disable "Submit" button when email has more than 64 characters', async () => {
    const renderResult = await renderComponent(PasswordResetRequestComponent);

    const emailField = screen.getByLabelText('Email');

    const user = userEvent.setup();
    await user.type(emailField, `${'a'.repeat(64)}@gmail.com`);
    await user.tab();

    expect(
      renderResult.container.querySelector('button[aria-label="Submit form to send password reset request"]')
    ).toBeDisabled();
    expect(screen.getByText('Email must contain at most 64 characters')).toBeInTheDocument();
  });

  it('"Clear" button clears email form field', async () => {
    const renderResult = await renderComponent(PasswordResetRequestComponent);

    const emailField = screen.getByLabelText('Email');

    const user = userEvent.setup();
    await user.type(emailField, 'helloworld@gmail.com');
    await user.tab();

    await user.click(renderResult.container.querySelector('button[aria-label="Clear password reset request form"]')!);

    expect(
      renderResult.container.querySelector('button[aria-label="Submit form to send password reset request"]')
    ).toBeDisabled();
  });

  it('Show notification when user used oauth2 login the first time before', async () => {
    apiRequestMockServer.resetHandlers(
      http.post(`${__ORCHESTRATOR_URL__}/v1/users/me/reset/password`, () => {
        return HttpResponse.json(
          {
            payload: { code: ExceptionCode.PASSWORD_RESET_NOT_ALLOWED_FOR_OAUTH2_USER, extra: { provider: 'GOOGLE' } }
          },
          { status: 400 }
        );
      })
    );

    const renderResult = await renderComponent(PasswordResetRequestComponent);

    const emailField = screen.getByLabelText('Email');

    const user = userEvent.setup();
    await user.type(emailField, 'helloworld@gmail.com');

    const submitButton = renderResult.container.querySelector(
      'button[aria-label="Submit form to send password reset request"]'
    )!;

    await user.click(submitButton);

    expect(
      screen.getByText(/Resetting password is not allowed because you've previously logged in with Google using email/)
    ).toBeInTheDocument();
    expect(screen.queryByText('An unknown error has occurred while processing your request.')).not.toBeInTheDocument();
  });

  it('Show error message for unhandled failure', async () => {
    apiRequestMockServer.resetHandlers(
      http.post(`${__ORCHESTRATOR_URL__}/v1/users/me/reset/password`, () => {
        return HttpResponse.json({ payload: { code: ExceptionCode.UNKNOWN } }, { status: 500 });
      })
    );

    const renderResult = await renderComponent(PasswordResetRequestComponent);

    const emailField = screen.getByLabelText('Email');

    const user = userEvent.setup();
    await user.type(emailField, 'helloworld@gmail.com');

    const submitButton = renderResult.container.querySelector(
      'button[aria-label="Submit form to send password reset request"]'
    )!;

    await user.click(submitButton);

    expect(screen.getByText('An unknown error has occurred while processing your request.')).toBeInTheDocument();
    expect(screen.getByText('Please try again later or contact the administrator.')).toBeInTheDocument();
    expect(screen.getAllByText('Return to login')).toHaveLength(2);
  });

  it('Can request password reset', async () => {
    apiRequestMockServer.resetHandlers(
      http.post(`${__ORCHESTRATOR_URL__}/v1/users/me/reset/password`, () => {
        return new HttpResponse(null, { status: 204 });
      })
    );

    const renderResult = await renderComponent(PasswordResetRequestComponent);

    const emailField = screen.getByLabelText('Email');

    const user = userEvent.setup();
    await user.type(emailField, 'helloworld@gmail.com');

    const submitButton = renderResult.container.querySelector(
      'button[aria-label="Submit form to send password reset request"]'
    )!;

    await user.click(submitButton);

    assertCalledOnceWith(
      HttpClient.prototype.post,
      `${__ORCHESTRATOR_URL__}/v1/users/me/reset/password`,
      {
        email: 'helloworld@gmail.com'
      },
      { headers: { [getAliasFor('turnstileTokenHeader')]: 'test-token' } }
    );

    expect(screen.getByText('Your password reset request has been created')).toBeInTheDocument();
    expect(screen.getByText('Please check your email for further instructions.')).toBeInTheDocument();
    expect(screen.getByText('Continue to login')).toHaveAttribute('href', '/login');
  });
});
