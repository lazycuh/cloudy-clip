import { Pipe, PipeTransform } from '@angular/core';
import { PlanEntitlement } from '@lazycuh/web-ui-common/entitlement';

@Pipe({
  name: 'entitlement'
})
export class EntitlementFormatterPipe implements PipeTransform {
  transform(entitlement: PlanEntitlement): string {
    switch (entitlement.type) {
      case 'WORD_COUNT':
        return entitlement.isRestricted
          ? $localize`Max ${entitlement.quantity} characters per journal entry`
          : $localize`No character count restriction`;
      case 'IMAGE_UPLOAD':
        return $localize`Ability to embed images`;
      case 'RETENTION_PERIOD':
        return entitlement.isRestricted
          ? $localize`${entitlement.quantity} days data storage`
          : $localize`Lifetime data storage`;

      default:
        // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
        throw new Error(`unknown entitlement type '${entitlement.type}'`);
    }
  }
}
