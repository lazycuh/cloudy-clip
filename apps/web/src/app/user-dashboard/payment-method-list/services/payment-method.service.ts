import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { ResponseBody } from '@lazycuh/http/src';
import { firstValueFrom, map } from 'rxjs';

import { PaymentMethod } from '../models';

@Injectable()
export class PaymentMethodService {
  private readonly _httpClient = inject(HttpClient);

  getAllPaymentMethods() {
    return firstValueFrom(
      this._httpClient
        .get<ResponseBody<PaymentMethod[]>>(`${__ORCHESTRATOR_URL__}/v1/billing/my/payment-methods`)
        .pipe(map(responseBody => responseBody.payload))
    );
  }

  getUrlToPageForAddingPaymentMethod(returnUrlPath = '/my/payment-methods') {
    const url = `${__ORCHESTRATOR_URL__}/v1/billing/my/management/page/payment-method?returnUrlPath=${returnUrlPath}`;

    return firstValueFrom(
      this._httpClient.get<ResponseBody<string>>(url).pipe(map(responseBody => responseBody.payload))
    );
  }

  setPaymentMethodAsDefault(paymentMethodId: string) {
    return firstValueFrom(
      this._httpClient.patch(`${__ORCHESTRATOR_URL__}/v1/billing/my/payment-methods/${paymentMethodId}/default`, null)
    );
  }

  removePaymentMethod(paymentMethodId: string) {
    return firstValueFrom(
      this._httpClient.delete(`${__ORCHESTRATOR_URL__}/v1/billing/my/payment-methods/${paymentMethodId}`)
    );
  }
}
