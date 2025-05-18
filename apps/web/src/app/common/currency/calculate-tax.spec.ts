import { describe, expect, it } from 'vitest';

import { calculateTax } from './calculate-tax';

describe('calculateTax()', () => {
  it('Returns correct value', () => {
    expect(calculateTax(100, 10).toString()).toEqual('0.10');
    expect(calculateTax('25', 10).toString()).toEqual('0.03');
    expect(calculateTax(30, '5').toString()).toEqual('0.02');
    expect(calculateTax('1234', '5').toString()).toEqual('0.62');
  });
});
