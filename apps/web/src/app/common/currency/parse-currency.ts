import currency from 'currency.js';

export function parseCurrency(value: string | number) {
  return currency(value, { fromCents: true });
}
