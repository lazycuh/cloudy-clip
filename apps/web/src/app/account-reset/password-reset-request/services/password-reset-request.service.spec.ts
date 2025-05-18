import { HttpClient } from '@angular/common/http';
import { getAliasFor } from '@lazycuh/http/src';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, it } from 'vitest';

import { assertCalledOnceWith, configureTestingModuleForService, startMockingApiRequests } from 'test/utils';
import { generateAuthenticatedUser } from 'test/utils/generate-authenticated-user';

import { PasswordResetRequestService } from './password-reset-request.service';

describe(PasswordResetRequestService.name, () => {
  const TEST_USER_WITHOUT_SUBSCRIPTION = generateAuthenticatedUser();
  const apiRequestMockServer = startMockingApiRequests();

  let service: PasswordResetRequestService;

  beforeEach(() => {
    service = configureTestingModuleForService(PasswordResetRequestService);
  });

  it('#sendPasswordResetRequest() sends password reset request to backend', async () => {
    apiRequestMockServer.resetHandlers(
      http.post(`${__ORCHESTRATOR_URL__}/v1/users/me/reset/password`, () => {
        return new HttpResponse(undefined, { status: 204 });
      })
    );

    const payload = {
      email: TEST_USER_WITHOUT_SUBSCRIPTION.email,
      turnstile: 'turnstile'
    };

    await service.sendPasswordResetRequest(payload);

    assertCalledOnceWith(
      HttpClient.prototype.post,
      `${__ORCHESTRATOR_URL__}/v1/users/me/reset/password`,
      {
        email: payload.email
      },
      {
        headers: { [getAliasFor('turnstileTokenHeader')]: payload.turnstile }
      }
    );
  });
});
