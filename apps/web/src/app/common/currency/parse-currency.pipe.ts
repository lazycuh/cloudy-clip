import { Pipe, PipeTransform } from '@angular/core';

import { parseCurrency } from './parse-currency';

@Pipe({
  name: 'parseCurrency'
})
export class ParseCurrencyPipe implements PipeTransform {
  transform(value: number | string): string {
    return parseCurrency(value).toString();
  }
}
