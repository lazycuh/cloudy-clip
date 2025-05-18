/* eslint-disable @stylistic/quotes */
/* eslint-disable max-len */
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { ExceptionCode } from '@lazycuh/http/src';
import { Logger } from '@lazycuh/logging';
import { Optional } from '@lazycuh/optional';
import { UserService } from '@lazycuh/web-ui-common/auth';
import { capitalize } from '@lazycuh/web-ui-common/capitalize';
import { EntitlementService } from '@lazycuh/web-ui-common/entitlement';
import { ProgressService } from '@lazycuh/web-ui-common/progress';
import { delayBy } from '@lazycuh/web-ui-common/utils/delay-by';
import { screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { http, HttpHandler, HttpResponse } from 'msw';
import { PaymentMethod } from 'src/app/user-dashboard/payment-method-list/models';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { calculateTax, parseCurrency } from '@common/currency';

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

describe('Subscription reactivation checkout', () => {
  type RenderOptions = {
    additionalHttpHandlers: HttpHandler[];
    checkoutPreviewResponse: Partial<CheckoutPreviewResponse>;
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
      http.get(`${__ORCHESTRATOR_URL__}/v1/checkout/preview`, ({ request }) => {
        if (!request.url.includes(`offeringId=${selectedPlan.offeringId}`)) {
          throw new Error('Request URL does not contain the correct `offeringId` query param');
        }

        return HttpResponse.json(convertToResponsePayload(options.checkoutPreviewResponse));
      }),
      ...(options.additionalHttpHandlers ?? [])
    );

    const renderResult = await renderComponent(CheckoutComponent, {
      providers: [
        CheckoutService,
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

    return renderResult;
  }

  beforeEach(() => {
    vi.stubGlobal('stripeInstance', {});

    const user = deepCloneObject(TEST_USER_WITH_ESSENTIAL_MONTHLY_SUBSCRIPTION);
    user.subscription!.canceledAt = new Date().toISOString();
    user.subscription!.cancellationReason = 'REQUESTED_BY_USER';

    vi.spyOn(UserService.prototype, 'getAuthenticatedUser').mockReturnValue(user);
    vi.spyOn(UserService.prototype, 'findAuthenticatedUser').mockReturnValue(Optional.of(user));
  });

  it('Renders checkout summary correctly', { timeout: 10000 }, async () => {
    const renderResult = await render();

    const user = userEvent.setup();

    expect(renderResult.container.querySelector('[aria-label="Return to previous page"]')).toBeInTheDocument();
    expect(screen.getByText('Order summary')).toBeInTheDocument();
    expect(screen.getByText('Essential')).toBeInTheDocument();
    expect(screen.getAllByText('$4.39')).toHaveLength(2);
    expect(screen.getByText('then $4.39 per month')).toBeInTheDocument();

    const infoTooltipButton = renderResult.getByText('then $4.39 per month').querySelector('.info-tooltip button')!;
    expect(infoTooltipButton).toBeInTheDocument();
    await user.click(infoTooltipButton);

    expect(
      screen.getByText(
        'This is the estimated recurring total as of today. This price may change if your tax rates or applied discounts change in the future.'
      )
    ).toBeInTheDocument();
    expect(screen.getByText("What you'll get:")).toBeInTheDocument();
    expect(screen.getByText('Unlimited number of journal entries')).toBeInTheDocument();
    expect(screen.getByText('No character count restriction')).toBeInTheDocument();
    expect(screen.getByText('Lifetime data storage')).toBeInTheDocument();
    expect(screen.getByText('Ability to embed images')).toBeInTheDocument();
    expect(screen.getByText('Subtotal')).toBeInTheDocument();
    expect(screen.getByText('$3.99')).toBeInTheDocument();
    expect(screen.queryByText('Refund')).not.toBeInTheDocument();

    // expect(screen.getByText('Redeem coupon')).toBeInTheDocument();
    expect(screen.getByText('Tax')).toBeInTheDocument();
    expect(screen.getByText('$0.40 (10%)')).toBeInTheDocument();
    expect(screen.getByText('Due today')).toBeInTheDocument();
    expect(screen.getByText('Payment method')).toBeInTheDocument();
    expect(
      screen.getAllByText(`${capitalize(paymentMethods[0]!.brand)} ××××-${paymentMethods[0]!.last4}`)
    ).toHaveLength(2);
    expect(screen.getByText('Refund policy')).toHaveAttribute('href', '/policies/refund-policy');
    expect(
      screen.getByText(/By reactivating your Essential \(Monthly\) subscription, you authorize Cloudy Clip to charge/)
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /for the recurring subscription fee stated above\. You acknowledge and agree to the terms and conditions of the subscription, including any applicable fees, taxes, and billing cycles\./
      )
    ).toBeInTheDocument();
  });

  it('Shows $0.00 for tax when there is no tax', async () => {
    await render({ checkoutPreviewResponse: { taxPercentage: '0.00' } });

    expect(screen.getAllByText('$3.99')).toHaveLength(3);
    expect(screen.getByText('then $3.99 per month')).toBeInTheDocument();

    expect(screen.getByText('$0.00')).toBeInTheDocument();
  });

  it('Shows notification when payment task fails', async () => {
    const taskId = 'task-id';

    const renderResult = await render({
      additionalHttpHandlers: [
        http.post(`${__ORCHESTRATOR_URL__}/v1/subscriptions/my/reactivate`, () => {
          return HttpResponse.json(convertToResponsePayload(taskId));
        }),
        http.get(`${__ORCHESTRATOR_URL__}/v1/tasks/${taskId}`, () => {
          return HttpResponse.json(
            convertToResponsePayload({
              comment: null,
              status: 'FAILURE',
              type: 'REACTIVATION_PAYMENT',
              updatedAt: new Date().toISOString()
            })
          );
        }),
        http.get(`${__ORCHESTRATOR_URL__}/v1/billing/my/payments`, ({ request }) => {
          if (!request.url.includes('offset=0&limit=1')) {
            throw new Error('Request URL does not contain the correct `offset` and `limit` query params');
          }

          return HttpResponse.json(
            convertToResponsePayload({ page: [{ failureReason: 'card_declined.issuer_not_available' }] })
          );
        })
      ]
    });

    const user = userEvent.setup();

    const submitButton = renderResult.getByText('Submit').parentElement!.parentElement!;
    expect(submitButton).toBeDisabled();

    const entitlementService = TestBed.inject(EntitlementService);

    expect(
      entitlementService
        .findCurrentSubscription()
        .map(e => e.plan.offeringId)
        .orElseThrow()
    ).toEqual(TEST_USER_WITH_ESSENTIAL_MONTHLY_SUBSCRIPTION.subscription?.plan.offeringId);

    expect(
      entitlementService
        .findCurrentSubscription()
        .map(e => e.canceledAt === null)
        .orElseThrow()
    ).toEqual(false);

    await user.click(renderResult.getByText(/By reactivating/));

    expect(submitButton).toBeEnabled();
    await user.click(submitButton);

    expect(
      entitlementService
        .findCurrentSubscription()
        .map(e => e.plan.offeringId)
        .orElseThrow()
    ).toEqual(TEST_USER_WITH_ESSENTIAL_MONTHLY_SUBSCRIPTION.subscription?.plan.offeringId);

    expect(
      entitlementService
        .findCurrentSubscription()
        .map(e => e.canceledAt === null)
        .orElseThrow()
    ).toEqual(false);

    expect(TestBed.inject(Router).navigateByUrl).not.toHaveBeenCalled();

    await delayBy(500);

    expect(
      screen.getByText(
        'We were not able to contact your bank for the payment. Please try again later or contact your bank for details.'
      )
    ).toBeInTheDocument();
  });

  it('Shows notification when payment succeeds but reactivation tasks fails unknowingly', async () => {
    const taskId = 'task-id';

    const renderResult = await render({
      additionalHttpHandlers: [
        http.post(`${__ORCHESTRATOR_URL__}/v1/subscriptions/my/reactivate`, () => {
          return HttpResponse.json(convertToResponsePayload(taskId));
        }),
        http.get(`${__ORCHESTRATOR_URL__}/v1/tasks/${taskId}`, () => {
          return HttpResponse.json(
            convertToResponsePayload({
              comment: null,
              status: 'FAILURE',
              type: 'REACTIVATION_PAYMENT',
              updatedAt: new Date().toISOString()
            })
          );
        }),
        http.get(`${__ORCHESTRATOR_URL__}/v1/billing/my/payments`, () => {
          return HttpResponse.json(convertToResponsePayload({ page: [{ failureReason: null }] }));
        })
      ]
    });

    const user = userEvent.setup();

    const submitButton = renderResult.getByText('Submit').parentElement!.parentElement!;
    expect(submitButton).toBeDisabled();

    const entitlementService = TestBed.inject(EntitlementService);

    expect(
      entitlementService
        .findCurrentSubscription()
        .map(e => e.plan.offeringId)
        .orElseThrow()
    ).toEqual(TEST_USER_WITH_ESSENTIAL_MONTHLY_SUBSCRIPTION.subscription?.plan.offeringId);

    expect(
      entitlementService
        .findCurrentSubscription()
        .map(e => e.canceledAt === null)
        .orElseThrow()
    ).toEqual(false);

    await user.click(renderResult.getByText(/By reactivating/));

    expect(submitButton).toBeEnabled();
    await user.click(submitButton);

    expect(
      entitlementService
        .findCurrentSubscription()
        .map(e => e.plan.offeringId)
        .orElseThrow()
    ).toEqual(TEST_USER_WITH_ESSENTIAL_MONTHLY_SUBSCRIPTION.subscription?.plan.offeringId);

    expect(
      entitlementService
        .findCurrentSubscription()
        .map(e => e.canceledAt === null)
        .orElseThrow()
    ).toEqual(false);

    expect(TestBed.inject(Router).navigateByUrl).not.toHaveBeenCalled();

    await delayBy(500);

    expect(
      screen.getByText(
        'Your payment was successful, but we encountered an issue while reactivating your subscription. Please contact support for further assistance.'
      )
    ).toBeInTheDocument();
  });

  it('Shows notification when payment fails right away when calling reactivate endpoint', async () => {
    const renderResult = await render({
      additionalHttpHandlers: [
        http.post(`${__ORCHESTRATOR_URL__}/v1/subscriptions/my/reactivate`, () => {
          return HttpResponse.json(
            convertToResponsePayload({
              code: ExceptionCode.FAILED_PAYMENT,
              extra: { failureReason: 'card_declined.issuer_not_available' }
            }),
            { status: 400 }
          );
        })
      ]
    });

    const user = userEvent.setup();

    const submitButton = renderResult.getByText('Submit').parentElement!.parentElement!;
    expect(submitButton).toBeDisabled();

    const entitlementService = TestBed.inject(EntitlementService);

    expect(
      entitlementService
        .findCurrentSubscription()
        .map(e => e.plan.offeringId)
        .orElseThrow()
    ).toEqual(TEST_USER_WITH_ESSENTIAL_MONTHLY_SUBSCRIPTION.subscription?.plan.offeringId);

    expect(
      entitlementService
        .findCurrentSubscription()
        .map(e => e.canceledAt === null)
        .orElseThrow()
    ).toEqual(false);

    await user.click(renderResult.getByText(/By reactivating/));

    expect(submitButton).toBeEnabled();
    await user.click(submitButton);

    expect(
      entitlementService
        .findCurrentSubscription()
        .map(e => e.plan.offeringId)
        .orElseThrow()
    ).toEqual(TEST_USER_WITH_ESSENTIAL_MONTHLY_SUBSCRIPTION.subscription?.plan.offeringId);

    expect(
      entitlementService
        .findCurrentSubscription()
        .map(e => e.canceledAt === null)
        .orElseThrow()
    ).toEqual(false);

    expect(TestBed.inject(Router).navigateByUrl).not.toHaveBeenCalled();

    await delayBy(500);

    expect(
      screen.getByText(
        'We were not able to contact your bank for the payment. Please try again later or contact your bank for details.'
      )
    ).toBeInTheDocument();
  });

  it('Shows notification with default error message when reactivating fails unknowningly', async () => {
    const renderResult = await render({
      additionalHttpHandlers: [
        http.post(`${__ORCHESTRATOR_URL__}/v1/subscriptions/my/reactivate`, () => {
          return HttpResponse.json(convertToResponsePayload({ code: ExceptionCode.UNKNOWN }, 'expected'), {
            status: 500
          });
        })
      ]
    });

    const user = userEvent.setup();

    const submitButton = renderResult.getByText('Submit').parentElement!.parentElement!;
    expect(submitButton).toBeDisabled();

    const entitlementService = TestBed.inject(EntitlementService);

    expect(
      entitlementService
        .findCurrentSubscription()
        .map(e => e.plan.offeringId)
        .orElseThrow()
    ).toEqual(TEST_USER_WITH_ESSENTIAL_MONTHLY_SUBSCRIPTION.subscription?.plan.offeringId);

    expect(
      entitlementService
        .findCurrentSubscription()
        .map(e => e.canceledAt === null)
        .orElseThrow()
    ).toEqual(false);

    await user.click(renderResult.getByText(/By reactivating/));

    expect(submitButton).toBeEnabled();
    await user.click(submitButton);

    expect(
      entitlementService
        .findCurrentSubscription()
        .map(e => e.plan.offeringId)
        .orElseThrow()
    ).toEqual(TEST_USER_WITH_ESSENTIAL_MONTHLY_SUBSCRIPTION.subscription?.plan.offeringId);

    expect(
      entitlementService
        .findCurrentSubscription()
        .map(e => e.canceledAt === null)
        .orElseThrow()
    ).toEqual(false);

    expect(TestBed.inject(Router).navigateByUrl).not.toHaveBeenCalled();

    await delayBy(16);

    expect(
      screen.getByText(/An unknown error has occurred while processing your request\. Please try again later\./)
    ).toBeInTheDocument();

    expect(Logger.prototype.error).toHaveBeenCalledOnce();
    assertCalledOnceWith(
      Logger.prototype.error,
      'failed to reactivate subscription',
      {
        message: 'expected',
        payload: {
          code: ExceptionCode.UNKNOWN
        }
      },
      {
        paymentMethodId: 'pm_1',
        plan: 'Essential (Monthly)'
      }
    );
  });

  it('Marks subscription as active and navigates to /my/subscription page after successful reactivation', async () => {
    vi.spyOn(UserService.prototype, 'restoreSession').mockResolvedValue(true);
    vi.spyOn(EntitlementService.prototype, 'markSubscriptionAsActive');

    const taskId = 'task-id';

    const renderResult = await render({
      additionalHttpHandlers: [
        http.post(`${__ORCHESTRATOR_URL__}/v1/subscriptions/my/reactivate`, async ({ request }) => {
          const clonedRequest = request.clone();
          const requestBody = (await clonedRequest.json()) as { offeringId: string; paymentMethodId: string };

          expect(
            requestBody.paymentMethodId,
            'paymentMethodId in request body does not match the selected payment method'
          ).toEqual(paymentMethods[0]!.paymentMethodId);

          return HttpResponse.json(convertToResponsePayload(taskId));
        }),
        http.get(`${__ORCHESTRATOR_URL__}/v1/tasks/${taskId}`, () => {
          return HttpResponse.json(
            convertToResponsePayload({
              comment: null,
              status: 'SUCCESS',
              type: 'REACTIVATION_PAYMENT',
              updatedAt: new Date().toISOString()
            })
          );
        })
      ]
    });

    const entitlementService = TestBed.inject(EntitlementService);
    vi.spyOn(entitlementService, 'markSubscriptionAsActive');

    expect(
      entitlementService
        .findCurrentSubscription()
        .map(e => e.plan.offeringId)
        .orElseThrow()
    ).toEqual(TEST_USER_WITH_ESSENTIAL_MONTHLY_SUBSCRIPTION.subscription?.plan.offeringId);

    expect(
      entitlementService
        .findCurrentSubscription()
        .map(e => e.canceledAt === null)
        .orElseThrow()
    ).toEqual(false);

    const user = userEvent.setup();

    await user.click(renderResult.getByText(/By reactivating/));

    await user.click(screen.getByText('Submit'));

    expect(EntitlementService.prototype.markSubscriptionAsActive).toHaveBeenCalledOnce();

    assertCalledOnceWith(TestBed.inject(Router).navigateByUrl, '/my/subscription');

    expect(
      screen.getByText(
        'Your Essential (Monthly) subscription has been reactivated. Thank you for your continuing support.'
      )
    ).toBeInTheDocument();
  });

  it('Should use the selected payment method', async () => {
    vi.spyOn(UserService.prototype, 'restoreSession').mockResolvedValue(true);

    const taskId = 'task-id';

    const renderResult = await render({
      additionalHttpHandlers: [
        http.post(`${__ORCHESTRATOR_URL__}/v1/subscriptions/my/reactivate`, async ({ request }) => {
          const clonedRequest = request.clone();
          const requestBody = (await clonedRequest.json()) as { offeringId: string; paymentMethodId: string };

          if (requestBody.paymentMethodId !== paymentMethods[1]!.paymentMethodId) {
            throw new Error('Request body does not contain empty string for paymentMethodId');
          }

          return HttpResponse.json(convertToResponsePayload(taskId));
        }),
        http.get(`${__ORCHESTRATOR_URL__}/v1/tasks/${taskId}`, () => {
          return HttpResponse.json(
            convertToResponsePayload({
              comment: null,
              status: 'SUCCESS',
              type: 'REACTIVATION_PAYMENT',
              updatedAt: new Date().toISOString()
            })
          );
        })
      ]
    });

    await delayBy(16);

    const user = userEvent.setup();

    await user.click(
      screen.getAllByText(`${capitalize(paymentMethods[0]!.brand)} ××××-${paymentMethods[0]!.last4}`)[0]!
    );
    await user.click(screen.getByText(`${capitalize(paymentMethods[1]!.brand)} ××××-${paymentMethods[1]!.last4}`));

    await user.click(renderResult.getByText(/By reactivating/));

    await user.click(screen.getByText('Submit'));

    assertCalledOnceWith(TestBed.inject(Router).navigateByUrl, '/my/subscription');

    expect(
      screen.getByText(
        'Your Essential (Monthly) subscription has been reactivated. Thank you for your continuing support.'
      )
    ).toBeInTheDocument();
  });

  it('Can add payment method', async () => {
    location.pathname = '/checkout';

    await render({
      additionalHttpHandlers: [
        http.get(`${__ORCHESTRATOR_URL__}/v1/billing/my/management/page/payment-method`, ({ request }) => {
          expect(request.url).toContain('?returnUrlPath=/checkout');

          return HttpResponse.json(convertToResponsePayload('http://localhost:4200/hello-world'));
        })
      ]
    });

    const user = userEvent.setup();
    await user.click(screen.getByText('Add payment method'));

    expect(ProgressService.prototype.openIndeterminateProgressIndicator).toHaveBeenCalledOnce();

    expect(location.href.endsWith('/hello-world')).toEqual(true);
  });

  it('Show an error notification when getting link to add payment method fails with "no billing info exists"', async () => {
    await render({
      additionalHttpHandlers: [
        http.get(`${__ORCHESTRATOR_URL__}/v1/billing/my/management/page/payment-method`, () => {
          return HttpResponse.json(
            convertToResponsePayload({ code: ExceptionCode.NOT_FOUND }, 'no billing info exists'),
            {
              status: 404
            }
          );
        })
      ]
    });

    const user = userEvent.setup();
    await user.click(screen.getByText('Add payment method'));

    expect(
      screen.getByText(`Unable to add new payment method because we don't have your billing info on file.`)
    ).toBeInTheDocument();
  });

  it('Show an error notification with default message when getting link to add payment method fails unknowingly', async () => {
    await render({
      additionalHttpHandlers: [
        http.get(`${__ORCHESTRATOR_URL__}/v1/billing/my/management/page/payment-method`, () => {
          return HttpResponse.json(convertToResponsePayload({ code: ExceptionCode.UNKNOWN }, 'expected'), {
            status: 500
          });
        })
      ]
    });

    const user = userEvent.setup();
    await user.click(screen.getByText('Add payment method'));

    expect(
      screen.getByText(/An unknown error has occurred while processing your request\. Please try again later\./)
    ).toBeInTheDocument();
  });
});
