import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { getAliasFor } from '@lazycuh/http';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class AccountRegistrationVerificationService {
  constructor(private readonly _httpClient: HttpClient) {}

  verifyAccountRegistrationCode(code: string, turnstile: string) {
    return firstValueFrom(
      this._httpClient.patch(`${__ORCHESTRATOR_URL__}/v1/users/me/verification?code=${code}`, null, {
        headers: { [getAliasFor('turnstileTokenHeader')]: turnstile }
      })
    );
  }
}
