import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { getAliasFor } from '@lazycuh/http';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class PasswordResetRequestService {
  constructor(private readonly _httpClient: HttpClient) {}

  sendPasswordResetRequest(payload: { email: string; turnstile: string }) {
    const { turnstile, ...requestPayload } = payload;

    return firstValueFrom(
      this._httpClient.post(`${__ORCHESTRATOR_URL__}/v1/users/me/reset/password`, requestPayload, {
        headers: { [getAliasFor('turnstileTokenHeader')]: turnstile }
      })
    );
  }
}
