/**
 * Used for flushing a waiting process. Should be invoked before any assertions to ensure
 * asynchronous state updates are flushed.
 *
 * Example usage:
 *
 * ```js
 *   await flushPromise();
 * ```
 */
export function flushPromise() {
  return new Promise(process.nextTick);
}
