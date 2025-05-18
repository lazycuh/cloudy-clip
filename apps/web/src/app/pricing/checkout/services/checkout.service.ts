import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { executeUntil } from '@lazycuh/execute-until';
import { getAliasFor, ResponseBody } from '@lazycuh/http';
import { Optional } from '@lazycuh/optional';
import { catchError, firstValueFrom, map, of } from 'rxjs';
import { PaymentMethod } from 'src/app/user-dashboard/payment-method-list/models';

import { Task, TaskService } from '@common/task';

import {
  BillingInfo,
  CheckoutPreviewResponse,
  NewSubscriptionCheckoutRequest,
  NewSubscriptionCheckoutResponse
} from '../models';

type BillingInfoResponsePayload = Exclude<BillingInfo, 'fullName'>;

@Injectable()
export class CheckoutService {
  private readonly _httpClient = inject(HttpClient);
  private readonly _taskService = inject(TaskService);

  async findBillingInfo() {
    return firstValueFrom(
      this._httpClient.get<ResponseBody<BillingInfoResponsePayload>>(`${__ORCHESTRATOR_URL__}/v1/billing/my/info`).pipe(
        map(responseBody => Optional.of(responseBody.payload)),
        catchError(error => {
          if (error instanceof HttpErrorResponse && error.status === 404) {
            return of(Optional.empty<BillingInfoResponsePayload>());
          }

          throw error;
        })
      )
    );
  }

  async checkOutNewSubscription(checkoutRequest: NewSubscriptionCheckoutRequest, turnstile: string) {
    type Response = ResponseBody<{ checkoutResponse: NewSubscriptionCheckoutResponse; taskId: string }>;

    const url = `${__ORCHESTRATOR_URL__}/v1/checkout`;

    return firstValueFrom(
      this._httpClient
        .post<Response>(url, checkoutRequest, { headers: { [getAliasFor('turnstileTokenHeader')]: turnstile } })
        .pipe(map(responseBody => responseBody.payload))
    );
  }

  async reactivatePaidSubscription(selectedPaymentMethod: PaymentMethod) {
    const url = `${__ORCHESTRATOR_URL__}/v1/subscriptions/my/reactivate`;
    const taskId = await firstValueFrom(
      this._httpClient
        .post<ResponseBody<string>>(url, { paymentMethodId: selectedPaymentMethod.paymentMethodId })
        .pipe(map(responseBody => responseBody.payload))
    );

    let taskStatus!: Task['status'];

    await executeUntil(
      async () => {
        taskStatus = await this._taskService.getTaskStatus(taskId);

        return taskStatus !== 'IN_PROGRESS';
      },
      { delayMs: 250 }
    );

    return taskStatus === 'SUCCESS';
  }

  async previewCheckout(offeringId: string) {
    const url = `${__ORCHESTRATOR_URL__}/v1/checkout/preview?offeringId=${offeringId}`;

    return firstValueFrom(
      this._httpClient.get<ResponseBody<CheckoutPreviewResponse>>(url).pipe(map(responseBody => responseBody.payload))
    );
  }

  async updatePaidSuscription(offeringId: string, selectedPaymentMethod: PaymentMethod) {
    const taskId = await firstValueFrom(
      this._httpClient
        .put<ResponseBody<string>>(`${__ORCHESTRATOR_URL__}/v1/subscriptions/my`, {
          offeringId,
          paymentMethodId: selectedPaymentMethod.paymentMethodId
        })
        .pipe(map(responseBody => responseBody.payload))
    );

    let taskStatus!: Task['status'];

    await executeUntil(
      async () => {
        taskStatus = await this._taskService.getTaskStatus(taskId);

        return taskStatus !== 'IN_PROGRESS';
      },
      { delayMs: 250 }
    );

    return taskStatus === 'SUCCESS';
  }
}
