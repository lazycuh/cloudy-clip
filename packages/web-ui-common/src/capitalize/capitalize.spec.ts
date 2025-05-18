import { describe, expect, it } from 'vitest';

import { capitalize } from './capitalize';

describe('capitalize()', () => {
  it('Should convert to title case', () => {
    expect(capitalize('hello')).toEqual('Hello');
    expect(capitalize('Hello')).toEqual('Hello');
    expect(capitalize('HELLO')).toEqual('Hello');
  });

  it('Return empty string if input string is empty', () => {
    expect(capitalize('')).toEqual('');
  });
});
