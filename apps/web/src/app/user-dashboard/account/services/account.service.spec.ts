import { HttpClient } from '@angular/common/http';
import { getAliasFor } from '@lazycuh/http/src';
import { UserService } from '@lazycuh/web-ui-common/auth';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { assertCalledOnceWith, configureTestingModuleForService, deepCloneObject } from 'test/utils';
import { generateAuthenticatedUser } from 'test/utils/generate-authenticated-user';

import { AccountService } from './account.service';

describe(AccountService.name, () => {
  let service: AccountService;

  beforeEach(() => {
    service = configureTestingModuleForService(AccountService);
  });

  it('#sendAccountVerificationEmail() calls the correct endpoint', async () => {
    vi.spyOn(HttpClient.prototype, 'post').mockReturnValue(of(undefined));

    await service.sendAccountVerificationEmail();

    assertCalledOnceWith(HttpClient.prototype.post, `${__ORCHESTRATOR_URL__}/v1/users/me/verification`, null);
  });

  it('#update() calls the correct endpoint', async () => {
    vi.spyOn(HttpClient.prototype, 'patch').mockReturnValue(of(undefined));
    vi.spyOn(UserService.prototype, 'getAuthenticatedUser').mockReturnValue(
      deepCloneObject(generateAuthenticatedUser())
    );

    await service.update({
      currentPassword: 'currentPassword',
      displayName: 'displayName',
      email: 'email',
      newPassword: 'newPassword',
      turnstile: 'turnstile'
    });

    expect(HttpClient.prototype.patch).toHaveBeenCalledOnce();
    assertCalledOnceWith(
      HttpClient.prototype.patch,
      `${__ORCHESTRATOR_URL__}/v1/users/me`,
      {
        currentPassword: 'currentPassword',
        displayName: 'displayName',
        email: 'email',
        newPassword: 'newPassword'
      },
      {
        headers: { [getAliasFor('turnstileTokenHeader')]: 'turnstile' }
      }
    );
  });

  it('#update() updates authenticated user after successful update', async () => {
    vi.spyOn(HttpClient.prototype, 'patch').mockReturnValue(of(undefined));

    const authenticatedUser = deepCloneObject(generateAuthenticatedUser());
    vi.spyOn(UserService.prototype, 'getAuthenticatedUser').mockReturnValue(authenticatedUser);

    await service.update({
      currentPassword: 'currentPassword',
      displayName: 'displayName',
      email: 'email',
      newPassword: 'newPassword',
      turnstile: 'turnstile'
    });

    expect(authenticatedUser.displayName).toBe('displayName');
    expect(authenticatedUser.email).toBe('email');

    assertCalledOnceWith(
      HttpClient.prototype.patch,
      `${__ORCHESTRATOR_URL__}/v1/users/me`,
      {
        currentPassword: 'currentPassword',
        displayName: 'displayName',
        email: 'email',
        newPassword: 'newPassword'
      },
      {
        headers: { [getAliasFor('turnstileTokenHeader')]: 'turnstile' }
      }
    );
  });

  it('#update() only updates fields that are present', async () => {
    vi.spyOn(HttpClient.prototype, 'patch').mockReturnValue(of(undefined));

    const authenticatedUser = deepCloneObject(generateAuthenticatedUser());
    vi.spyOn(UserService.prototype, 'getAuthenticatedUser').mockReturnValue(authenticatedUser);

    await service.update({
      currentPassword: 'currentPassword',
      displayName: '',
      email: 'email',
      newPassword: 'newPassword',
      turnstile: 'turnstile'
    });

    expect(authenticatedUser.displayName).toBe('Hello World');
    expect(authenticatedUser.email).toBe('email');

    assertCalledOnceWith(
      HttpClient.prototype.patch,
      `${__ORCHESTRATOR_URL__}/v1/users/me`,
      {
        currentPassword: 'currentPassword',
        email: 'email',
        newPassword: 'newPassword'
      },
      {
        headers: { [getAliasFor('turnstileTokenHeader')]: 'turnstile' }
      }
    );
  });
});
