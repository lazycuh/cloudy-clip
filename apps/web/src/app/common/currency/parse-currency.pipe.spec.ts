import { describe, expect, it } from 'vitest';

import { ParseCurrencyPipe } from './parse-currency.pipe';

describe(ParseCurrencyPipe.name, () => {
  it('create an instance', () => {
    const pipe = new ParseCurrencyPipe();
    expect(pipe).toBeTruthy();
  });
});
