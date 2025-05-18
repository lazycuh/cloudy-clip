import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { ExceptionCode } from '@lazycuh/http/src';
import { Logger } from '@lazycuh/logging';
import { screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { assertCalledOnceWith, convertToResponsePayload, renderComponent, startMockingApiRequests } from 'test/utils';

import { PasswordResetVerificationComponent } from './password-reset-verification.component';

describe(PasswordResetVerificationComponent.name, () => {
  const apiRequestMockServer = startMockingApiRequests();

  it('Disable "Submit" button by default', async () => {
    const renderResult = await renderComponent(PasswordResetVerificationComponent);

    expect(renderResult.container.querySelector('button[aria-label="Submit form to reset password"]')).toBeDisabled();
  });

  it('Disable "Submit" button when password field is empty', async () => {
    const renderResult = await renderComponent(PasswordResetVerificationComponent);

    const passwordField = screen.getByLabelText('New password');

    const user = userEvent.setup();
    await user.type(passwordField, 'HelloWorld2024');

    const submitButton = renderResult.container.querySelector('button[aria-label="Submit form to reset password"]');

    expect(submitButton).toBeEnabled();

    await user.clear(passwordField);

    expect(submitButton).toBeDisabled();
  });

  it('Disable "Submit" button when password field is not valid', async () => {
    const renderResult = await renderComponent(PasswordResetVerificationComponent);

    const passwordField = screen.getByLabelText('New password');

    const user = userEvent.setup();
    await user.type(passwordField, 'helloworld');

    expect(renderResult.container.querySelector('button[aria-label="Submit form to reset password"]')).toBeDisabled();
  });

  it('"Clear" button clears password form field', async () => {
    const renderResult = await renderComponent(PasswordResetVerificationComponent);

    const passwordField = screen.getByLabelText('New password');

    const user = userEvent.setup();
    await user.type(passwordField, 'HelloWorld2024');
    await user.tab();

    await user.click(renderResult.container.querySelector('button[aria-label="Clear form"]')!);

    expect(renderResult.container.querySelector('button[aria-label="Submit form to reset password"]')).toBeDisabled();
  });

  it('Show error when verification code query param is missing', async () => {
    await renderComponent(PasswordResetVerificationComponent);

    expect(screen.getByText('Password reset code is missing or empty')).toBeInTheDocument();
    expect(
      screen.getByText('Please use the supplied verification link that was sent to your email.')
    ).toBeInTheDocument();
    expect(screen.getByText('Return to login')).toHaveAttribute('href', '/login');
  });

  it('Show error when verification code query param is emtpy', async () => {
    await renderComponent(PasswordResetVerificationComponent, {
      providers: [
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              queryParamMap: convertToParamMap({
                code: ''
              })
            }
          }
        }
      ]
    });

    expect(screen.getByText('Password reset code is missing or empty')).toBeInTheDocument();
    expect(
      screen.getByText('Please use the supplied verification link that was sent to your email.')
    ).toBeInTheDocument();
    expect(screen.getByText('Return to login')).toHaveAttribute('href', '/login');
  });

  it('Show error when verification code is not valid', async () => {
    apiRequestMockServer.resetHandlers(
      http.patch(`${__ORCHESTRATOR_URL__}/v1/users/me/reset/password`, () => {
        return HttpResponse.json({ message: 'verification code is not valid' }, { status: 400 });
      })
    );

    const renderResult = await renderComponent(PasswordResetVerificationComponent, {
      providers: [
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              queryParamMap: convertToParamMap({
                code: '123456'
              })
            }
          }
        }
      ]
    });

    const user = userEvent.setup();
    await user.type(screen.getByLabelText('New password'), 'HelloWorld2024');

    await user.click(renderResult.container.querySelector('button[aria-label="Submit form to reset password"]')!);

    expect(screen.getByText('Password reset code is not valid')).toBeInTheDocument();
    expect(screen.getByText('Please ensure that your verification link has not expired.')).toBeInTheDocument();
    expect(screen.getByText('Return to login')).toHaveAttribute('href', '/login');
  });

  it('Show error when unknown error occurs', async () => {
    apiRequestMockServer.resetHandlers(
      http.patch(`${__ORCHESTRATOR_URL__}/v1/users/me/reset/password`, () => {
        return HttpResponse.json(convertToResponsePayload({ code: ExceptionCode.UNKNOWN }, 'expected'), {
          status: 500
        });
      })
    );

    const renderResult = await renderComponent(PasswordResetVerificationComponent, {
      providers: [
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              queryParamMap: convertToParamMap({
                code: '123456'
              })
            }
          }
        }
      ]
    });

    const user = userEvent.setup();
    await user.type(screen.getByLabelText('New password'), 'HelloWorld2024');

    await user.click(renderResult.container.querySelector('button[aria-label="Submit form to reset password"]')!);

    expect(screen.getByText('An unknown error has occurred while processing your request')).toBeInTheDocument();
    expect(screen.getByText('Please try again later.')).toBeInTheDocument();
    expect(screen.getByText('Return to login')).toHaveAttribute('href', '/login');

    assertCalledOnceWith(
      Logger.prototype.error,
      'failed to reset password',
      {
        message: 'expected',
        payload: { code: ExceptionCode.UNKNOWN }
      },
      { verificationCode: '123456' }
    );
  });

  it('Show message when resetting password succeeds', async () => {
    apiRequestMockServer.resetHandlers(
      http.patch(`${__ORCHESTRATOR_URL__}/v1/users/me/reset/password`, () => {
        return new HttpResponse(undefined, { status: 200 });
      })
    );

    const renderResult = await renderComponent(PasswordResetVerificationComponent, {
      providers: [
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              queryParamMap: convertToParamMap({
                code: '123456'
              })
            }
          }
        }
      ]
    });

    const user = userEvent.setup();
    await user.type(screen.getByLabelText('New password'), 'HelloWorld2024');

    await user.click(renderResult.container.querySelector('button[aria-label="Submit form to reset password"]')!);

    expect(screen.getByText('Your password has been successfully reset')).toBeInTheDocument();
    expect(screen.getByText('Continue to login')).toHaveAttribute('href', '/login');
  });
});
