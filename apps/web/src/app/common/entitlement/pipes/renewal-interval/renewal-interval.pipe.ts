import { Pipe, PipeTransform } from '@angular/core';
import { Plan } from '@lazycuh/web-ui-common/entitlement';

@Pipe({
  name: 'renewalInterval'
})
export class RenewalIntervalPipe implements PipeTransform {
  transform(value: Plan['renewedIn']): string {
    switch (value) {
      case '1m':
        return $localize`month`;
      case '1y':
        return $localize`year`;

      default:
        // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
        throw new Error(`unrecognized renewal interval '${value}'`);
    }
  }
}
