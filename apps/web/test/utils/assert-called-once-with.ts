/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { expect, MockInstance } from 'vitest';

// @ts-expect-error This is fine
// eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
export function assertCalledOnceWith<T extends Function>(fn: T | MockInstance<T>, ...args: any[]): void {
  expect(fn).toHaveBeenCalledOnce();
  expect(fn).toHaveBeenCalledWith(...args);
}
