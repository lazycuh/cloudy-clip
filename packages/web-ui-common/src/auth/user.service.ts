import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { ResponseBody } from '@lazycuh/http/src';
import { executeUntil } from '@lazycuh/execute-until';
import { Logger } from '@lazycuh/logging';
import { Optional } from '@lazycuh/optional';
import { BehaviorSubject, firstValueFrom } from 'rxjs';

import { AuthenticatedUser } from './models';

@Injectable({
  providedIn: 'root'
})
export class UserService {
  private readonly _httpClient = inject(HttpClient);
  private readonly _userLoginStatusChanges = new BehaviorSubject(false);

  private _sessionRestorationRequestInProgress = false;
  private _authenticatedUser: AuthenticatedUser | null = null;

  constructor() {
    /* istanbul ignore if -- @preserve */
    if (!__IS_TEST__) {
      void this.restoreSession();
    }
  }

  /**
   * Restore user session
   *
   * @param forceRefresh Whether to force refresh the session by making a new request to the server
   *
   * @returns Whether the session restoration is successful
   */
  async restoreSession(forceRefresh = false) {
    if (!forceRefresh && this.isUserAlreadyLoggedIn()) {
      return true;
    }

    if (this._sessionRestorationRequestInProgress) {
      await executeUntil(() => !this._sessionRestorationRequestInProgress);

      this._sessionRestorationRequestInProgress = false;

      return this.isUserAlreadyLoggedIn();
    }

    this._sessionRestorationRequestInProgress = true;

    try {
      const responseBody = await firstValueFrom(
        this._httpClient.get<ResponseBody<AuthenticatedUser>>(`${__ORCHESTRATOR_URL__}/v1/users/me/sessions/my`)
      );

      this._sessionRestorationRequestInProgress = false;

      this._authenticatedUser = responseBody.payload;
      this._userLoginStatusChanges.next(true);

      return true;
    } catch (error) {
      if ((error as HttpErrorResponse).status !== 404) {
        new Logger('UserService').error('failed to restore user session', error);
      }

      this._sessionRestorationRequestInProgress = false;

      return false;
    }
  }

  async signOut() {
    sessionStorage.clear();

    this._authenticatedUser = null;

    this._userLoginStatusChanges.next(false);

    await firstValueFrom(this._httpClient.delete(`${__ORCHESTRATOR_URL__}/v1/users/me/sessions/my`));
  }

  isUserAlreadyLoggedIn() {
    return this._authenticatedUser !== null;
  }

  getAuthenticatedUser() {
    if (this._authenticatedUser !== null) {
      return this._authenticatedUser;
    }

    throw new Error('no logged-in user');
  }

  getCurrentUserEmail() {
    return this.getAuthenticatedUser().email;
  }

  findAuthenticatedUser() {
    return Optional.of(this._authenticatedUser);
  }

  findCurrentUserEmail() {
    return this.findAuthenticatedUser().map(user => user.email);
  }

  loginStatusChanges() {
    return this._userLoginStatusChanges.asObservable();
  }

  updateAuthenticatedUser(user: AuthenticatedUser) {
    this._authenticatedUser = user;
    this._userLoginStatusChanges.next(true);
  }
}
