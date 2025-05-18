import { ExceptionCode } from '@lazycuh/http/src';
import { Logger } from '@lazycuh/logging';
import { UserService } from '@lazycuh/web-ui-common/auth';
import { delayBy } from '@lazycuh/web-ui-common/utils/delay-by';
import { screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';

import {
  assertCalledOnceWith,
  convertToResponsePayload,
  deepCloneObject,
  renderComponent,
  startMockingApiRequests
} from 'test/utils';
import { generateAuthenticatedUser } from 'test/utils/generate-authenticated-user';

import { AccountComponent } from './account.component';
import { AccountService } from './services';

describe(AccountComponent.name, () => {
  const apiRequestMockServer = startMockingApiRequests();

  it('Renders correctly for user using email/password', async () => {
    const user = deepCloneObject(generateAuthenticatedUser());
    user.updatedAt = '2025-02-10T04:21:21.717Z';
    vi.spyOn(UserService.prototype, 'getAuthenticatedUser').mockReturnValue(user);

    await renderComponent(AccountComponent);

    expect(screen.getByText('Account info')).toBeInTheDocument();
    expect(screen.getByText(/Updated on:/)).toBeInTheDocument();
    expect(screen.getByText(/Feb 9, 2025, 4:21:21 PM/)).toBeInTheDocument();
    expect(screen.getByLabelText('Display name')).toHaveValue('Hello World');
    expect(screen.getByLabelText('Email')).toHaveValue('helloworld@gmail.com');
    expect(screen.getByLabelText('New password')).toHaveValue('');
    expect(screen.getByLabelText('Current password')).toHaveValue('');
    expect(screen.getByText('Clear')).toBeEnabled();
    expect(screen.getByText('Update').parentElement!.parentElement).toBeDisabled();
  });

  it('Renders correctly for user using oauth2 login', async () => {
    const user = deepCloneObject(generateAuthenticatedUser());
    user.provider = 'GOOGLE';
    vi.spyOn(UserService.prototype, 'getAuthenticatedUser').mockReturnValue(user);

    await renderComponent(AccountComponent);

    expect(screen.getByText('Account info')).toBeInTheDocument();
    expect(screen.getByText('Note')).toBeInTheDocument();
    expect(
      screen.getByText('Editing has been disabled because your account is managed by Google.')
    ).toBeInTheDocument();
    expect(screen.queryByText(/Updated on:/)).not.toBeInTheDocument();
    expect(screen.getByLabelText('Display name')).toHaveValue('Hello World');
    expect(screen.getByLabelText('Email')).toHaveValue('helloworld@gmail.com');
    expect(screen.queryByText('New password')).not.toBeInTheDocument();
    expect(screen.queryByText('Current password')).not.toBeInTheDocument();
    expect(screen.queryByText('Clear')).not.toBeInTheDocument();
    expect(screen.queryByText('Update')).not.toBeInTheDocument();
  });

  it('Shows warning about account being blocked when account is not verified', async () => {
    const user = deepCloneObject(generateAuthenticatedUser());
    user.createdAt = '2025-02-10T00:00:00.000Z';
    user.status = 'UNVERIFIED';
    vi.spyOn(UserService.prototype, 'getAuthenticatedUser').mockReturnValue(user);

    await renderComponent(AccountComponent);

    expect(screen.getByText('Status: Unverified')).toBeInTheDocument();
    expect(screen.getByText('Attention')).toBeInTheDocument();
    expect(
      screen.getByText('Your account will be blocked on Feb 16, 2025, 12:00:00 PM if not verified.')
    ).toBeInTheDocument();
    expect(screen.getByText('Verify now')).toBeEnabled();
  });

  it('Sends account verification email', async () => {
    apiRequestMockServer.resetHandlers(
      http.post(`${__ORCHESTRATOR_URL__}/v1/users/me/verification`, () => {
        return new HttpResponse(undefined, { status: 204 });
      })
    );

    const authenticatedUser = deepCloneObject(generateAuthenticatedUser());
    authenticatedUser.createdAt = '2025-02-10T04:21:21.717Z';
    authenticatedUser.status = 'UNVERIFIED';
    vi.spyOn(UserService.prototype, 'getAuthenticatedUser').mockReturnValue(authenticatedUser);

    await renderComponent(AccountComponent);

    const user = userEvent.setup();
    await user.click(screen.getByText('Verify now'));

    await delayBy(16);

    expect(screen.getByText('Please check your email for further instructions')).toBeInTheDocument();
  });

  it('Shows notification when sending verification email fails', async () => {
    apiRequestMockServer.resetHandlers(
      http.post(`${__ORCHESTRATOR_URL__}/v1/users/me/verification`, () => {
        return HttpResponse.json(convertToResponsePayload({ code: ExceptionCode.UNKNOWN }), { status: 500 });
      })
    );

    const authenticatedUser = deepCloneObject(generateAuthenticatedUser());
    authenticatedUser.createdAt = '2025-02-10T04:21:21.717Z';
    authenticatedUser.status = 'UNVERIFIED';
    vi.spyOn(UserService.prototype, 'getAuthenticatedUser').mockReturnValue(authenticatedUser);

    await renderComponent(AccountComponent);

    const user = userEvent.setup();
    await user.click(screen.getByText('Verify now'));

    await delayBy(16);

    expect(
      screen.getByText(/An unknown error has occurred while processing your request\. Please try again later\./)
    ).toBeInTheDocument();
    expect(screen.queryByText('Please check your email for further instructions')).not.toBeInTheDocument();
  });

  it('Can update email', async () => {
    vi.spyOn(AccountService.prototype, 'update');

    apiRequestMockServer.resetHandlers(
      http.patch(`${__ORCHESTRATOR_URL__}/v1/users/me`, () => {
        return new HttpResponse(undefined, { status: 204 });
      })
    );

    const authenticatedUser = deepCloneObject(generateAuthenticatedUser());
    vi.spyOn(UserService.prototype, 'getAuthenticatedUser').mockReturnValue(authenticatedUser);

    await renderComponent(AccountComponent);

    const user = userEvent.setup();

    const emailInput = screen.getByLabelText('Email');
    await user.clear(emailInput);
    await user.type(emailInput, 'newemail@email.com');

    await user.type(screen.getByLabelText('Current password'), 'currentPassword');

    await delayBy(16);

    await user.click(screen.getByText('Update').parentElement!.parentElement!);

    await delayBy(16);

    expect(AccountService.prototype.update).toHaveBeenCalledOnce();

    expect(screen.getByText('Account was updated.')).toBeInTheDocument();
    expect(authenticatedUser.email).toEqual('newemail@email.com');
  });

  it('Can update display name', async () => {
    vi.spyOn(AccountService.prototype, 'update');

    apiRequestMockServer.resetHandlers(
      http.patch(`${__ORCHESTRATOR_URL__}/v1/users/me`, () => {
        return new HttpResponse(undefined, { status: 204 });
      })
    );

    const authenticatedUser = deepCloneObject(generateAuthenticatedUser());
    vi.spyOn(UserService.prototype, 'getAuthenticatedUser').mockReturnValue(authenticatedUser);

    await renderComponent(AccountComponent);

    const user = userEvent.setup();

    const displayNameInput = screen.getByLabelText('Display name');
    await user.clear(displayNameInput);
    await user.type(displayNameInput, 'Display Name');

    await user.type(screen.getByLabelText('Current password'), 'currentPassword');

    await delayBy(16);

    await user.click(screen.getByText('Update').parentElement!.parentElement!);

    await delayBy(16);

    expect(AccountService.prototype.update).toHaveBeenCalledOnce();

    expect(screen.getByText('Account was updated.')).toBeInTheDocument();

    expect(authenticatedUser.displayName).toEqual('Display Name');
  });

  it('Can update display name and email together', async () => {
    vi.spyOn(AccountService.prototype, 'update');

    apiRequestMockServer.resetHandlers(
      http.patch(`${__ORCHESTRATOR_URL__}/v1/users/me`, () => {
        return new HttpResponse(undefined, { status: 204 });
      })
    );

    const authenticatedUser = deepCloneObject(generateAuthenticatedUser());
    vi.spyOn(UserService.prototype, 'getAuthenticatedUser').mockReturnValue(authenticatedUser);

    await renderComponent(AccountComponent);

    const user = userEvent.setup();

    const displayNameInput = screen.getByLabelText('Display name');
    await user.clear(displayNameInput);
    await user.type(displayNameInput, 'Display Name');

    const emailInput = screen.getByLabelText('Email');
    await user.clear(emailInput);
    await user.type(emailInput, 'newemail@gmail.com');

    await user.type(screen.getByLabelText('Current password'), 'currentPassword');

    await delayBy(16);

    await user.click(screen.getByText('Update').parentElement!.parentElement!);

    await delayBy(16);

    expect(AccountService.prototype.update).toHaveBeenCalledOnce();

    expect(screen.getByText('Account was updated.')).toBeInTheDocument();

    expect(authenticatedUser.displayName).toEqual('Display Name');
    expect(authenticatedUser.email).toEqual('newemail@gmail.com');
  });

  it('Clicking "Clear" will clear all inputs', async () => {
    const authenticatedUser = deepCloneObject(generateAuthenticatedUser());
    vi.spyOn(UserService.prototype, 'getAuthenticatedUser').mockReturnValue(authenticatedUser);

    await renderComponent(AccountComponent);

    const user = userEvent.setup();

    expect(screen.getByLabelText('Display name')).toHaveValue('Hello World');
    expect(screen.getByLabelText('Email')).toHaveValue('helloworld@gmail.com');

    await delayBy(16);

    await user.click(screen.getByText('Clear'));

    await delayBy(16);

    expect(screen.getByLabelText('Display name')).toHaveValue('');
    expect(screen.getByLabelText('Email')).toHaveValue('');

    expect(screen.getByText('Clear')).toBeDisabled();
  });

  it('Shows notification when current password is not correct', async () => {
    vi.spyOn(AccountService.prototype, 'update');

    apiRequestMockServer.resetHandlers(
      http.patch(`${__ORCHESTRATOR_URL__}/v1/users/me`, () => {
        return HttpResponse.json(
          convertToResponsePayload({ code: ExceptionCode.VALIDATION }, 'current password was not correct'),
          { status: 400 }
        );
      })
    );

    const authenticatedUser = deepCloneObject(generateAuthenticatedUser());
    vi.spyOn(UserService.prototype, 'getAuthenticatedUser').mockReturnValue(authenticatedUser);

    await renderComponent(AccountComponent);

    const user = userEvent.setup();

    const emailInput = screen.getByLabelText('Email');
    await user.clear(emailInput);
    await user.type(emailInput, 'newemail@email.com');

    await user.type(screen.getByLabelText('Current password'), 'currentPassword');

    await delayBy(16);

    await user.click(screen.getByText('Update').parentElement!.parentElement!);

    await delayBy(16);

    expect(AccountService.prototype.update).toHaveBeenCalledOnce();

    expect(screen.getByText('Current password was not correct. Please try again.')).toBeInTheDocument();
    expect(screen.getByText('Current password was not correct')).toBeInTheDocument();
    expect(Logger.prototype.error).not.toHaveBeenCalledOnce();

    expect(screen.getByText('Update').parentElement!.parentElement).toBeDisabled();
    expect(screen.getByText('Clear')).toBeEnabled();
  });

  it('Shows notification with default error message when updating fails with an unhandled failure', async () => {
    vi.spyOn(AccountService.prototype, 'update');

    apiRequestMockServer.resetHandlers(
      http.patch(`${__ORCHESTRATOR_URL__}/v1/users/me`, () => {
        return HttpResponse.json(convertToResponsePayload({ code: ExceptionCode.UNKNOWN }, 'expected'), {
          status: 500
        });
      })
    );

    const authenticatedUser = deepCloneObject(generateAuthenticatedUser());
    vi.spyOn(UserService.prototype, 'getAuthenticatedUser').mockReturnValue(authenticatedUser);

    await renderComponent(AccountComponent);

    const user = userEvent.setup();

    const emailInput = screen.getByLabelText('Email');
    await user.clear(emailInput);
    await user.type(emailInput, 'newemail@email.com');

    await user.type(screen.getByLabelText('Current password'), 'currentPassword');

    await delayBy(16);

    await user.click(screen.getByText('Update').parentElement!.parentElement!);

    await delayBy(16);

    expect(AccountService.prototype.update).toHaveBeenCalledOnce();

    expect(
      screen.getByText(/An unknown error has occurred while processing your request\. Please try again later\./)
    ).toBeInTheDocument();

    assertCalledOnceWith(Logger.prototype.error, 'failed to update account', {
      message: 'expected',
      payload: { code: ExceptionCode.UNKNOWN }
    });

    expect(screen.getByText('Update').parentElement!.parentElement).toBeEnabled();
    expect(screen.getByText('Clear')).toBeEnabled();
  });
});
