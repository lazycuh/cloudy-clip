/* eslint-disable @stylistic/quotes */
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';

import { configureTestingModuleForService, convertToResponsePayload, startMockingApiRequests } from 'test/utils';

import { Payment } from '../models';

import { BillingService, MY_PAYMENTS_ENDPOINT } from './billing.service';

describe(BillingService.name, () => {
  const apiRequestMockServer = startMockingApiRequests();

  let service: BillingService;

  beforeEach(() => {
    service = configureTestingModuleForService(BillingService);
  });

  it('#getPayments() returns a list of payments', async () => {
    const expectedPayments: Payment[] = [
      {
        amountDue: '1',
        currencyCode: 'usd',
        discount: '0',
        failureReason: null,
        paidAt: new Date().toISOString(),
        paymentId: '1',
        paymentMethodBrand: 'visa',
        paymentMethodLast4: '0001',
        paymentReason: 'NEW_SUBSCRIPTION',
        status: 'PAID',
        subtotal: '1',
        tax: '0'
      },
      {
        amountDue: '2',
        currencyCode: 'usd',
        discount: '0',
        failureReason: null,
        paidAt: new Date().toISOString(),
        paymentId: '2',
        paymentMethodBrand: 'visa',
        paymentMethodLast4: '0002',
        paymentReason: 'NEW_SUBSCRIPTION',
        status: 'PAID',
        subtotal: '2',
        tax: '0'
      }
    ];
    apiRequestMockServer.resetHandlers(
      http.get(MY_PAYMENTS_ENDPOINT, ({ request }) => {
        if (!request.url.includes('offset=0') && !request.url.includes('limit=25')) {
          throw new Error('Request URL does not contain the expected query parameters');
        }

        return HttpResponse.json(convertToResponsePayload({ page: expectedPayments, total: 100 }));
      })
    );

    expect(await service.getPayments(0, 25)).toEqual({ page: expectedPayments, total: 100 });
  });

  it(`#getPaymentReceiptUrl() returns receipt's URL`, async () => {
    apiRequestMockServer.resetHandlers(
      http.get(`${MY_PAYMENTS_ENDPOINT}/1/receipt`, () => {
        return HttpResponse.json(convertToResponsePayload('http://example.com/receipt'));
      })
    );

    expect(await service.getPaymentReceiptUrl('1')).toEqual('http://example.com/receipt');
  });

  it('#findLatestPayment() returns latest payment', async () => {
    const latestPayment: Payment = {
      amountDue: '1',
      currencyCode: 'usd',
      discount: '0',
      failureReason: null,
      paidAt: new Date().toISOString(),
      paymentId: '1',
      paymentMethodBrand: 'visa',
      paymentMethodLast4: '0001',
      paymentReason: 'NEW_SUBSCRIPTION',
      status: 'PAID',
      subtotal: '1',
      tax: '0'
    };
    apiRequestMockServer.resetHandlers(
      http.get(MY_PAYMENTS_ENDPOINT, ({ request }) => {
        if (!request.url.includes('offset=0') && !request.url.includes('limit=1')) {
          throw new Error('Request URL does not contain the expected query parameters');
        }

        return HttpResponse.json(convertToResponsePayload({ page: [latestPayment], total: 1 }));
      })
    );

    expect((await service.findLatestPayment()).orElseThrow()).toEqual(latestPayment);
  });
});
