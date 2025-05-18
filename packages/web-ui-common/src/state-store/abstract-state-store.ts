import { BehaviorSubject, Observable } from 'rxjs';

import { isBrowser } from '../utils/is-browser';

export const PERSISTENT_STORAGE_KEY = '__StateStore__';

export abstract class AbstractStateStore<T extends object> {
  private readonly _stateSubscribers = new Map<string, BehaviorSubject<unknown>>();

  private readonly _states: T;

  /**
   *
   * @param initializationMap A hash of key->value mappings that can be used to calculate the initial states
   */
  constructor(initializationMap?: Record<string, unknown>) {
    this._states = this.getInitialState(initializationMap);
    this._initialize();
  }

  /**
   * Calculate the initial states
   *
   * @param initializationMap An optional hash of key->value mappings that can be used to calculate the initial states
   */
  abstract getInitialState(initializationMap?: Record<string, unknown>): T;

  private _initialize() {
    for (const [key, value] of Object.entries(this._states)) {
      const notifier = new BehaviorSubject(value);
      this._stateSubscribers.set(key, notifier);
      notifier.next(value);
    }
  }

  update<K extends keyof T>(newState: Pick<T, K>, options?: { persistent: boolean }) {
    for (const [k, v] of Object.entries(newState)) {
      this._stateSubscribers.get(k)?.next(v);
    }

    if (options?.persistent && isBrowser()) {
      const serializedState = localStorage.getItem(PERSISTENT_STORAGE_KEY);

      if (serializedState !== null) {
        const storedState = JSON.parse(serializedState) as Record<string, Json>;
        Object.assign(storedState, newState);
        localStorage.setItem(PERSISTENT_STORAGE_KEY, JSON.stringify(storedState));
      } else {
        localStorage.setItem(PERSISTENT_STORAGE_KEY, JSON.stringify(newState));
      }
    }
  }

  select<K extends keyof T>(key: K): Observable<T[K]> {
    const notifier = this._stateSubscribers.get(key as string);

    if (notifier) {
      return notifier.asObservable() as Observable<T[K]>;
    }

    throw new Error(`"${key as string}" is not found in state store`);
  }

  valueOf<K extends keyof T>(key: K): T[K] {
    const notifier = this._stateSubscribers.get(key as string);

    if (notifier) {
      return notifier.value as T[K];
    }

    throw new Error(`"${key as string}" is not found in state store`);
  }
}
