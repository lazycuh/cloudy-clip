export function isBrowser() {
  return typeof globalThis.document === 'object';
}
