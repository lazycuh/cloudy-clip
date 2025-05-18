import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { getAliasFor, ResponseBody } from '@lazycuh/http/src';
import { AuthenticatedUser, UserService } from '@lazycuh/web-ui-common/auth';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class AccountRegistrationRequestService {
  private readonly _httpClient = inject(HttpClient);
  private readonly _userService = inject(UserService);

  async registerNewAccount(payload: { displayName: string; email: string; password: string; turnstile: string }) {
    const { turnstile, ...requestPayload } = payload;

    const responseBody = await firstValueFrom(
      this._httpClient.post<ResponseBody<AuthenticatedUser>>(`${__ORCHESTRATOR_URL__}/v1/users`, requestPayload, {
        headers: { [getAliasFor('turnstileTokenHeader')]: turnstile }
      })
    );

    this._userService.updateAuthenticatedUser(responseBody.payload);
  }
}
