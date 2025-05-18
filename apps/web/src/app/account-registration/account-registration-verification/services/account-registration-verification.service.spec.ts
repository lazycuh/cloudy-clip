import { HttpClient } from '@angular/common/http';
import { getAliasFor } from '@lazycuh/http/src';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { LITE_MONTHLY_PLAN } from 'test/data';
import { configureTestingModuleForService, startMockingApiRequests } from 'test/utils';
import { generateAuthenticatedUser } from 'test/utils/generate-authenticated-user';

import { AccountRegistrationVerificationService } from './account-registration-verification.service';

describe(AccountRegistrationVerificationService.name, () => {
  const TEST_USER_WITH_LITE_MONTHLY_SUBSCRIPTION = generateAuthenticatedUser(LITE_MONTHLY_PLAN);
  const apiRequestMockServer = startMockingApiRequests();

  let service: AccountRegistrationVerificationService;

  beforeEach(() => {
    service = configureTestingModuleForService(AccountRegistrationVerificationService);
  });

  it('#verifyAccountRegistrationCode() verifies code successfully', async () => {
    const verificationCode = '123456';

    apiRequestMockServer.resetHandlers(
      http.patch(`${__ORCHESTRATOR_URL__}/v1/users/me/verification`, ({ request }) => {
        if (!request.url.includes(`code=${verificationCode}`)) {
          throw new Error('Verification code query param is missing');
        }

        return HttpResponse.json({ payload: TEST_USER_WITH_LITE_MONTHLY_SUBSCRIPTION });
      })
    );

    const httpClientPatchMethodSpy = vi.spyOn(HttpClient.prototype, 'patch');

    await service.verifyAccountRegistrationCode(verificationCode, 'turnstile');

    expect(httpClientPatchMethodSpy.mock.calls[0]![2]).toEqual({
      headers: { [getAliasFor('turnstileTokenHeader')]: 'turnstile' }
    });
  });
});
