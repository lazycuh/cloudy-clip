import { parseCurrency } from './parse-currency';

export function calculateTax(amount: string | number, taxPercentage: string | number) {
  return parseCurrency(amount).multiply(taxPercentage).divide(100);
}
