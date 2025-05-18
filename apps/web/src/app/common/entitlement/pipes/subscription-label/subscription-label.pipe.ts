import { Pipe, PipeTransform } from '@angular/core';
import { Plan } from '@lazycuh/web-ui-common/entitlement';

@Pipe({
  name: 'subscriptionLabel'
})
export class SubscriptionLabelPipe implements PipeTransform {
  transform(plan: Plan): string {
    return `${plan.displayName} (${this._formatIntervalLabel(plan)})`;
  }

  private _formatIntervalLabel(plan: Plan) {
    switch (plan.renewedIn) {
      case '1m':
        return $localize`Monthly`;
      case '1y':
        return $localize`Yearly`;

      default:
        throw new Error(`unrecognized renewal interval '${String(plan.renewedIn)}'`);
    }
  }
}
