import { DOCUMENT } from '@angular/common';
import { effect, inject, signal, WritableSignal } from '@angular/core';
import { isBrowser } from '@lazycuh/web-ui-common/utils/is-browser';

export function queryParamSignal<T extends string>(paramName: string, defaultValue?: T): WritableSignal<T> {
  const paramSignal = signal(
    (new URLSearchParams(resolveSearchParamString()).get(paramName) ?? defaultValue ?? '') as T
  );

  effect(() => {
    if (!isBrowser()) {
      return;
    }

    const searchParams = new URLSearchParams(window.location.search);

    if (paramSignal()) {
      searchParams.set(paramName, paramSignal());
      window.history.replaceState(
        null,
        '',
        `${window.location.pathname}${window.location.hash.split('?')[0]}?${searchParams.toString()}`
      );
    }
  });

  return paramSignal;
}

function resolveSearchParamString() {
  const document = inject(DOCUMENT);

  if (document.location.hash === '') {
    return document.location.search;
  }

  const hashParts = document.location.hash.split('?');

  return hashParts.length === 2 ? `?${hashParts[1]}` : '';
}
