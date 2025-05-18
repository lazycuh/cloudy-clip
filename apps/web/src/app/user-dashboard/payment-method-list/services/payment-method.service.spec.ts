import { HttpClient } from '@angular/common/http';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';

import {
  assertCalledOnceWith,
  configureTestingModuleForService,
  convertToResponsePayload,
  startMockingApiRequests
} from 'test/utils';

import { PaymentMethod } from '../models';

import { PaymentMethodService } from './payment-method.service';

describe(PaymentMethodService.name, () => {
  const apiRequestMockServer = startMockingApiRequests();

  let service: PaymentMethodService;

  beforeEach(() => {
    service = configureTestingModuleForService(PaymentMethodService);
  });

  it('#getAllPaymentMethods() calls the right endpoint', async () => {
    const paymentMethods: PaymentMethod[] = [
      {
        brand: 'visa',
        expMonth: '4',
        expYear: '2034',
        isDefault: true,
        last4: '4242',
        paymentMethodId: 'pm_1QqUkCIWw5KeSeJEUQ9VNpnc'
      }
    ];

    apiRequestMockServer.resetHandlers(
      http.get(`${__ORCHESTRATOR_URL__}/v1/billing/my/payment-methods`, () => {
        return HttpResponse.json(convertToResponsePayload(paymentMethods));
      })
    );

    expect(await service.getAllPaymentMethods()).toEqual(paymentMethods);
  });

  it('#getUrlToPageForAddingPaymentMethod() calls the right endpoint', async () => {
    const url = 'https://example.com';

    apiRequestMockServer.resetHandlers(
      http.get(`${__ORCHESTRATOR_URL__}/v1/billing/my/management/page/payment-method`, () => {
        return HttpResponse.json(convertToResponsePayload(url));
      })
    );

    expect(await service.getUrlToPageForAddingPaymentMethod()).toEqual(url);
  });

  it('#setPaymentMethodAsDefault() calls correct endpoint', async () => {
    apiRequestMockServer.resetHandlers(
      http.patch(`${__ORCHESTRATOR_URL__}/v1/billing/my/payment-methods/1/default`, () => {
        return new HttpResponse(null, { status: 204 });
      })
    );

    await service.setPaymentMethodAsDefault('1');

    assertCalledOnceWith(HttpClient.prototype.patch, expect.any(String), null);
  });

  it('#removePaymentMethod() calls correct endpoint', async () => {
    apiRequestMockServer.resetHandlers(
      http.delete(`${__ORCHESTRATOR_URL__}/v1/billing/my/payment-methods/1`, () => {
        return new HttpResponse(null, { status: 204 });
      })
    );

    await service.removePaymentMethod('1');

    assertCalledOnceWith(HttpClient.prototype.delete, expect.any(String));
  });
});
