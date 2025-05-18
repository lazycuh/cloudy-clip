import { HttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { getAliasFor } from '@lazycuh/http/src';
import { UserService } from '@lazycuh/web-ui-common/auth';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';

import { LITE_MONTHLY_PLAN } from 'test/data';
import { assertCalledOnceWith, configureTestingModuleForService, startMockingApiRequests } from 'test/utils';
import { generateAuthenticatedUser } from 'test/utils/generate-authenticated-user';

import { AccountRegistrationRequestService } from './account-registration-request.service';

describe(AccountRegistrationRequestService.name, () => {
  const TEST_USER_WITH_LITE_MONTHLY_SUBSCRIPTION = generateAuthenticatedUser(LITE_MONTHLY_PLAN);
  const TEST_USER_WITHOUT_SUBSCRIPTION = generateAuthenticatedUser();
  const apiRequestMockServer = startMockingApiRequests();

  let service: AccountRegistrationRequestService;
  let userService: UserService;

  beforeEach(() => {
    service = configureTestingModuleForService(AccountRegistrationRequestService);
    userService = TestBed.inject(UserService);
  });

  it('#registerNewAccount() creates a new account and logs user in', async () => {
    apiRequestMockServer.resetHandlers(
      http.post(`${__ORCHESTRATOR_URL__}/v1/users`, () => {
        return HttpResponse.json({ payload: TEST_USER_WITH_LITE_MONTHLY_SUBSCRIPTION });
      })
    );

    expect(userService.findAuthenticatedUser().isEmpty()).toEqual(true);

    const payload = {
      displayName: TEST_USER_WITHOUT_SUBSCRIPTION.displayName,
      email: TEST_USER_WITHOUT_SUBSCRIPTION.email,
      password: 'HelloWorld123',
      turnstile: 'turnstile'
    };

    await service.registerNewAccount(payload);

    expect(userService.findAuthenticatedUser().isPresent()).toEqual(true);

    assertCalledOnceWith(
      HttpClient.prototype.post,
      `${__ORCHESTRATOR_URL__}/v1/users`,
      {
        displayName: payload.displayName,
        email: payload.email,
        password: payload.password
      },
      {
        headers: { [getAliasFor('turnstileTokenHeader')]: payload.turnstile }
      }
    );
  });
});
