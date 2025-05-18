import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { PaginationResult, ResponseBody } from '@lazycuh/http';
import { Optional } from '@lazycuh/optional';
import { firstValueFrom, map } from 'rxjs';

import { Payment } from '../models';

export const MY_PAYMENTS_ENDPOINT = `${__ORCHESTRATOR_URL__}/v1/billing/my/payments`;

@Injectable()
export class BillingService {
  private readonly _httpClient = inject(HttpClient);

  getPayments(offset: number, limit: number) {
    return firstValueFrom(
      this._httpClient
        .get<ResponseBody<PaginationResult<Payment>>>(`${MY_PAYMENTS_ENDPOINT}?offset=${offset}&limit=${limit}`)
        .pipe(map(responseBody => responseBody.payload))
    );
  }

  getPaymentReceiptUrl(paymentId: string) {
    return firstValueFrom(
      this._httpClient
        .get<ResponseBody<string>>(`${MY_PAYMENTS_ENDPOINT}/${paymentId}/receipt`)
        .pipe(map(responseBody => responseBody.payload))
    );
  }

  async findLatestPayment() {
    return firstValueFrom(
      this._httpClient
        .get<ResponseBody<PaginationResult<Payment>>>(`${MY_PAYMENTS_ENDPOINT}?offset=0&limit=1`)
        .pipe(map(responseBody => Optional.of(responseBody.payload.page[0])))
    );
  }
}
