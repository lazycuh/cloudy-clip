import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import * as executeUntilModule from '@lazycuh/execute-until';
import { ExceptionCode, getAliasFor } from '@lazycuh/http/src';
import { http, HttpResponse } from 'msw';
import { PaymentMethod } from 'src/app/user-dashboard/payment-method-list/models';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  assertCalledOnceWith,
  configureTestingModuleForService,
  convertToResponsePayload,
  startMockingApiRequests
} from 'test/utils';

import { CheckoutPreviewResponse, NewSubscriptionCheckoutRequest } from '../models';

import { CheckoutService } from './checkout.service';

vi.mock('@lazycuh/execute-until', async () => {
  const actual = await vi.importActual('@lazycuh/execute-until');

  return {
    ...actual
  };
});

describe(CheckoutService.name, () => {
  const apiRequestMockServer = startMockingApiRequests();
  const nonDefaultPaymentMethod: PaymentMethod = {
    brand: 'visa',
    expMonth: '4',
    expYear: '2034',
    isDefault: false,
    last4: '4242',
    paymentMethodId: 'pm_1QqUkCIWw5KeSeJEUQ9VNpnc'
  };

  let service: CheckoutService;

  beforeEach(() => {
    service = configureTestingModuleForService(CheckoutService);
  });

  it('#getBillingInfo() returns correct data', async () => {
    apiRequestMockServer.resetHandlers(
      http.get(`${__ORCHESTRATOR_URL__}/v1/billing/my/info`, () => {
        return HttpResponse.json(convertToResponsePayload({ countryCode: 'US', postalCode: '99301' }));
      })
    );

    expect((await service.findBillingInfo()).orElseThrow()).toEqual({ countryCode: 'US', postalCode: '99301' });
  });

  it('#findBillingInfo() returns empty optional on 404', async () => {
    apiRequestMockServer.resetHandlers(
      http.get(`${__ORCHESTRATOR_URL__}/v1/billing/my/info`, () => {
        return new HttpResponse(null, { status: 404 });
      })
    );

    expect((await service.findBillingInfo()).isEmpty()).toEqual(true);
  });

  it('#findBillingInfo() throws when endpoint returns an error', async () => {
    apiRequestMockServer.resetHandlers(
      http.get(`${__ORCHESTRATOR_URL__}/v1/billing/my/info`, () => {
        return new HttpResponse(null, { status: 500 });
      })
    );

    await expect(service.findBillingInfo()).rejects.toThrowError(
      'Http failure response for http://localhost:4300/api/v1/billing/my/info: 500 Internal Server Error'
    );
  });

  it('#checkOutNewSubscription() calls the right endpoint', async () => {
    const responsePayload = {
      checkoutResponse: {
        amountDue: '1234',
        clientSecret: 'secret',
        discount: '0',
        tax: '0',
        taxPercentage: '0.00'
      },
      taskId: 'task-id'
    };

    apiRequestMockServer.resetHandlers(
      http.post(`${__ORCHESTRATOR_URL__}/v1/checkout`, () => {
        return HttpResponse.json(convertToResponsePayload(responsePayload));
      })
    );

    const checkoutRequest: NewSubscriptionCheckoutRequest = {
      countryCode: 'US',
      couponCode: 'coupon',
      fullName: 'Hello World',
      offeringId: '1234',
      postalCode: '99301'
    };

    expect(await service.checkOutNewSubscription(checkoutRequest, 'turnstile')).toEqual(responsePayload);

    assertCalledOnceWith(HttpClient.prototype.post, `${__ORCHESTRATOR_URL__}/v1/checkout`, checkoutRequest, {
      headers: { [getAliasFor('turnstileTokenHeader')]: 'turnstile' }
    });
  });

  it('#reactivatePaidSubscription() return true when task status is SUCCESS', async () => {
    const taskId = 'task-id';

    apiRequestMockServer.resetHandlers(
      http.post(`${__ORCHESTRATOR_URL__}/v1/subscriptions/my/reactivate`, () => {
        return HttpResponse.json(convertToResponsePayload(taskId));
      }),
      http.get(`${__ORCHESTRATOR_URL__}/v1/tasks/${taskId}`, () => {
        return HttpResponse.json(convertToResponsePayload({ status: 'SUCCESS' }));
      })
    );

    expect(await service.reactivatePaidSubscription(nonDefaultPaymentMethod)).toEqual(true);
  });

  it('#reactivatePaidSubscription() includes provided payment method ID in body if card id not a default', async () => {
    const taskId = 'task-id';

    apiRequestMockServer.resetHandlers(
      http.post(`${__ORCHESTRATOR_URL__}/v1/subscriptions/my/reactivate`, async ({ request }) => {
        const clonedRequest = request.clone();
        const requestBody = (await clonedRequest.json()) as { offeringId: string; paymentMethodId: string };

        expect(requestBody.paymentMethodId, 'Request body does not contain expected paymentMethodId').toEqual(
          nonDefaultPaymentMethod.paymentMethodId
        );

        return HttpResponse.json(convertToResponsePayload(taskId));
      }),
      http.get(`${__ORCHESTRATOR_URL__}/v1/tasks/${taskId}`, () => {
        return HttpResponse.json(convertToResponsePayload({ status: 'SUCCESS' }));
      })
    );

    expect(await service.reactivatePaidSubscription(nonDefaultPaymentMethod)).toEqual(true);
  });

  it('#reactivatePaidSubscription() return false when task status is not SUCCESS', async () => {
    vi.spyOn(executeUntilModule, 'executeUntil');
    vi.useFakeTimers();

    const taskId = 'task-id';

    apiRequestMockServer.resetHandlers(
      http.post(`${__ORCHESTRATOR_URL__}/v1/subscriptions/my/reactivate`, () => {
        return HttpResponse.json(convertToResponsePayload(taskId));
      }),
      http.get(`${__ORCHESTRATOR_URL__}/v1/tasks/${taskId}`, () => {
        return HttpResponse.json(convertToResponsePayload({ status: 'FAILURE' }));
      })
    );

    const promise = service.reactivatePaidSubscription(nonDefaultPaymentMethod);

    vi.advanceTimersByTime(35_000);

    expect(await promise).toEqual(false);

    assertCalledOnceWith(executeUntilModule.executeUntil, expect.any(Function), {
      delayMs: 250,
      timeoutMs: 30_000
    });

    vi.useRealTimers();
  });

  it('#previewCheckout() returns correct data', async () => {
    const offeringId = '1234';
    const checkoutPreviewResponse: CheckoutPreviewResponse = {
      amountDue: '1234',
      currencyCode: 'usd',
      discount: '0',
      refund: '0',
      storedPaymentMethods: [],
      subtotal: '1234',
      tax: '0',
      taxPercentage: '0.00'
    };

    apiRequestMockServer.resetHandlers(
      http.get(`${__ORCHESTRATOR_URL__}/v1/checkout/preview`, ({ request }) => {
        expect(request.url, 'Request URL does not contain expected offeringId query param').toContain(
          `?offeringId=${offeringId}`
        );

        return HttpResponse.json(convertToResponsePayload(checkoutPreviewResponse));
      })
    );

    expect(await service.previewCheckout(offeringId)).toEqual(checkoutPreviewResponse);
  });

  it('#updatePaidSuscription() includes provided payment method ID in body', async () => {
    const offeringId = 'offering-id';
    const taskId = 'task-id';

    apiRequestMockServer.resetHandlers(
      http.put(`${__ORCHESTRATOR_URL__}/v1/subscriptions/my`, async ({ request }) => {
        const clonedRequest = request.clone();
        const requestBody = (await clonedRequest.json()) as { offeringId: string; paymentMethodId: string };

        expect(requestBody.offeringId, 'Request body does not contain expected offeringId').toEqual(offeringId);
        expect(requestBody.paymentMethodId, 'Request body does not contain expected paymentMethodId').toEqual(
          nonDefaultPaymentMethod.paymentMethodId
        );

        return HttpResponse.json(convertToResponsePayload(taskId));
      }),
      http.get(`${__ORCHESTRATOR_URL__}/v1/tasks/${taskId}`, () => {
        return HttpResponse.json(convertToResponsePayload({ status: 'SUCCESS' }));
      })
    );

    expect(await service.updatePaidSuscription(offeringId, nonDefaultPaymentMethod)).toEqual(true);
  });

  it('#updatePaidSuscription() throws when backend returns an error', async () => {
    const offeringId = 'offering-id';

    apiRequestMockServer.resetHandlers(
      http.put(`${__ORCHESTRATOR_URL__}/v1/subscriptions/my`, () => {
        return HttpResponse.json(convertToResponsePayload({ code: ExceptionCode.FAILED_PAYMENT }, 'failed payment'), {
          status: 402
        });
      })
    );

    await expect(service.updatePaidSuscription(offeringId, nonDefaultPaymentMethod)).rejects.toThrowError(
      expect.any(HttpErrorResponse)
    );
  });

  it('#updatePaidSuscription() return true when task status is SUCCESS', async () => {
    const offeringId = 'offering-id';
    const taskId = 'task-id';

    apiRequestMockServer.resetHandlers(
      http.put(`${__ORCHESTRATOR_URL__}/v1/subscriptions/my`, () => {
        return HttpResponse.json(convertToResponsePayload(taskId));
      }),
      http.get(`${__ORCHESTRATOR_URL__}/v1/tasks/${taskId}`, () => {
        return HttpResponse.json(convertToResponsePayload({ status: 'SUCCESS' }));
      })
    );

    expect(await service.updatePaidSuscription(offeringId, nonDefaultPaymentMethod)).toEqual(true);
  });

  it('#updatePaidSuscription() return false when task status is not SUCCESS', async () => {
    vi.spyOn(executeUntilModule, 'executeUntil');
    vi.useFakeTimers();

    const offeringId = 'offering-id';
    const taskId = 'task-id';

    apiRequestMockServer.resetHandlers(
      http.put(`${__ORCHESTRATOR_URL__}/v1/subscriptions/my`, () => {
        return HttpResponse.json(convertToResponsePayload(taskId));
      }),
      http.get(`${__ORCHESTRATOR_URL__}/v1/tasks/${taskId}`, () => {
        return HttpResponse.json(convertToResponsePayload({ status: 'FAILURE' }));
      })
    );

    const promise = service.updatePaidSuscription(offeringId, nonDefaultPaymentMethod);

    vi.advanceTimersByTime(35_000);

    expect(await promise).toEqual(false);

    assertCalledOnceWith(executeUntilModule.executeUntil, expect.any(Function), {
      delayMs: 250,
      timeoutMs: 30_000
    });

    vi.useRealTimers();
  });
});
