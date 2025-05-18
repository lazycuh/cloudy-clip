/* eslint-disable max-len */
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { ExceptionCode } from '@lazycuh/http/src';
import { Optional } from '@lazycuh/optional';
import { UserService } from '@lazycuh/web-ui-common/auth';
import { EntitlementService } from '@lazycuh/web-ui-common/entitlement';
import { delayBy } from '@lazycuh/web-ui-common/utils/delay-by';
import userEvent from '@testing-library/user-event';
import { http, HttpHandler, HttpResponse } from 'msw';
import { PaymentMethod } from 'src/app/user-dashboard/payment-method-list/models';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { calculateTax, parseCurrency } from '@common/currency';
import { TaskService } from '@common/task';

import { ESSENTIAL_MONTHLY_PLAN } from 'test/data';
import {
  assertCalledOnceWith,
  convertToResponsePayload,
  deepCloneObject,
  renderComponent,
  startMockingApiRequests
} from 'test/utils';
import { generateAuthenticatedUser } from 'test/utils/generate-authenticated-user';

import { CheckoutComponent } from '../checkout.component';
import { CheckoutPreviewResponse } from '../models';
import { CheckoutService } from '../services';

describe('Subscription update checkout common logic', () => {
  type RenderOptions = {
    checkoutPreviewResponse: Partial<CheckoutPreviewResponse>;
    httpHandlers: HttpHandler[];
  };

  const TEST_USER_WITH_ESSENTIAL_MONTHLY_SUBSCRIPTION = generateAuthenticatedUser(ESSENTIAL_MONTHLY_PLAN);

  const apiRequestMockServer = startMockingApiRequests();
  const paymentMethods: PaymentMethod[] = [
    {
      brand: 'visa',
      expMonth: '1',
      expYear: String(new Date().getFullYear() + 1),
      isDefault: true,
      last4: '1111',
      paymentMethodId: 'pm_1'
    },
    {
      brand: 'mastercard',
      expMonth: '2',
      expYear: String(new Date().getFullYear() + 2),
      isDefault: false,
      last4: '2222',
      paymentMethodId: 'pm_2'
    }
  ];

  async function render(options: Partial<RenderOptions> = {}) {
    const selectedPlan = deepCloneObject(ESSENTIAL_MONTHLY_PLAN);

    const taxPercentage = '10';
    const tax = calculateTax(
      selectedPlan.discountedPrice,
      options.checkoutPreviewResponse?.taxPercentage ?? taxPercentage
    );

    options.checkoutPreviewResponse = Object.assign(
      {
        amountDue: String(parseCurrency(selectedPlan.discountedPrice).add(tax).intValue),
        currencyCode: 'usd',
        discount: '0',
        refund: '0',
        storedPaymentMethods: paymentMethods,
        subtotal: selectedPlan.discountedPrice,
        tax: String(tax.intValue),
        taxPercentage
      } satisfies CheckoutPreviewResponse,
      options.checkoutPreviewResponse ?? {}
    );

    apiRequestMockServer.resetHandlers(
      ...(options.httpHandlers ?? [
        http.get(`${__ORCHESTRATOR_URL__}/v1/checkout/preview`, () => {
          return HttpResponse.json(convertToResponsePayload(options.checkoutPreviewResponse));
        })
      ])
    );

    const renderResult = await renderComponent(CheckoutComponent, {
      providers: [
        CheckoutService,
        EntitlementService,
        TaskService,
        {
          provide: Router,
          useValue: {
            getCurrentNavigation: () => ({
              extras: { state: { checkoutSession: { selectedPlan, type: 'REACTIVATION' } } }
            }),
            navigateByUrl: vi.fn().mockResolvedValue(true)
          }
        }
      ]
    });

    await delayBy(32);

    TestBed.inject(EntitlementService).markSubscriptionAsCanceled();

    return renderResult;
  }

  beforeEach(() => {
    vi.stubGlobal('stripeInstance', {});

    const user = deepCloneObject(TEST_USER_WITH_ESSENTIAL_MONTHLY_SUBSCRIPTION);
    vi.spyOn(UserService.prototype, 'getAuthenticatedUser').mockReturnValue(user);
    vi.spyOn(UserService.prototype, 'findAuthenticatedUser').mockReturnValue(Optional.of(user));
  });

  it('Navigates to unknown error page when getting checkout preview fails with an unhandled error', async () => {
    await render({
      httpHandlers: [
        http.get(`${__ORCHESTRATOR_URL__}/v1/checkout/preview`, () => {
          return HttpResponse.json(convertToResponsePayload({ code: ExceptionCode.UNKNOWN }), { status: 500 });
        })
      ]
    });

    assertCalledOnceWith(TestBed.inject(Router).navigateByUrl, '/errors/unknown', {
      skipLocationChange: true,
      state: { requestId: undefined }
    });
  });

  it('Navigates to new subscription checkout page when no stripe subscription was found when previewing checkout', async () => {
    await render({
      httpHandlers: [
        http.get(`${__ORCHESTRATOR_URL__}/v1/checkout/preview`, () => {
          return HttpResponse.json(
            convertToResponsePayload({ code: ExceptionCode.NOT_FOUND }, 'no stripe subscription was found'),
            { status: 404 }
          );
        })
      ]
    });

    expect(TestBed.inject(Router).navigateByUrl).toHaveBeenCalledTimes(2);
    expect(TestBed.inject(Router).navigateByUrl).toHaveBeenCalledWith('..');
    expect(TestBed.inject(Router).navigateByUrl).toHaveBeenCalledWith('/checkout', {
      state: { checkoutSession: { selectedPlan: ESSENTIAL_MONTHLY_PLAN, type: 'NEW_SUBSCRIPTION' } }
    });
  });

  it('Navigates to new subscription checkout page when no billing info was was found when previewing checkout', async () => {
    await render({
      httpHandlers: [
        http.get(`${__ORCHESTRATOR_URL__}/v1/checkout/preview`, () => {
          return HttpResponse.json(
            convertToResponsePayload({ code: ExceptionCode.NOT_FOUND }, 'no billing info was found'),
            { status: 404 }
          );
        })
      ]
    });

    expect(TestBed.inject(Router).navigateByUrl).toHaveBeenCalledTimes(2);
    expect(TestBed.inject(Router).navigateByUrl).toHaveBeenCalledWith('..');
    expect(TestBed.inject(Router).navigateByUrl).toHaveBeenCalledWith('/checkout', {
      state: { checkoutSession: { selectedPlan: ESSENTIAL_MONTHLY_PLAN, type: 'NEW_SUBSCRIPTION' } }
    });
  });

  it('Disables "Submit" button when no payment method is selected', async () => {
    const renderResult = await render({
      checkoutPreviewResponse: {
        storedPaymentMethods: []
      }
    });

    const submitButton = renderResult.getByText('Submit').parentElement!.parentElement!;
    expect(submitButton).toBeDisabled();

    const checkBox = renderResult.getByRole('checkbox');
    expect(checkBox).not.toBeChecked();

    const user = userEvent.setup();
    await user.click(checkBox);
    expect(checkBox).toBeChecked();

    expect(submitButton).toBeDisabled();
  });
});
