/* eslint-disable max-len */
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { UserService } from '@lazycuh/web-ui-common/auth';
import { screen } from '@testing-library/angular';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';

import { mockAuthenticatedUser, renderComponent, startMockingApiRequests } from 'test/utils';

import { AccountRegistrationVerificationComponent } from './account-registration-verification.component';

describe(AccountRegistrationVerificationComponent.name, () => {
  const apiRequestMockServer = startMockingApiRequests();

  it('Shows error when verification code query param is missing', async () => {
    await renderComponent(AccountRegistrationVerificationComponent);

    expect(screen.getByText('Account verification code is missing or empty')).toBeInTheDocument();
    expect(
      screen.getByText('Please use the supplied verification link that was sent to your email.')
    ).toBeInTheDocument();
    expect(screen.getByText('Return to login')).toHaveAttribute('href', '/login');
  });

  it('Shows error when verification code is not valid', async () => {
    apiRequestMockServer.resetHandlers(
      http.patch(`${__ORCHESTRATOR_URL__}/v1/users/me/verification`, () => {
        return HttpResponse.json({ message: 'verification code is not valid' }, { status: 400 });
      })
    );

    await renderComponent(AccountRegistrationVerificationComponent, {
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

    expect(screen.getByText('Account verification code is not valid')).toBeInTheDocument();
    expect(screen.getByText('Please ensure that your verification link has not expired.')).toBeInTheDocument();
    expect(screen.getByText('Return to login')).toHaveAttribute('href', '/login');
  });

  it('Shows error when verifying fails with an unhandled error message', async () => {
    apiRequestMockServer.resetHandlers(
      http.patch(`${__ORCHESTRATOR_URL__}/v1/users/me/verification`, () => {
        return HttpResponse.json({ message: 'unknown' }, { status: 500 });
      })
    );

    await renderComponent(AccountRegistrationVerificationComponent, {
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

    expect(screen.getByText('An unknown error has occurred while processing your request')).toBeInTheDocument();
    expect(screen.getByText('Please try again later.')).toBeInTheDocument();
    expect(screen.getByText('Return to login')).toHaveAttribute('href', '/login');
  });

  it('Shows message after successful verification and set user status to active if user is still logged in', async () => {
    apiRequestMockServer.resetHandlers(
      http.patch(`${__ORCHESTRATOR_URL__}/v1/users/me/verification`, ({ request }) => {
        expect(request.url).toContain('?code=123456');

        return new HttpResponse(undefined, { status: 204 });
      })
    );

    const testUser = mockAuthenticatedUser();
    testUser.status = 'UNVERIFIED';

    await renderComponent(AccountRegistrationVerificationComponent, {
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

    expect(screen.getByText('Your account has been verified')).toBeInTheDocument();
    expect(screen.getByText('Continue to login')).toHaveAttribute('href', '/login');

    expect(testUser.status).toEqual('ACTIVE');
    expect(testUser.statusReason).toEqual('');
  });

  it('Does not set user status to active if user is not logged in', async () => {
    apiRequestMockServer.resetHandlers(
      http.patch(`${__ORCHESTRATOR_URL__}/v1/users/me/verification`, () => {
        return new HttpResponse(undefined, { status: 204 });
      })
    );

    vi.spyOn(UserService.prototype, 'isUserAlreadyLoggedIn');
    vi.spyOn(UserService.prototype, 'getAuthenticatedUser');
    vi.spyOn(UserService.prototype, 'findAuthenticatedUser');

    await renderComponent(AccountRegistrationVerificationComponent, {
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

    expect(screen.getByText('Your account has been verified')).toBeInTheDocument();
    expect(screen.getByText('Continue to login')).toHaveAttribute('href', '/login');

    expect(UserService.prototype.isUserAlreadyLoggedIn).toHaveBeenCalledOnce();
    expect(UserService.prototype.getAuthenticatedUser).not.toHaveBeenCalled();
    expect(UserService.prototype.findAuthenticatedUser).not.toHaveBeenCalled();
  });
});
