import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
  ViewEncapsulation
} from '@angular/core';
import { Router } from '@angular/router';
import { Logger } from '@lazycuh/logging';
import { ButtonToggleComponent, ButtonToggleGroupComponent } from '@lazycuh/web-ui-common/button-toggle';
import { CurvedUnderlineComponent } from '@lazycuh/web-ui-common/curved-underline';
import { Plan } from '@lazycuh/web-ui-common/entitlement';
import { PulseLoaderComponent } from '@lazycuh/web-ui-common/pulse-loader';
import { getErrorInfo } from '@lazycuh/web-ui-common/utils/get-error-info';
import { getErrorPagePath } from '@lazycuh/web-ui-common/utils/get-error-page-path';

import { queryParamSignal } from '@common/query-param-signal';

import { CheckoutSession } from '../models';
import { PlanItemComponent } from '../plan-item';

import { PlanListService } from './plan-list.service';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'plan-list'
  },
  imports: [
    PlanItemComponent,
    PulseLoaderComponent,
    CurvedUnderlineComponent,
    ButtonToggleGroupComponent,
    ButtonToggleComponent
  ],
  providers: [PlanListService],
  selector: 'lc-plan-list',
  styleUrl: './plan-list.component.scss',
  templateUrl: './plan-list.component.html'
})
export class PlanListComponent {
  protected readonly _plans = signal<Plan[]>([]);
  protected readonly _freePlan = computed(() => this._plans().find(plan => plan.isFreePlan)!);
  protected readonly _selectedRenewalInterval = queryParamSignal<Plan['renewedIn']>('interval', '1m');

  private readonly _router = inject(Router);
  private readonly _planGroupMap = new Map<Plan['renewedIn'], Plan[]>();

  constructor() {
    const planListService = inject(PlanListService);

    afterNextRender({
      write: () => {
        planListService
          .fetchAllPlans()
          .then(plans => {
            for (const plan of plans) {
              if (!this._planGroupMap.has(plan.renewedIn)) {
                this._planGroupMap.set(plan.renewedIn, []);
              }

              this._planGroupMap.get(plan.renewedIn)!.push(plan);
            }

            this._planGroupMap.forEach(group => {
              group.sort((a, b) => Number(a.price) - Number(b.price));
            });

            this._plans.set(this._planGroupMap.get(this._selectedRenewalInterval())!);
          })
          .catch((error: unknown) => {
            const errorInfo = getErrorInfo(error);

            new Logger('PlanListComponent').error('failed to fetch plans', errorInfo);

            void this._router.navigateByUrl(getErrorPagePath('unknown'), {
              skipLocationChange: true,
              state: {
                requestId: errorInfo.payload.requestId
              }
            });
          });
      }
    });
  }

  protected _onChangeRenewalInterval(selectedPlan: Plan) {
    void this._router.navigateByUrl('/checkout', {
      state: {
        checkoutSession: new CheckoutSession(selectedPlan, 'RENEWAL_INTERVAL_CHANGE')
      }
    });
  }

  protected _onDowngrade(selectedPlan: Plan) {
    void this._router.navigateByUrl('/checkout', {
      state: {
        checkoutSession: new CheckoutSession(selectedPlan, 'DOWNGRADE')
      }
    });
  }

  protected _onSubscribeToPlan(selectedPlan: Plan) {
    void this._router.navigateByUrl('/checkout', {
      state: {
        checkoutSession: new CheckoutSession(selectedPlan, 'NEW_SUBSCRIPTION')
      }
    });
  }

  protected _onUpgrade(selectedPlan: Plan) {
    void this._router.navigateByUrl('/checkout', {
      state: {
        checkoutSession: new CheckoutSession(selectedPlan, 'UPGRADE')
      }
    });
  }

  protected _onShowMonthlyPlan() {
    this._selectedRenewalInterval.set('1m');
    this._plans.set(this._planGroupMap.get('1m') ?? []);
  }

  protected _onShowYearlyPlan() {
    this._selectedRenewalInterval.set('1y');
    this._plans.set(this._planGroupMap.get('1y') ?? []);
  }
}
