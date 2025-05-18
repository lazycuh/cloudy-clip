import { describe, expect, it } from 'vitest';

import { parseCurrency } from './parse-currency';

describe('parseCurrency()', () => {
  it('Parse currency as cents', () => {
    expect(parseCurrency('100').toString()).toEqual('1.00');
  });
});
