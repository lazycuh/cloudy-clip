import { ChangeDetectionStrategy, Component, input, ViewEncapsulation } from '@angular/core';
import { EntitlementType, PlanEntitlement } from '@lazycuh/web-ui-common/entitlement';
import { IconComponent } from '@lazycuh/web-ui-common/icon';

import { EntitlementFormatterPipe } from './pipes';

const entitlementOrder: Record<EntitlementType, number> = {
  WORD_COUNT: 0,
  // eslint-disable-next-line sort-keys-fix/sort-keys-fix
  RETENTION_PERIOD: 1,
  // eslint-disable-next-line sort-keys-fix/sort-keys-fix
  IMAGE_UPLOAD: 2
};

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  imports: [IconComponent, EntitlementFormatterPipe],
  selector: 'lc-entitlement-list',
  styleUrl: './entitlement-list.component.scss',
  templateUrl: './entitlement-list.component.html'
})
export class EntitlementListComponent {
  readonly entitlements = input.required<PlanEntitlement[], PlanEntitlement[]>({
    transform: (entitlements: PlanEntitlement[]) => {
      return entitlements
        .map(entitlement => {
          entitlement.enabled = !entitlement.isRestricted || entitlement.quantity !== 0;

          return entitlement;
        })
        .sort((left, right) => {
          return entitlementOrder[left.type] - entitlementOrder[right.type];
        });
    }
  });
}
