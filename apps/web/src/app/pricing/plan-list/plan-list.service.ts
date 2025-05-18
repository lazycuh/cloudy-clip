import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { ResponseBody } from '@lazycuh/http/src';
import { Plan } from '@lazycuh/web-ui-common/entitlement';
import { firstValueFrom, map } from 'rxjs';

@Injectable()
export class PlanListService {
  private readonly _httpClient = inject(HttpClient);

  fetchAllPlans(): Promise<Plan[]> {
    return firstValueFrom(
      this._httpClient.get<ResponseBody<Plan[]>>(`${__ORCHESTRATOR_URL__}/v1/plans`).pipe(
        map(responseBody => {
          return responseBody.payload.map(plan => {
            plan.isFreePlan = plan.price === '0';

            return plan;
          });
        })
      )
    );
  }
}
