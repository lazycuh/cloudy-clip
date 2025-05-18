import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { getAliasFor } from '@lazycuh/http';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class PasswordResetVerificationService {
  constructor(private readonly _httpClient: HttpClient) {}

  resetPassword(verificationCode: string, payload: { password: string; turnstile: string }) {
    return firstValueFrom(
      this._httpClient.patch(
        `${__ORCHESTRATOR_URL__}/v1/users/me/reset/password`,
        { password: payload.password, verificationCode },
        {
          headers: { [getAliasFor('turnstileTokenHeader')]: payload.turnstile }
        }
      )
    );
  }
}
