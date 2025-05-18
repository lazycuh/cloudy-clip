import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { getAliasFor } from '@lazycuh/http/src';
import { UserService } from '@lazycuh/web-ui-common/auth';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class AccountService {
  private readonly _httpClient = inject(HttpClient);
  private readonly _userService = inject(UserService);

  async sendAccountVerificationEmail() {
    await firstValueFrom(this._httpClient.post(`${__ORCHESTRATOR_URL__}/v1/users/me/verification`, null));
  }

  async update(updates: {
    currentPassword: string;
    displayName: string;
    email: string;
    newPassword: string;
    turnstile: string;
  }) {
    const authenticatedUser = this._userService.getAuthenticatedUser();

    const requestPayload: Record<string, string> = {
      currentPassword: updates.currentPassword
    };

    if (updates.newPassword) {
      requestPayload.newPassword = updates.newPassword;
    }

    if (updates.email && updates.email !== authenticatedUser.email) {
      requestPayload.email = updates.email;
    }

    if (updates.displayName && updates.displayName !== authenticatedUser.displayName) {
      requestPayload.displayName = updates.displayName;
    }

    await firstValueFrom(
      this._httpClient.patch(`${__ORCHESTRATOR_URL__}/v1/users/me`, requestPayload, {
        headers: { [getAliasFor('turnstileTokenHeader')]: updates.turnstile }
      })
    );

    Object.assign(authenticatedUser, requestPayload);
  }
}
