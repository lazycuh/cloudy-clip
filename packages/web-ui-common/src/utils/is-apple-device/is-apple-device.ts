import { isBrowser } from '../is-browser';

export function isAppleDevice() {
  if (isBrowser()) {
    const userAgent = window.navigator.userAgent;

    return /Mac|iPhone|iPad|iPod/.test(userAgent);
  }

  return false;
}
