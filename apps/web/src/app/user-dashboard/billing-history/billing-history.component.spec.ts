/* eslint-disable @stylistic/quotes */
/* eslint-disable max-len */
import { ExceptionCode } from '@lazycuh/http/src';
import { UserService } from '@lazycuh/web-ui-common/auth';
import { ProgressService } from '@lazycuh/web-ui-common/progress';
import { delayBy } from '@lazycuh/web-ui-common/utils/delay-by';
import { generateRandomString } from '@lazycuh/web-ui-common/utils/generate-random-string';
import { screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { delay, http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { LITE_MONTHLY_PLAN } from 'test/data';
import { assertCalledOnceWith, convertToResponsePayload, renderComponent, startMockingApiRequests } from 'test/utils';
import { generateAuthenticatedUser } from 'test/utils/generate-authenticated-user';

import { BillingHistoryComponent } from './billing-history.component';
import { Payment, PaymentStatus } from './models';
import { BillingService, MY_PAYMENTS_ENDPOINT } from './services';

describe(BillingHistoryComponent.name, () => {
  const apiRequestMockServer = startMockingApiRequests();

  beforeEach(() => {
    vi.spyOn(UserService.prototype, 'getAuthenticatedUser').mockReturnValue(
      generateAuthenticatedUser(LITE_MONTHLY_PLAN)
    );
  });

  async function assertRowCells(
    row: HTMLElement,
    date: string,
    amount: string,
    status: string,
    statusTooltip: string | RegExp | null,
    last4: string
  ) {
    expect(row.children[1]).toHaveTextContent(date);
    expect(row.children[2]).toHaveTextContent(amount);
    expect(row.children[3]).toHaveTextContent(status);
    expect(row.children[4]).toHaveTextContent(`××××-${last4}`);

    await delayBy(16);

    if (statusTooltip === null) {
      expect(row.children[3]!.querySelector('.info-tooltip')).toBeNull();
    } else {
      const user = userEvent.setup();
      await user.click(row.children[3]!.querySelector('.info-tooltip button')!);

      expect(screen.getByText(statusTooltip)).toBeInTheDocument();
    }
  }

  async function assertViewReceiptButtonPresentOrNot(paymentRow: HTMLElement, isPresent: boolean) {
    if (!isPresent) {
      expect(paymentRow.querySelector('button[aria-label="View receipt"]')).toBeNull();
    } else {
      const viewReceiptButton = paymentRow.querySelector('button[aria-label="View receipt"]')!;
      expect(viewReceiptButton.querySelector('path')).toHaveAttribute(
        'd',
        'M200-120q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h240q17 0 28.5 11.5T480-800q0 17-11.5 28.5T440-760H200v560h560v-240q0-17 11.5-28.5T800-480q17 0 28.5 11.5T840-440v240q0 33-23.5 56.5T760-120H200Zm560-584L416-360q-11 11-28 11t-28-11q-11-11-11-28t11-28l344-344H600q-17 0-28.5-11.5T560-800q0-17 11.5-28.5T600-840h200q17 0 28.5 11.5T840-800v200q0 17-11.5 28.5T800-560q-17 0-28.5-11.5T760-600v-104Z'
      );

      vi.spyOn(window, 'open').mockImplementation(() => null);
      vi.spyOn(BillingService.prototype, 'getPaymentReceiptUrl').mockResolvedValue('http://example.com/receipt');

      const user = userEvent.setup();
      await user.click(viewReceiptButton);

      expect(ProgressService.prototype.close).toHaveBeenCalledOnce();
    }
  }

  function assertCardBrandImage(paymentRow: HTMLElement, brand: string) {
    expect(paymentRow.children[4]!.firstElementChild!.firstElementChild).toHaveAttribute('src', `/images/${brand}.png`);
    expect(paymentRow.children[4]!.firstElementChild!.firstElementChild).toHaveAttribute('alt', `${brand}'s logo`);
  }

  function generatePayments(paymentStatus: PaymentStatus, failureReason: string | null = null): Payment[] {
    const brands = ['visa', 'mastercard', 'amex', 'discover'];

    return [
      {
        amountDue: '606',
        currencyCode: 'usd',
        discount: '0',
        failureReason,
        paidAt: '2025-02-06T12:07:57Z',
        paymentId: '6',
        paymentMethodBrand: brands[Math.trunc(Math.random() * brands.length)]!,
        paymentMethodLast4: '0606',
        paymentReason: 'SUBSCRIPTION_CANCELLATION',
        status: paymentStatus,
        subtotal: '606',
        tax: '0'
      },
      {
        amountDue: '505',
        currencyCode: 'usd',
        discount: '0',
        failureReason,
        paidAt: '2025-02-05T12:07:57Z',
        paymentId: '5',
        paymentMethodBrand: brands[Math.trunc(Math.random() * brands.length)]!,
        paymentMethodLast4: '0505',
        paymentReason: 'SUBSCRIPTION_RENEWAL',
        status: paymentStatus,
        subtotal: '505',
        tax: '0'
      },
      {
        amountDue: '404',
        currencyCode: 'usd',
        discount: '0',
        failureReason,
        paidAt: '2025-02-04T12:07:57Z',
        paymentId: '4',
        paymentMethodBrand: brands[Math.trunc(Math.random() * brands.length)]!,
        paymentMethodLast4: '0404',
        paymentReason: 'SUBSCRIPTION_REACTIVATION',
        status: paymentStatus,
        subtotal: '404',
        tax: '0'
      },
      {
        amountDue: '303',
        currencyCode: 'usd',
        discount: '0',
        failureReason,
        paidAt: '2025-02-03T12:07:57Z',
        paymentId: '3',
        paymentMethodBrand: brands[Math.trunc(Math.random() * brands.length)]!,
        paymentMethodLast4: '0303',
        paymentReason: 'SUBSCRIPTION_DOWNGRADE',
        status: paymentStatus,
        subtotal: '303',
        tax: '0'
      },
      {
        amountDue: '202',
        currencyCode: 'usd',
        discount: '0',
        failureReason,
        paidAt: '2025-02-02T12:07:57Z',
        paymentId: '2',
        paymentMethodBrand: brands[Math.trunc(Math.random() * brands.length)]!,
        paymentMethodLast4: '0202',
        paymentReason: 'SUBSCRIPTION_UPGRADE',
        status: paymentStatus,
        subtotal: '202',
        tax: '0'
      },
      {
        amountDue: '101',
        currencyCode: 'usd',
        discount: '0',
        failureReason,
        paidAt: '2025-02-01T12:07:57Z',
        paymentId: '1',
        paymentMethodBrand: brands[Math.trunc(Math.random() * brands.length)]!,
        paymentMethodLast4: '0101',
        paymentReason: 'NEW_SUBSCRIPTION',
        status: paymentStatus,
        subtotal: '101',
        tax: '0'
      }
    ];
  }

  it('Has expected headers, number of data rows, and paginator', async () => {
    apiRequestMockServer.resetHandlers(
      http.get(MY_PAYMENTS_ENDPOINT, () => {
        return HttpResponse.json(convertToResponsePayload({ page: generatePayments('PAID'), total: 100 }));
      })
    );

    const renderResult = await renderComponent(BillingHistoryComponent);

    expect(screen.getByText('Billing history')).toBeInTheDocument();

    const headers = renderResult.getAllByRole('columnheader');

    expect(headers).toHaveLength(5);
    expect(headers[0]).toHaveTextContent('');
    expect(headers[1]).toHaveTextContent('Date');
    expect(headers[2]).toHaveTextContent('Total');
    expect(headers[3]).toHaveTextContent('Status');
    expect(headers[4]).toHaveTextContent('Payment method');

    const rows = renderResult.getAllByRole('row');
    rows.shift();

    expect(rows).toHaveLength(6);

    expect(screen.getByText('Items per page:')).toBeInTheDocument();
    expect(screen.getByRole('combobox')).toHaveTextContent('25');
  });

  // eslint-disable-next-line vitest/expect-expect
  it('Renders payments correctly', async () => {
    const payments = generatePayments('PAID');

    apiRequestMockServer.resetHandlers(
      http.get(MY_PAYMENTS_ENDPOINT, () => {
        return HttpResponse.json(convertToResponsePayload({ page: payments, total: 100 }));
      })
    );

    const renderResult = await renderComponent(BillingHistoryComponent);

    const rows = renderResult.getAllByRole('row');
    rows.shift();

    await assertRowCells(rows.at(-1)!, 'Feb 1, 2025', '$1.01', 'Paid', 'Initial subscription payment', '0101');
    assertCardBrandImage(rows.at(-1)!, payments.at(-1)!.paymentMethodBrand!);

    await assertRowCells(rows.at(-2)!, 'Feb 2, 2025', '$2.02', 'Paid', 'Subscription upgrade payment', '0202');
    assertCardBrandImage(rows.at(-2)!, payments.at(-2)!.paymentMethodBrand!);

    await assertRowCells(
      rows.at(-3)!,
      'Feb 3, 2025',
      '$3.03',
      'Paid',
      'Refund for subscription downgrade. It will be issued back to the original payment method used within 5-10 business days.',
      '0303'
    );
    assertCardBrandImage(rows.at(-3)!, payments.at(-3)!.paymentMethodBrand!);

    await assertRowCells(rows.at(-4)!, 'Feb 4, 2025', '$4.04', 'Paid', 'Subscription reactivation payment', '0404');
    assertCardBrandImage(rows.at(-4)!, payments.at(-4)!.paymentMethodBrand!);

    await assertRowCells(rows.at(-5)!, 'Feb 5, 2025', '$5.05', 'Paid', 'Subscription renewal payment', '0505');
    assertCardBrandImage(rows.at(-5)!, payments.at(-5)!.paymentMethodBrand!);

    await assertRowCells(
      rows.at(-6)!,
      'Feb 6, 2025',
      '$6.06',
      'Paid',
      'Refund for subscription cancellation. It will be issued back to the original payment method used within 5-10 business days.',
      '0606'
    );
    assertCardBrandImage(rows.at(-6)!, payments.at(-6)!.paymentMethodBrand!);
  });

  it('Renders payments with PAID status correctly', async () => {
    apiRequestMockServer.resetHandlers(
      http.get(MY_PAYMENTS_ENDPOINT, () => {
        return HttpResponse.json(
          convertToResponsePayload({
            page: [
              {
                amountDue: '101',
                currencyCode: 'usd',
                discount: '0',
                failureReason: null,
                paidAt: '2025-02-01T12:07:57Z',
                paymentId: '1',
                paymentMethodBrand: 'visa',
                paymentMethodLast4: '0101',
                paymentReason: 'NEW_SUBSCRIPTION',
                status: 'PAID',
                subtotal: '101',
                tax: '0'
              }
            ],
            total: 100
          })
        );
      })
    );

    const renderResult = await renderComponent(BillingHistoryComponent);

    const paymentRow = renderResult.getAllByRole('row')[1]!;

    await assertViewReceiptButtonPresentOrNot(paymentRow, true);

    await assertRowCells(paymentRow, 'Feb 1, 2025', '$1.01', 'Paid', 'Initial subscription payment', '0101');

    expect(paymentRow.children[3]!.querySelector('.payment-status--paid path')).toHaveAttribute(
      'd',
      'm382-354 339-339q12-12 28.5-12t28.5 12q12 12 12 28.5T778-636L410-268q-12 12-28 12t-28-12L182-440q-12-12-11.5-28.5T183-497q12-12 28.5-12t28.5 12l142 143Z'
    );
  });

  it('Renders payments with FAILED status correctly', async () => {
    apiRequestMockServer.resetHandlers(
      http.get(MY_PAYMENTS_ENDPOINT, () => {
        return HttpResponse.json(
          convertToResponsePayload({
            page: [
              {
                amountDue: '101',
                currencyCode: 'usd',
                discount: '0',
                failureReason: 'card_declined.generic_decline',
                paidAt: '2025-02-01T12:07:57Z',
                paymentId: '1',
                paymentMethodBrand: 'visa',
                paymentMethodLast4: '0101',
                paymentReason: 'NEW_SUBSCRIPTION',
                status: 'FAILED',
                subtotal: '101',
                tax: '0'
              },
              {
                amountDue: '101',
                currencyCode: 'usd',
                discount: '0',
                failureReason: 'card_declined.some_unhandled_reason',
                paidAt: '2025-02-01T12:07:57Z',
                paymentId: '1',
                paymentMethodBrand: 'visa',
                paymentMethodLast4: '0101',
                paymentReason: 'NEW_SUBSCRIPTION',
                status: 'FAILED',
                subtotal: '101',
                tax: '0'
              },
              {
                amountDue: '101',
                currencyCode: 'usd',
                discount: '0',
                failureReason: 'card_declined.generic_decline',
                paidAt: '2025-02-01T12:07:57Z',
                paymentId: '1',
                paymentMethodBrand: 'visa',
                paymentMethodLast4: '0101',
                paymentReason: '',
                status: 'FAILED',
                subtotal: '101',
                tax: '0'
              }
            ],
            total: 100
          })
        );
      })
    );

    const renderResult = await renderComponent(BillingHistoryComponent);

    const paymentRow1 = renderResult.getAllByRole('row')[1]!;
    const paymentRow2 = renderResult.getAllByRole('row')[2]!;
    const paymentRow3 = renderResult.getAllByRole('row')[3]!;

    await assertViewReceiptButtonPresentOrNot(paymentRow1, false);

    await assertRowCells(
      paymentRow1,
      'Feb 1, 2025',
      '$1.01',
      'Failed',
      '[Initial subscription payment] Your card was declined. Please contact your bank for details.',
      '0101'
    );

    expect(paymentRow1.children[3]!.querySelector('.payment-status--failed path')).toHaveAttribute(
      'd',
      'M109-120q-11 0-20-5.5T75-140q-5-9-5.5-19.5T75-180l370-640q6-10 15.5-15t19.5-5q10 0 19.5 5t15.5 15l370 640q6 10 5.5 20.5T885-140q-5 9-14 14.5t-20 5.5H109Zm69-80h604L480-720 178-200Zm302-40q17 0 28.5-11.5T520-280q0-17-11.5-28.5T480-320q-17 0-28.5 11.5T440-280q0 17 11.5 28.5T480-240Zm0-120q17 0 28.5-11.5T520-400v-120q0-17-11.5-28.5T480-560q-17 0-28.5 11.5T440-520v120q0 17 11.5 28.5T480-360Zm0-100Z'
    );

    await assertRowCells(
      paymentRow2,
      'Feb 1, 2025',
      '$1.01',
      'Failed',
      '[Initial subscription payment] Unknown.',
      '0101'
    );

    await assertRowCells(
      paymentRow3,
      'Feb 1, 2025',
      '$1.01',
      'Failed',
      'Your card was declined. Please contact your bank for details.',
      '0101'
    );
  });

  it('Renders payments with REFUND_IN_PROGRESS status correctly', async () => {
    apiRequestMockServer.resetHandlers(
      http.get(MY_PAYMENTS_ENDPOINT, () => {
        return HttpResponse.json(
          convertToResponsePayload({
            page: [
              {
                amountDue: '101',
                currencyCode: 'usd',
                discount: '0',
                failureReason: null,
                paidAt: '2025-02-01T12:07:57Z',
                paymentId: '1',
                paymentMethodBrand: 'visa',
                paymentMethodLast4: '0101',
                paymentReason: 'SUBSCRIPTION_CANCELLATION',
                status: 'REFUND_IN_PROGRESS',
                subtotal: '101',
                tax: '0'
              }
            ],
            total: 100
          })
        );
      })
    );

    const renderResult = await renderComponent(BillingHistoryComponent);

    const paymentRow = renderResult.getAllByRole('row')[1]!;

    await assertViewReceiptButtonPresentOrNot(paymentRow, false);

    await assertRowCells(
      paymentRow,
      'Feb 1, 2025',
      '$1.01',
      'Refund in progress',
      'Your refund is currently being processed. It will be issued back to the original payment method used within 5-10 business days.',
      '0101'
    );

    expect(paymentRow.children[3]!.querySelector('.payment-status--refund-in-progress path')).toHaveAttribute(
      'd',
      'M480-80q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm0-80q64 0 123-24t104-69L480-480v-320q-134 0-227 93t-93 227q0 134 93 227t227 93Z'
    );
  });

  it('Renders payments with REFUNDED status correctly', async () => {
    apiRequestMockServer.resetHandlers(
      http.get(MY_PAYMENTS_ENDPOINT, () => {
        return HttpResponse.json(
          convertToResponsePayload({
            page: [
              {
                amountDue: '101',
                currencyCode: 'usd',
                discount: '0',
                failureReason: null,
                paidAt: '2025-02-01T12:07:57Z',
                paymentId: '1',
                paymentMethodBrand: 'visa',
                paymentMethodLast4: '0101',
                paymentReason: 'SUBSCRIPTION_CANCELLATION',
                status: 'REFUNDED',
                subtotal: '101',
                tax: '0'
              }
            ],
            total: 100
          })
        );
      })
    );

    const renderResult = await renderComponent(BillingHistoryComponent);

    const paymentRow = renderResult.getAllByRole('row')[1]!;

    await assertViewReceiptButtonPresentOrNot(paymentRow, true);

    await assertRowCells(
      paymentRow,
      'Feb 1, 2025',
      '$1.01',
      'Refunded',
      'Refund for subscription cancellation. It will be issued back to the original payment method used within 5-10 business days.',
      '0101'
    );

    expect(paymentRow.children[3]!.querySelector('.payment-status--refunded path')).toHaveAttribute(
      'd',
      'M320-200q-17 0-28.5-11.5T280-240q0-17 11.5-28.5T320-280h244q63 0 109.5-40T720-420q0-60-46.5-100T564-560H312l76 76q11 11 11 28t-11 28q-11 11-28 11t-28-11L188-572q-6-6-8.5-13t-2.5-15q0-8 2.5-15t8.5-13l144-144q11-11 28-11t28 11q11 11 11 28t-11 28l-76 76h252q97 0 166.5 63T800-420q0 94-69.5 157T564-200H320Z'
    );
  });

  it('Renders payments with FAILED_REFUND status correctly', async () => {
    apiRequestMockServer.resetHandlers(
      http.get(MY_PAYMENTS_ENDPOINT, () => {
        return HttpResponse.json(
          convertToResponsePayload({
            page: [
              {
                amountDue: '101',
                currencyCode: 'usd',
                discount: '0',
                failureReason: null,
                paidAt: '2025-02-01T12:07:57Z',
                paymentId: '1',
                paymentMethodBrand: 'visa',
                paymentMethodLast4: '0101',
                paymentReason: 'SUBSCRIPTION_CANCELLATION',
                status: 'FAILED_REFUND',
                subtotal: '101',
                tax: '0'
              }
            ],
            total: 100
          })
        );
      })
    );

    const renderResult = await renderComponent(BillingHistoryComponent);

    const paymentRow = renderResult.getAllByRole('row')[1]!;

    await assertViewReceiptButtonPresentOrNot(paymentRow, false);

    await assertRowCells(
      paymentRow,
      'Feb 1, 2025',
      '$1.01',
      'Refund failed',
      /Your refund was not successfully processed, please/,
      // /Your refund was not successfully processed, please[\s\S]+contact us[\s\S]+to request your refund\./,
      '0101'
    );

    await assertRowCells(paymentRow, 'Feb 1, 2025', '$1.01', 'Refund failed', /contact us/, '0101');

    await assertRowCells(paymentRow, 'Feb 1, 2025', '$1.01', 'Refund failed', /to request your refund\./, '0101');

    expect(screen.getByText('contact us')).toHaveAttribute(
      'href',
      'mailto:heretohelp@cloudyclip.com?subject=%5BTrade%20Timeline%5D%20My%20refund%20was%20not%20successfully%20processed&body=Something%20went%20wrong%20during%20the%20processing%20of%20my%20refund%20of%20$-1.01.%20My%20email%20address%20is%20helloworld@gmail.com.'
    );

    expect(screen.getByText('contact us')).toHaveAttribute('target', '_blank');

    expect(paymentRow.children[3]!.querySelector('.payment-status--failed-refund path')).toHaveAttribute(
      'd',
      'M109-120q-11 0-20-5.5T75-140q-5-9-5.5-19.5T75-180l370-640q6-10 15.5-15t19.5-5q10 0 19.5 5t15.5 15l370 640q6 10 5.5 20.5T885-140q-5 9-14 14.5t-20 5.5H109Zm69-80h604L480-720 178-200Zm302-40q17 0 28.5-11.5T520-280q0-17-11.5-28.5T480-320q-17 0-28.5 11.5T440-280q0 17 11.5 28.5T480-240Zm0-120q17 0 28.5-11.5T520-400v-120q0-17-11.5-28.5T480-560q-17 0-28.5 11.5T440-520v120q0 17 11.5 28.5T480-360Zm0-100Z'
    );
  });

  it('Renders payments with PAST_DUE status correctly', async () => {
    apiRequestMockServer.resetHandlers(
      http.get(MY_PAYMENTS_ENDPOINT, () => {
        return HttpResponse.json(
          convertToResponsePayload({
            page: [
              {
                amountDue: '101',
                currencyCode: 'usd',
                discount: '0',
                failureReason: null,
                paidAt: '2025-02-01T12:07:57Z',
                paymentId: '1',
                paymentMethodBrand: 'visa',
                paymentMethodLast4: '0101',
                paymentReason: 'SUBSCRIPTION_RENEWAL',
                status: 'PAST_DUE',
                subtotal: '101',
                tax: '0'
              }
            ],
            total: 100
          })
        );
      })
    );

    const renderResult = await renderComponent(BillingHistoryComponent);

    const paymentRow = renderResult.getAllByRole('row')[1]!;

    await assertViewReceiptButtonPresentOrNot(paymentRow, false);

    await assertRowCells(paymentRow, 'Feb 1, 2025', '$1.01', 'Past due', null, '0101');

    expect(paymentRow.children[3]!.querySelector('.payment-status--past-due path')).toHaveAttribute(
      'd',
      'M721-80q-84 0-142.5-58T520-280q0-84 58.5-142T721-480q83 0 141 58.5T920-280q0 83-58 141.5T721-80ZM160-240v-320 13-173 480Zm0-400h640v-80H160v80Zm0 480q-33 0-56.5-23.5T80-240v-480q0-33 23.5-56.5T160-800h640q33 0 56.5 23.5T880-720v158q0 18-15.5 26.5t-32.5.5q-26-12-55.5-18.5T716-560q-57 0-107.5 21.5T520-480H160v240h263q17 0 28.5 11.5T463-200q0 17-11.5 28.5T423-160H160Zm580-128v-92q0-8-6-14t-14-6q-8 0-14 6t-6 14v91q0 8 3 15.5t9 13.5l61 61q6 6 14 6t14-6q6-6 6-14t-6-14l-61-61Z'
    );
  });

  it('Renders payments with an unhandled status correctly', async () => {
    apiRequestMockServer.resetHandlers(
      http.get(MY_PAYMENTS_ENDPOINT, () => {
        return HttpResponse.json(
          convertToResponsePayload({
            page: [
              {
                amountDue: '101',
                currencyCode: 'usd',
                discount: '0',
                failureReason: null,
                paidAt: '2025-02-01T12:07:57Z',
                paymentId: '1',
                paymentMethodBrand: 'visa',
                paymentMethodLast4: '0101',
                paymentReason: 'SUBSCRIPTION_RENEWAL',
                status: 'NOT_KNOWN',
                subtotal: '101',
                tax: '0'
              }
            ],
            total: 100
          })
        );
      })
    );

    const renderResult = await renderComponent(BillingHistoryComponent);

    const paymentRow = renderResult.getAllByRole('row')[1]!;

    await assertViewReceiptButtonPresentOrNot(paymentRow, false);

    await assertRowCells(paymentRow, 'Feb 1, 2025', '$1.01', 'Unknown', null, '0101');

    expect(paymentRow.children[3]!.querySelector('.payment-status--unknown path')).toHaveAttribute(
      'd',
      'M478-240q21 0 35.5-14.5T528-290q0-21-14.5-35.5T478-340q-21 0-35.5 14.5T428-290q0 21 14.5 35.5T478-240Zm2 160q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm0-80q134 0 227-93t93-227q0-134-93-227t-227-93q-134 0-227 93t-93 227q0 134 93 227t227 93Zm0-320Zm4-172q25 0 43.5 16t18.5 40q0 22-13.5 39T502-525q-23 20-40.5 44T444-427q0 14 10.5 23.5T479-394q15 0 25.5-10t13.5-25q4-21 18-37.5t30-31.5q23-22 39.5-48t16.5-58q0-51-41.5-83.5T484-720q-38 0-72.5 16T359-655q-7 12-4.5 25.5T368-609q14 8 29 5t25-17q11-15 27.5-23t34.5-8Z'
    );
  });

  it('Renders a loader while fetching payments', async () => {
    apiRequestMockServer.resetHandlers(
      http.get(MY_PAYMENTS_ENDPOINT, async () => {
        await delay(1000);

        return HttpResponse.json(
          convertToResponsePayload({
            page: [],
            total: 0
          })
        );
      })
    );

    const renderResult = await renderComponent(BillingHistoryComponent);

    expect(renderResult.queryAllByRole('row')).toHaveLength(0);
    expect(renderResult.container.querySelectorAll('.content-loading-indicator')).toHaveLength(3);
  });

  it('Renders when fetching payments fails', async () => {
    apiRequestMockServer.resetHandlers(
      http.get(MY_PAYMENTS_ENDPOINT, () => {
        return HttpResponse.json(convertToResponsePayload({ code: ExceptionCode.UNKNOWN }), { status: 500 });
      })
    );

    const locationReloadSpy = vi.spyOn(window.location, 'reload').mockImplementation(() => {});

    const renderResult = await renderComponent(BillingHistoryComponent);

    expect(renderResult.getByText('Something went wrong')).toBeInTheDocument();
    expect(
      renderResult.getByText(
        `We've encountered a problem while retrieving your billing history. Please try reloading your browser or contact us if the issue persists.`
      )
    ).toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(renderResult.getByText('Reload page'));

    expect(locationReloadSpy).toHaveBeenCalledOnce();

    expect(screen.getByText('Contact us')).toHaveAttribute('target', '_blank');
    expect(screen.getByText('Contact us')).toHaveAttribute(
      'href',
      'mailto:heretohelp@cloudyclip.com?subject=%5BTrade%20Timeline%5D%20Billing%20history%20retrieval%20error&body=I%20keep%20getting%20an%20error%20viewing%20my%20billing%20history.%20My%20email%20address%20is%20helloworld@gmail.com.'
    );
  });

  it('Renders when no payments are found', async () => {
    apiRequestMockServer.resetHandlers(
      http.get(MY_PAYMENTS_ENDPOINT, () => {
        return HttpResponse.json(convertToResponsePayload({ page: [], total: 0 }));
      })
    );

    const renderResult = await renderComponent(BillingHistoryComponent);

    expect(renderResult.getByText('We have no records of your billing history')).toBeInTheDocument();
    expect(renderResult.getByText('If it is a mistake, please let us know.')).toBeInTheDocument();

    expect(screen.getByText('Explore plans')).toHaveAttribute('href', '/pricing');
    expect(screen.getByText('Contact us')).toHaveAttribute(
      'href',
      'mailto:heretohelp@cloudyclip.com?subject=%5BTrade%20Timeline%5D%20Billing%20history%20not%20found&body=My%20billing%20history%20shows%20no%20records.%20My%20email%20address%20is%20helloworld@gmail.com.'
    );
  });

  it('Can paginate', { timeout: 10000 }, async () => {
    const payments: Payment[] = [];

    for (let i = 0; i < 30; i++) {
      const paymentData = generatePayments('PAID');

      for (const payment of paymentData) {
        payment.paymentId = generateRandomString();
        payments.push(payment);
      }
    }

    apiRequestMockServer.resetHandlers(
      http.get(MY_PAYMENTS_ENDPOINT, ({ request }) => {
        const url = new URL(request.url);

        const offset = Number(url.searchParams.get('offset'));
        const limit = Number(url.searchParams.get('limit'));

        return HttpResponse.json(
          convertToResponsePayload({
            page: payments.slice(offset * limit, offset * limit + limit),
            total: payments.length
          })
        );
      })
    );

    const billingServiceGetPaymentsSpy = vi.spyOn(BillingService.prototype, 'getPayments');

    const renderResult = await renderComponent(BillingHistoryComponent);

    assertCalledOnceWith(billingServiceGetPaymentsSpy, 0, 25);

    const user = userEvent.setup();

    await user.click(renderResult.container.querySelector('button[aria-label="Next page"]')!);

    expect(billingServiceGetPaymentsSpy).toHaveBeenCalledTimes(2);
    expect(billingServiceGetPaymentsSpy).toHaveBeenCalledWith(1, 25);

    await user.click(screen.getByRole('combobox'));
    await user.click(screen.getByText('10'));

    expect(billingServiceGetPaymentsSpy).toHaveBeenCalledTimes(3);
    expect(billingServiceGetPaymentsSpy).toHaveBeenCalledWith(0, 10);
  });

  it('Shows notification with expected message when no receipt can be located', async () => {
    apiRequestMockServer.resetHandlers(
      http.get(MY_PAYMENTS_ENDPOINT, () => {
        return HttpResponse.json(
          convertToResponsePayload({
            page: [
              {
                amountDue: '101',
                currencyCode: 'usd',
                discount: '0',
                failureReason: null,
                paidAt: '2025-02-01T12:07:57Z',
                paymentId: '1',
                paymentMethodBrand: 'visa',
                paymentMethodLast4: '0101',
                paymentReason: 'NEW_SUBSCRIPTION',
                status: 'PAID',
                subtotal: '101',
                tax: '0'
              }
            ],
            total: 100
          })
        );
      }),
      http.get(`${MY_PAYMENTS_ENDPOINT}/1/receipt`, () => {
        return HttpResponse.json(convertToResponsePayload({ code: ExceptionCode.NOT_FOUND }), { status: 404 });
      })
    );

    const renderResult = await renderComponent(BillingHistoryComponent);

    const paymentRow = renderResult.getAllByRole('row')[1]!;

    vi.spyOn(ProgressService.prototype, 'close');

    const user = userEvent.setup();
    await user.click(paymentRow.querySelector('button[aria-label="View receipt"]')!);

    await delayBy(16);

    expect(
      screen.getByText(
        'Receipt could not be located. Please try again later or contact us for assistance if the issue persists.'
      )
    ).toBeInTheDocument();

    expect(ProgressService.prototype.close).toHaveBeenCalledOnce();
  });

  it('Shows notification when getting receipt URL fails unknowingly', async () => {
    apiRequestMockServer.resetHandlers(
      http.get(MY_PAYMENTS_ENDPOINT, () => {
        return HttpResponse.json(
          convertToResponsePayload({
            page: [
              {
                amountDue: '101',
                currencyCode: 'usd',
                discount: '0',
                failureReason: null,
                paidAt: '2025-02-01T12:07:57Z',
                paymentId: '1',
                paymentMethodBrand: 'visa',
                paymentMethodLast4: '0101',
                paymentReason: 'NEW_SUBSCRIPTION',
                status: 'PAID',
                subtotal: '101',
                tax: '0'
              }
            ],
            total: 100
          })
        );
      }),
      http.get(`${MY_PAYMENTS_ENDPOINT}/1/receipt`, () => {
        return HttpResponse.json(convertToResponsePayload({ code: ExceptionCode.UNKNOWN }), { status: 505 });
      })
    );

    const renderResult = await renderComponent(BillingHistoryComponent);

    const paymentRow = renderResult.getAllByRole('row')[1]!;

    vi.spyOn(ProgressService.prototype, 'close');

    const user = userEvent.setup();
    await user.click(paymentRow.querySelector('button[aria-label="View receipt"]')!);

    await delayBy(16);

    expect(
      screen.getByText(/An unknown error has occurred while processing your request. Please try again later\./)
    ).toBeInTheDocument();

    expect(ProgressService.prototype.close).toHaveBeenCalledOnce();
  });

  // eslint-disable-next-line vitest/expect-expect
  it('Does not render payment reason tooltip button when payment reason is not accounted for', async () => {
    apiRequestMockServer.resetHandlers(
      http.get(MY_PAYMENTS_ENDPOINT, () => {
        return HttpResponse.json(
          convertToResponsePayload({
            page: [
              {
                amountDue: '101',
                currencyCode: 'usd',
                discount: '0',
                failureReason: null,
                paidAt: '2025-02-01T12:07:57Z',
                paymentId: '1',
                paymentMethodBrand: 'visa',
                paymentMethodLast4: '0101',
                paymentReason: '',
                status: 'PAID',
                subtotal: '101',
                tax: '0'
              }
            ],
            total: 100
          })
        );
      })
    );

    const renderResult = await renderComponent(BillingHistoryComponent);

    const paymentRow = renderResult.getAllByRole('row')[1]!;

    await assertRowCells(paymentRow, 'Feb 1, 2025', '$1.01', 'Paid', null, '0101');
  });
});
