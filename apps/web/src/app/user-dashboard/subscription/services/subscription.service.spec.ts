import { HttpClient } from '@angular/common/http';
import { http, HttpResponse } from 'msw';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  assertCalledOnceWith,
  configureTestingModuleForService,
  convertToResponsePayload,
  startMockingApiRequests
} from 'test/utils';

import { UpcomingPayment } from '../models';

import { SubscriptionService } from './subscription.service';

describe(SubscriptionService.name, () => {
  const apiRequestMockServer = startMockingApiRequests();

  let service: SubscriptionService;

  beforeEach(() => {
    service = configureTestingModuleForService(SubscriptionService);
  });

  it('#getSubscriptionCancellationRefund() returns refund amount', async () => {
    apiRequestMockServer.resetHandlers(
      http.get(`${__ORCHESTRATOR_URL__}/v1/subscriptions/my/cancellation`, () => {
        return HttpResponse.json(convertToResponsePayload(100));
      })
    );

    expect(await service.getSubscriptionCancellationRefund()).toEqual(100);

    expect(HttpClient.prototype.get).toHaveBeenCalledOnce();
  });

  it('#cancelSubscription() calls the right endpoint', async () => {
    vi.spyOn(HttpClient.prototype, 'delete').mockReturnValue(of({}));

    await service.cancelSubscription();

    assertCalledOnceWith(HttpClient.prototype.delete, `${__ORCHESTRATOR_URL__}/v1/subscriptions/my`);
  });

  it('#reactivateSubscription() calls the right endpoint', async () => {
    vi.spyOn(HttpClient.prototype, 'post').mockReturnValue(of({}));

    await service.reactivateFreeSubscription();

    assertCalledOnceWith(HttpClient.prototype.post, `${__ORCHESTRATOR_URL__}/v1/subscriptions/my/reactivate`, {});
  });

  it('#getUpcomingPayment() returns upcoming payment', async () => {
    const upcomingPayment: UpcomingPayment = {
      amountDue: '1234',
      currencyCode: 'usd',
      discount: '0',
      dueDate: new Date().toISOString(),
      subtotal: '1000',
      tax: '234',
      taxPercentage: '23.4'
    };

    apiRequestMockServer.resetHandlers(
      http.get(`${__ORCHESTRATOR_URL__}/v1/billing/my/upcoming-payment`, () => {
        return HttpResponse.json(convertToResponsePayload(upcomingPayment));
      })
    );

    expect(await service.getUpcomingPayment()).toEqual(upcomingPayment);

    expect(HttpClient.prototype.get).toHaveBeenCalledOnce();
  });
});
