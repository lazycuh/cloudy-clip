import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { ExceptionCode } from '@lazycuh/http/src';
import { Logger } from '@lazycuh/logging';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  assertCalledOnceWith,
  configureTestingModuleForService,
  convertToResponsePayload,
  deepCloneObject,
  startMockingApiRequests
} from 'test/utils';
import { generateAuthenticatedUser } from 'test/utils/generate-authenticated-user';

import { delayBy } from '../utils/delay-by';

import { UserService } from './user.service';

describe(UserService.name, () => {
  const TEST_USER_WITHOUT_SUBSCRIPTION = generateAuthenticatedUser();
  const apiRequestMockServer = startMockingApiRequests();

  let service: UserService;

  beforeEach(() => {
    service = configureTestingModuleForService(UserService);

    apiRequestMockServer.resetHandlers(
      http.get(`${__ORCHESTRATOR_URL__}/v1/users/me/sessions/my`, () => {
        return HttpResponse.json({
          message: 'OK',
          payload: TEST_USER_WITHOUT_SUBSCRIPTION
        });
      })
    );
  });

  it('Restores user session', async () => {
    await service.restoreSession();

    await delayBy(16);

    expect(service.isUserAlreadyLoggedIn()).toEqual(true);
  });

  it('Does not send request to server to restore session if user is already logged in', async () => {
    await service.restoreSession();

    await delayBy(16);

    expect(service.isUserAlreadyLoggedIn()).toEqual(true);

    expect(HttpClient.prototype.get).toHaveBeenCalledOnce();

    await service.restoreSession();

    await delayBy(16);

    expect(service.isUserAlreadyLoggedIn()).toEqual(true);

    expect(HttpClient.prototype.get).toHaveBeenCalledOnce();
  });

  it('Force-sends request to server to restore session event if user is already logged in', async () => {
    await service.restoreSession();

    await delayBy(16);

    expect(service.isUserAlreadyLoggedIn()).toEqual(true);

    expect(HttpClient.prototype.get).toHaveBeenCalledOnce();

    await service.restoreSession(true);

    await delayBy(16);

    expect(service.isUserAlreadyLoggedIn()).toEqual(true);

    expect(HttpClient.prototype.get).toHaveBeenCalledTimes(2);
  });

  it('Signs user out', async () => {
    await service.restoreSession();

    await delayBy(16);

    expect(service.isUserAlreadyLoggedIn()).toEqual(true);

    apiRequestMockServer.resetHandlers(
      http.delete(`${__ORCHESTRATOR_URL__}/v1/users/me/sessions/my`, () => {
        return new HttpResponse(null, { status: 204 });
      })
    );

    await service.signOut();

    await delayBy(16);

    expect(service.isUserAlreadyLoggedIn()).toEqual(false);
    expect(HttpClient.prototype.delete).toHaveBeenCalledOnce();
  });

  it('#isUserAlreadyLoggedIn() returns false when user is not logged in', () => {
    expect(service.isUserAlreadyLoggedIn()).toEqual(false);
  });

  it('#isUserAlreadyLoggedIn() returns true when user is logged in', async () => {
    await service.restoreSession();

    await delayBy(16);

    expect(service.isUserAlreadyLoggedIn()).toEqual(true);
  });

  it('#getAuthenticatedUser() should return authenticated user', async () => {
    await service.restoreSession();

    await delayBy(16);

    expect(service.getAuthenticatedUser()).toEqual(TEST_USER_WITHOUT_SUBSCRIPTION);
  });

  it('#getAuthenticatedUser() throws when user has not logged in', () => {
    expect(() => service.getAuthenticatedUser()).toThrowError(new Error('no logged-in user'));
  });

  it('#findAuthenticatedUser() returns an empty option when user is not logged in', () => {
    expect(service.findAuthenticatedUser().isEmpty()).toEqual(true);
  });

  it('#findAuthenticatedUser() returns a non-empty option when user is logged in', async () => {
    await service.restoreSession();

    await delayBy(16);

    expect(service.findAuthenticatedUser().isPresent()).toEqual(true);
  });

  it('#updateAuthenticatedUser() sets logged-in user to provided user', async () => {
    await service.restoreSession();

    await delayBy(16);

    expect(service.getAuthenticatedUser()).toEqual(TEST_USER_WITHOUT_SUBSCRIPTION);

    const updatedUser = deepCloneObject(TEST_USER_WITHOUT_SUBSCRIPTION);

    service.updateAuthenticatedUser(updatedUser);

    expect(service.getAuthenticatedUser()).toEqual(updatedUser);
  });

  it('#restoreSession() logs error and returns false when backend returns non-404 status code', async () => {
    apiRequestMockServer.resetHandlers(
      http.get(`${__ORCHESTRATOR_URL__}/v1/users/me/sessions/my`, () => {
        return HttpResponse.json(convertToResponsePayload({ code: ExceptionCode.UNKNOWN }, 'expected'), {
          status: 500
        });
      })
    );

    expect(await service.restoreSession()).toEqual(false);

    await delayBy(16);

    expect(service.isUserAlreadyLoggedIn()).toEqual(false);

    assertCalledOnceWith(Logger.prototype.error, 'failed to restore user session', expect.any(HttpErrorResponse));
  });

  it('#restoreSession() returns false when backend returns 404', async () => {
    apiRequestMockServer.resetHandlers(
      http.get(`${__ORCHESTRATOR_URL__}/v1/users/me/sessions/my`, () => {
        return HttpResponse.json(convertToResponsePayload({ code: ExceptionCode.NOT_FOUND }, 'expected'), {
          status: 404
        });
      })
    );

    expect(await service.restoreSession()).toEqual(false);

    await delayBy(16);

    expect(service.isUserAlreadyLoggedIn()).toEqual(false);

    expect(Logger.prototype.error).not.toHaveBeenCalled();
  });

  it('#restoreSession() does not call backend again when the previous request is still in-flight', async () => {
    vi.useFakeTimers();

    apiRequestMockServer.resetHandlers(
      http.get(`${__ORCHESTRATOR_URL__}/v1/users/me/sessions/my`, async () => {
        await delayBy(1000);

        return HttpResponse.json(convertToResponsePayload(TEST_USER_WITHOUT_SUBSCRIPTION));
      })
    );

    void vi.advanceTimersByTimeAsync(1000);

    void service.restoreSession();
    void service.restoreSession();

    expect(await service.restoreSession()).toEqual(true);

    expect(HttpClient.prototype.get).toHaveBeenCalledOnce();
  });
});
