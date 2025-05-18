import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { ResponseBody } from '@lazycuh/http';
import { firstValueFrom, map } from 'rxjs';

import { UpcomingPayment } from '../models';

@Injectable()
export class SubscriptionService {
  private readonly _httpClient = inject(HttpClient);

  getSubscriptionCancellationRefund() {
    return firstValueFrom(
      this._httpClient
        .get<ResponseBody<number>>(`${__ORCHESTRATOR_URL__}/v1/subscriptions/my/cancellation`)
        .pipe(map(response => response.payload))
    );
  }

  cancelSubscription() {
    return firstValueFrom(this._httpClient.delete(`${__ORCHESTRATOR_URL__}/v1/subscriptions/my`));
  }

  reactivateFreeSubscription() {
    return firstValueFrom(this._httpClient.post(`${__ORCHESTRATOR_URL__}/v1/subscriptions/my/reactivate`, {}));
  }

  getUpcomingPayment() {
    return firstValueFrom(
      this._httpClient
        .get<ResponseBody<UpcomingPayment>>(`${__ORCHESTRATOR_URL__}/v1/billing/my/upcoming-payment`)
        .pipe(map(response => response.payload))
    );
  }
}
