import { Injectable } from '@angular/core';

import { isBrowser } from '../utils/is-browser';

import { AbstractStateStore, PERSISTENT_STORAGE_KEY } from './abstract-state-store';
import { GlobalState } from './global-state';

@Injectable({
  providedIn: 'root'
})
export class GlobalStateStore extends AbstractStateStore<GlobalState> {
  // eslint-disable-next-line @typescript-eslint/no-useless-constructor
  constructor() {
    super();
  }

  override getInitialState(): GlobalState {
    const serializedStates = isBrowser() ? localStorage.getItem(PERSISTENT_STORAGE_KEY) : null;

    if (serializedStates === null) {
      return {
        interceptedRoute: {
          path: '/',
          state: null
        }
      };
    }

    return JSON.parse(serializedStates) as GlobalState;
  }
}
