/* eslint-disable max-len */
import { TestBed } from '@angular/core/testing';
import { ExceptionCode } from '@lazycuh/http/src';
import { Logger } from '@lazycuh/logging';
import { Optional } from '@lazycuh/optional';
import { AuthenticatedUser, UserService } from '@lazycuh/web-ui-common/auth';
import { EntitlementService } from '@lazycuh/web-ui-common/entitlement';
import { delayBy } from '@lazycuh/web-ui-common/utils/delay-by';
import { screen } from '@testing-library/angular';
import { http, HttpHandler, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ESSENTIAL_MONTHLY_PLAN } from 'test/data';
import {
  assertCalledOnceWith,
  convertToResponsePayload,
  deepCloneObject,
  renderComponent,
  startMockingApiRequests
} from 'test/utils';
import { generateAuthenticatedUser } from 'test/utils/generate-authenticated-user';

import { BillingService, MY_PAYMENTS_ENDPOINT } from '../billing-history/services';

import { SubscriptionService } from './services';
import { SubscriptionComponent } from './subscription.component';

type RenderOptions = {
  authenticatedUser: AuthenticatedUser;
  handlers: HttpHandler[];
};

describe(SubscriptionComponent.name, () => {
  const apiRequestMockServer = startMockingApiRequests();

  const render = async (options: Partial<RenderOptions> = {}) => {
    options.handlers ??= [];
    const user = deepCloneObject(options.authenticatedUser ?? generateAuthenticatedUser());

    apiRequestMockServer.resetHandlers(...options.handlers);

    vi.spyOn(UserService.prototype, 'getAuthenticatedUser').mockReturnValue(user);
    vi.spyOn(UserService.prototype, 'findAuthenticatedUser').mockReturnValue(Optional.of(user));

    return renderComponent(SubscriptionComponent, { providers: [SubscriptionService] });
  };

  beforeEach(() => {
    vi.spyOn(SubscriptionService.prototype, 'getUpcomingPayment').mockResolvedValue({
      amountDue: '1000',
      currencyCode: 'usd',
      discount: '0',
      dueDate: new Date().toISOString(),
      subtotal: '1000',
      tax: '0',
      taxPercentage: '0.00'
    });
  });
  it('Does not try to fetch the latest payment if the user does not have an active subscription', async () => {
    vi.spyOn(BillingService.prototype, 'findLatestPayment');

    await render();

    await delayBy(16);

    expect(BillingService.prototype.findLatestPayment).not.toHaveBeenCalled();

    expect(TestBed.inject(EntitlementService).hasActiveSubscription()).toEqual(false);
  });

  it('Does not try to fetch the latest payment if user has a canceled subscription', async () => {
    vi.spyOn(BillingService.prototype, 'findLatestPayment');

    const user = deepCloneObject(generateAuthenticatedUser(ESSENTIAL_MONTHLY_PLAN));
    user.subscription!.cancellationReason = 'REQUESTED_BY_USER';
    user.subscription!.canceledAt = new Date().toISOString();

    await render({ authenticatedUser: user });

    await delayBy(16);

    expect(BillingService.prototype.findLatestPayment).not.toHaveBeenCalled();

    expect(TestBed.inject(EntitlementService).hasActiveSubscription()).toEqual(false);
    expect(TestBed.inject(UserService).getAuthenticatedUser().subscription).not.toBeFalsy();
  });

  it('Fetches latest payment when user has an active paid subscription', async () => {
    vi.spyOn(BillingService.prototype, 'findLatestPayment').mockResolvedValue(
      Optional.of({
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
      })
    );

    await render({ authenticatedUser: generateAuthenticatedUser(ESSENTIAL_MONTHLY_PLAN) });

    await delayBy(16);

    expect(BillingService.prototype.findLatestPayment).toHaveBeenCalledOnce();

    expect(TestBed.inject(EntitlementService).hasActiveSubscription()).toEqual(true);
    expect(TestBed.inject(EntitlementService).findActiveSubscription().orElseThrow().plan.isFreePlan).toEqual(false);
  });

  it('Shows warning box when latest payment failed and payment reason is SUBSCRIPTION_RENEWAL', async () => {
    vi.spyOn(BillingService.prototype, 'findLatestPayment').mockResolvedValue(
      Optional.of({
        amountDue: '1',
        currencyCode: 'usd',
        discount: '0',
        failureReason: null,
        paidAt: new Date().toISOString(),
        paymentId: '1',
        paymentMethodBrand: 'visa',
        paymentMethodLast4: '0001',
        paymentReason: 'SUBSCRIPTION_RENEWAL',
        status: 'FAILED',
        subtotal: '1',
        tax: '0'
      })
    );

    await render({ authenticatedUser: generateAuthenticatedUser(ESSENTIAL_MONTHLY_PLAN) });

    await delayBy(16);

    expect(screen.getByText('Attention')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Your last subscription renewal payment failed. Please update your payment method to avoid any service interruptions.'
      )
    ).toBeInTheDocument();
    expect(screen.getByText(/Please visit your/)).toBeInTheDocument();
    expect(screen.getByText('billing history')).toHaveAttribute('href', '/my/billing');
    expect(screen.getByText(/page for more details\./)).toBeInTheDocument();
  });

  it('Does not show warning box when latest payment failed and payment reason is not SUBSCRIPTION_RENEWAL', async () => {
    vi.spyOn(BillingService.prototype, 'findLatestPayment').mockResolvedValue(
      Optional.of({
        amountDue: '1',
        currencyCode: 'usd',
        discount: '0',
        failureReason: null,
        paidAt: new Date().toISOString(),
        paymentId: '1',
        paymentMethodBrand: 'visa',
        paymentMethodLast4: '0001',
        paymentReason: 'SUBSCRIPTION_REACTIVATION',
        status: 'FAILED',
        subtotal: '1',
        tax: '0'
      })
    );

    await render({ authenticatedUser: generateAuthenticatedUser(ESSENTIAL_MONTHLY_PLAN) });

    await delayBy(16);

    expect(
      screen.queryByText(
        'Your last subscription renewal payment failed. Please update your payment method to avoid any service interruptions.'
      )
    ).not.toBeInTheDocument();
  });

  it('Should render fine when no past payments are found', async () => {
    await render({
      authenticatedUser: generateAuthenticatedUser(ESSENTIAL_MONTHLY_PLAN),
      handlers: [
        http.get(MY_PAYMENTS_ENDPOINT, ({ request }) => {
          const url = new URL(request.url);
          expect(url.searchParams.get('limit')).toEqual('1');
          expect(url.searchParams.get('offset')).toEqual('0');

          return HttpResponse.json(convertToResponsePayload([]));
        })
      ]
    });

    expect(
      screen.queryByText(
        'Your last subscription renewal payment failed. Please update your payment method to avoid any service interruptions.'
      )
    ).not.toBeInTheDocument();
  });

  it('Does not show failed payment message box when payment reason is not SUBSCRIPTION_RENEWAL', async () => {
    await render({
      authenticatedUser: generateAuthenticatedUser(ESSENTIAL_MONTHLY_PLAN),
      handlers: [
        http.get(MY_PAYMENTS_ENDPOINT, () => {
          return HttpResponse.json(
            convertToResponsePayload([
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
                status: 'FAILED',
                subtotal: '1',
                tax: '0'
              }
            ])
          );
        })
      ]
    });

    expect(
      screen.queryByText(
        'Your last subscription renewal payment failed. Please update your payment method to avoid any service interruptions.'
      )
    ).not.toBeInTheDocument();
  });

  it('Logs an error when fetching latest payment fails', async () => {
    await render({
      authenticatedUser: generateAuthenticatedUser(ESSENTIAL_MONTHLY_PLAN),
      handlers: [
        http.get(MY_PAYMENTS_ENDPOINT, () => {
          return HttpResponse.json(convertToResponsePayload({ code: ExceptionCode.UNKNOWN }, 'expected'), {
            status: 500
          });
        })
      ]
    });

    assertCalledOnceWith(Logger.prototype.error, 'failed to fetch latest payment', {
      message: 'expected',
      payload: { code: ExceptionCode.UNKNOWN }
    });
  });
});
