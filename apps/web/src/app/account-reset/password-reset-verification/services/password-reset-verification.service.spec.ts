import { HttpClient } from '@angular/common/http';
import { getAliasFor } from '@lazycuh/http/src';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, it } from 'vitest';

import { assertCalledOnceWith, configureTestingModuleForService, startMockingApiRequests } from 'test/utils';

import { PasswordResetVerificationService } from './password-reset-verification.service';

describe(PasswordResetVerificationService.name, () => {
  const apiRequestMockServer = startMockingApiRequests();

  let service: PasswordResetVerificationService;

  beforeEach(() => {
    service = configureTestingModuleForService(PasswordResetVerificationService);
  });

  it('#resetPassword() calls backend with expected payload', async () => {
    apiRequestMockServer.resetHandlers(
      http.patch(`${__ORCHESTRATOR_URL__}/v1/users/me/reset/password`, () => {
        return new HttpResponse(undefined, { status: 204 });
      })
    );

    const verificationCode = 'verificationCode';
    const payload = {
      password: 'HelloWorld2024',
      turnstile: 'turnstile'
    };

    await service.resetPassword(verificationCode, payload);

    assertCalledOnceWith(
      HttpClient.prototype.patch,
      `${__ORCHESTRATOR_URL__}/v1/users/me/reset/password`,
      {
        password: payload.password,
        verificationCode
      },
      {
        headers: { [getAliasFor('turnstileTokenHeader')]: payload.turnstile }
      }
    );
  });
});
