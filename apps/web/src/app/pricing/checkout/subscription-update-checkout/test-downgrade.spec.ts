/* eslint-disable @stylistic/quotes */
/* eslint-disable max-len */
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { ExceptionCode } from '@lazycuh/http/src';
import { Logger } from '@lazycuh/logging';
import { UserService } from '@lazycuh/web-ui-common/auth';
import { capitalize } from '@lazycuh/web-ui-common/capitalize';
import { EntitlementService, Plan } from '@lazycuh/web-ui-common/entitlement';
import { ProgressService } from '@lazycuh/web-ui-common/progress';
import { delayBy } from '@lazycuh/web-ui-common/utils/delay-by';
import { screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { delay, http, HttpHandler, HttpResponse } from 'msw';
import { PaymentMethod } from 'src/app/user-dashboard/payment-method-list/models';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { TaskService } from '@common/task';

import { ESSENTIAL_MONTHLY_PLAN, FREE_MONTHLY_PLAN, LITE_MONTHLY_PLAN } from 'test/data';
import {
  assertCalledOnceWith,
  convertToResponsePayload,
  deepCloneObject,
  mockAuthenticatedUser,
  renderComponent,
  startMockingApiRequests
} from 'test/utils';
import { generateAuthenticatedUser } from 'test/utils/generate-authenticated-user';

import { CheckoutComponent } from '../checkout.component';
import { CheckoutPreviewResponse } from '../models';
import { CheckoutService } from '../services';

describe('Subscription downgrade checkout', () => {
  type RenderOptions = {
    additionalHandlers: HttpHandler[];
    checkoutPreviewResponse: Partial<CheckoutPreviewResponse>;
    selectedPlan: Plan;
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
    options.checkoutPreviewResponse = Object.assign(
      {
        amountDue: '-199',
        currencyCode: 'usd',
        discount: '0',
        refund: '398',
        storedPaymentMethods: paymentMethods,
        subtotal: '-199',
        tax: '19.9',
        taxPercentage: '10'
      } satisfies CheckoutPreviewResponse,
      options.checkoutPreviewResponse ?? {}
    );

    options.selectedPlan = deepCloneObject(options.selectedPlan ?? LITE_MONTHLY_PLAN);

    apiRequestMockServer.resetHandlers(
      http.get(`${__ORCHESTRATOR_URL__}/v1/checkout/preview`, ({ request }) => {
        if (!request.url.includes(`offeringId=${options.selectedPlan!.offeringId}`)) {
          throw new Error('Request URL does not contain the correct `offeringId` query param');
        }

        return HttpResponse.json(convertToResponsePayload(options.checkoutPreviewResponse));
      }),
      ...(options.additionalHandlers ?? [])
    );

    const renderResult = await renderComponent(CheckoutComponent, {
      providers: [
        CheckoutService,
        {
          provide: Router,
          useValue: {
            getCurrentNavigation: () => ({
              extras: { state: { checkoutSession: { selectedPlan: options.selectedPlan, type: 'DOWNGRADE' } } }
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

    mockAuthenticatedUser(ESSENTIAL_MONTHLY_PLAN);
  });

  it('Shows loader while fetching checkout preview', async () => {
    apiRequestMockServer.resetHandlers(
      http.get(`${__ORCHESTRATOR_URL__}/v1/checkout/preview`, async () => {
        await delay(1000);

        return HttpResponse.json(
          convertToResponsePayload({
            amountDue: '-199',
            currencyCode: 'usd',
            discount: '0',
            refund: '398',
            subtotal: '-199',
            tax: '19.9',
            taxPercentage: '10'
          }),
          {}
        );
      })
    );

    await renderComponent(CheckoutComponent, {
      providers: [
        CheckoutService,
        EntitlementService,
        TaskService,
        {
          provide: Router,
          useValue: {
            getCurrentNavigation: () => ({
              extras: {
                state: { checkoutSession: { selectedPlan: deepCloneObject(ESSENTIAL_MONTHLY_PLAN), type: 'DOWNGRADE' } }
              }
            }),
            navigateByUrl: vi.fn().mockResolvedValue(true)
          }
        }
      ]
    });

    expect(screen.getByText(`Please wait while we're preparing your order summary`)).toBeInTheDocument();
  });

  it('Renders checkout summary correctly', async () => {
    const renderResult = await render();

    const user = userEvent.setup();

    expect(renderResult.container.querySelector('[aria-label="Return to previous page"]')).toBeInTheDocument();
    expect(screen.getByText('Order summary')).toBeInTheDocument();
    expect(screen.getByText('Lite')).toBeInTheDocument();
    expect(screen.getAllByText('-$1.99')).toHaveLength(2);
    expect(screen.getByText('then $2.19 per month')).toBeInTheDocument();

    const infoTooltipButton = renderResult.getByText('then $2.19 per month').querySelector('.info-tooltip button')!;
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
    expect(screen.getByText('30 days data storage')).toBeInTheDocument();
    expect(screen.getByText('Ability to embed images')).toBeInTheDocument();
    expect(screen.getByText('Subtotal')).toBeInTheDocument();
    expect(screen.getByText('$1.99')).toBeInTheDocument();
    expect(screen.getByText('Refund')).toBeInTheDocument();

    await user.click(renderResult.getByText('Refund').querySelector('.info-tooltip button')!);
    expect(screen.getByText(/refunding the unused portion of your current subscription\./)).toBeInTheDocument();
    expect(screen.getByText('-$3.98')).toBeInTheDocument();
    // expect(screen.getByText('Redeem coupon')).toBeInTheDocument();
    expect(screen.getByText('Tax')).toBeInTheDocument();
    expect(screen.getByText('$0.20 (10%)')).toBeInTheDocument();
    expect(screen.getByText('Due today')).toBeInTheDocument();

    expect(screen.getByText('Payment method')).toBeInTheDocument();
    expect(
      screen.getByText(`${capitalize(paymentMethods[0]!.brand)} ××××-${paymentMethods[0]!.last4}`)
    ).toBeInTheDocument();

    await user.click(screen.getByText('Due today').querySelector('.info-tooltip button')!);
    expect(
      screen.getByText(
        'A refund in the amount of $1.99 will be issued back to your Visa ××××-1111 within 5-10 business days.'
      )
    ).toBeInTheDocument();

    expect(screen.getByText('Refund policy')).toHaveAttribute('href', '/policies/refund-policy');
    expect(
      screen.getByText(
        'By downgrading your subscription to Lite (Monthly), you acknowledge and agree to the terms and conditions of the reduced plan, including any changes to features, pricing, and billing cycles.'
      )
    ).toBeInTheDocument();

    expect(screen.queryByText(/You also authorize Cloudy Clip to charge/)).not.toBeInTheDocument();
  });

  it('Does not render tooltip for recurring amount when the amount is 0', async () => {
    const renderResult = await render({ selectedPlan: FREE_MONTHLY_PLAN });

    const infoTooltipButton = renderResult.getByText('then $0.00 per month').querySelector('.info-tooltip button')!;
    expect(infoTooltipButton).toBeNull();
  });

  it('Shows $0.00 for tax when there is no tax', async () => {
    await render({ checkoutPreviewResponse: { tax: '0', taxPercentage: '0.00' } });

    expect(screen.getByText('$0.00')).toBeInTheDocument();
  });

  it('Updates to new plan, shows a success notification, and navigates to /my/subscription page after changing plan successfuly', async () => {
    vi.spyOn(UserService.prototype, 'restoreSession').mockResolvedValue(true);

    const taskId = 'task-id';

    const renderResult = await render({
      additionalHandlers: [
        http.put(`${__ORCHESTRATOR_URL__}/v1/subscriptions/my`, async ({ request }) => {
          const clonedRequest = request.clone();
          const requestBody = (await clonedRequest.json()) as { offeringId: string; paymentMethodId: string };

          expect(requestBody.offeringId, 'Request body does not contain expected offeringId').toEqual(
            LITE_MONTHLY_PLAN.offeringId
          );

          expect(requestBody.paymentMethodId, 'paymentMethodId does not contain expected value').toEqual(
            paymentMethods[0]!.paymentMethodId
          );

          return HttpResponse.json(convertToResponsePayload(taskId));
        }),
        http.get(`${__ORCHESTRATOR_URL__}/v1/tasks/${taskId}`, () => {
          return HttpResponse.json(
            convertToResponsePayload({
              comment: null,
              status: 'SUCCESS',
              type: 'SUBSCRIPTION_UPDATE_PAYMENT',
              updatedAt: new Date().toISOString()
            })
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
        .findActiveSubscription()
        .map(e => e.plan.offeringId)
        .orElseThrow()
    ).toEqual(TEST_USER_WITH_ESSENTIAL_MONTHLY_SUBSCRIPTION.subscription?.plan.offeringId);

    await user.click(renderResult.getByText(/By downgrading your subscription to Lite \(Monthly\)/));

    expect(submitButton).toBeEnabled();
    await user.click(submitButton);

    expect(
      entitlementService
        .findActiveSubscription()
        .map(e => e.plan.offeringId)
        .orElseThrow()
    ).toEqual(LITE_MONTHLY_PLAN.offeringId);

    assertCalledOnceWith(TestBed.inject(Router).navigateByUrl, '/my/subscription');

    expect(
      screen.getByText(/Your request to change to Lite \(Monthly\) plan has been processed successfully\./)
    ).toBeInTheDocument();

    expect(screen.getByText(/A refund of approximately/)).toBeInTheDocument();

    expect(screen.getAllByText('$1.99')).toHaveLength(2);

    expect(
      screen.getByText(/will be issued back to the original payment method within 5-10 business days\./)
    ).toBeInTheDocument();

    expect(screen.getByText(/To check the status of your refund, please go to/)).toBeInTheDocument();

    expect(screen.getByText(/Billing history/)).toBeInTheDocument();
  });

  it('Should use the selected payment method', async () => {
    vi.spyOn(UserService.prototype, 'restoreSession').mockResolvedValue(true);

    const taskId = 'task-id';

    const renderResult = await render({
      additionalHandlers: [
        http.put(`${__ORCHESTRATOR_URL__}/v1/subscriptions/my`, async ({ request }) => {
          const clonedRequest = request.clone();
          const requestBody = (await clonedRequest.json()) as { offeringId: string; paymentMethodId: string };

          expect(requestBody.offeringId, 'Request body does not contain expected offeringId').toEqual(
            LITE_MONTHLY_PLAN.offeringId
          );

          expect(requestBody.paymentMethodId, 'paymentMethodId does not contain expected value').toEqual(
            paymentMethods[1]!.paymentMethodId
          );

          return HttpResponse.json(convertToResponsePayload(taskId));
        }),
        http.get(`${__ORCHESTRATOR_URL__}/v1/tasks/${taskId}`, () => {
          return HttpResponse.json(
            convertToResponsePayload({
              comment: null,
              status: 'SUCCESS',
              type: 'SUBSCRIPTION_UPDATE_PAYMENT',
              updatedAt: new Date().toISOString()
            })
          );
        })
      ]
    });

    const user = userEvent.setup();

    await user.click(screen.getByText(`${capitalize(paymentMethods[0]!.brand)} ××××-${paymentMethods[0]!.last4}`));
    await user.click(screen.getByText(`${capitalize(paymentMethods[1]!.brand)} ××××-${paymentMethods[1]!.last4}`));

    await user.click(renderResult.getByText(/By downgrading your subscription to Lite \(Monthly\)/));

    await user.click(screen.getByText('Submit'));

    assertCalledOnceWith(TestBed.inject(Router).navigateByUrl, '/my/subscription');

    await delayBy(16);

    expect(
      screen.getByText(/Your request to change to Lite \(Monthly\) plan has been processed successfully\./)
    ).toBeInTheDocument();
  });

  it('Shows notification when payment fails right away when calling subscription update endpoint', async () => {
    const renderResult = await render({
      additionalHandlers: [
        http.put(`${__ORCHESTRATOR_URL__}/v1/subscriptions/my`, () => {
          return HttpResponse.json(
            convertToResponsePayload({
              code: ExceptionCode.FAILED_PAYMENT,
              extra: { failureReason: 'card_declined.insufficient_funds' }
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
        .findActiveSubscription()
        .map(e => e.plan.offeringId)
        .orElseThrow()
    ).toEqual(TEST_USER_WITH_ESSENTIAL_MONTHLY_SUBSCRIPTION.subscription?.plan.offeringId);

    await user.click(renderResult.getByText(/By downgrading your subscription to Lite \(Monthly\)/));

    expect(submitButton).toBeEnabled();
    await user.click(submitButton);

    expect(
      entitlementService
        .findActiveSubscription()
        .map(e => e.plan.offeringId)
        .orElseThrow()
    ).toEqual(TEST_USER_WITH_ESSENTIAL_MONTHLY_SUBSCRIPTION.subscription?.plan.offeringId);

    expect(TestBed.inject(Router).navigateByUrl).not.toHaveBeenCalled();

    await delayBy(250);

    expect(
      screen.getByText('Your card has insufficient funds to complete the order. Please use a different card.')
    ).toBeInTheDocument();
  });

  it('Show notification when payment task fails', async () => {
    const taskId = 'task-id';

    const renderResult = await render({
      additionalHandlers: [
        http.put(`${__ORCHESTRATOR_URL__}/v1/subscriptions/my`, () => {
          return HttpResponse.json(convertToResponsePayload(taskId));
        }),
        http.get(`${__ORCHESTRATOR_URL__}/v1/tasks/${taskId}`, () => {
          return HttpResponse.json(
            convertToResponsePayload({
              comment: null,
              status: 'FAILURE',
              type: 'SUBSCRIPTION_UPDATE_PAYMENT',
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
        .findActiveSubscription()
        .map(e => e.plan.offeringId)
        .orElseThrow()
    ).toEqual(TEST_USER_WITH_ESSENTIAL_MONTHLY_SUBSCRIPTION.subscription?.plan.offeringId);

    await user.click(renderResult.getByText(/By downgrading your subscription to Lite \(Monthly\)/));

    expect(submitButton).toBeEnabled();
    await user.click(submitButton);

    expect(
      entitlementService
        .findActiveSubscription()
        .map(e => e.plan.offeringId)
        .orElseThrow()
    ).toEqual(TEST_USER_WITH_ESSENTIAL_MONTHLY_SUBSCRIPTION.subscription?.plan.offeringId);

    expect(TestBed.inject(Router).navigateByUrl).not.toHaveBeenCalled();

    await delayBy(250);

    expect(
      screen.getByText(
        'We were not able to contact your bank for the payment. Please try again later or contact your bank for details.'
      )
    ).toBeInTheDocument();
  });

  it('Shows notification with default error message when updating subscription fails unknowningly', async () => {
    const taskId = 'task-id';

    const renderResult = await render({
      additionalHandlers: [
        http.put(`${__ORCHESTRATOR_URL__}/v1/subscriptions/my`, () => {
          return HttpResponse.json(convertToResponsePayload(taskId));
        }),
        http.get(`${__ORCHESTRATOR_URL__}/v1/tasks/${taskId}`, () => {
          return HttpResponse.json(
            convertToResponsePayload({
              comment: null,
              status: 'FAILURE',
              type: 'SUBSCRIPTION_UPDATE_PAYMENT',
              updatedAt: new Date().toISOString()
            })
          );
        }),
        http.get(`${__ORCHESTRATOR_URL__}/v1/billing/my/payments`, ({ request }) => {
          if (!request.url.includes('offset=0&limit=1')) {
            throw new Error('Request URL does not contain the correct `offset` and `limit` query params');
          }

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
        .findActiveSubscription()
        .map(e => e.plan.offeringId)
        .orElseThrow()
    ).toEqual(TEST_USER_WITH_ESSENTIAL_MONTHLY_SUBSCRIPTION.subscription?.plan.offeringId);

    await user.click(renderResult.getByText(/By downgrading your subscription to Lite \(Monthly\)/));

    expect(submitButton).toBeEnabled();
    await user.click(submitButton);

    expect(
      entitlementService
        .findActiveSubscription()
        .map(e => e.plan.offeringId)
        .orElseThrow()
    ).toEqual(TEST_USER_WITH_ESSENTIAL_MONTHLY_SUBSCRIPTION.subscription?.plan.offeringId);

    expect(TestBed.inject(Router).navigateByUrl).not.toHaveBeenCalled();

    await delayBy(16);

    expect(
      screen.getByText(/An unknown error has occurred while processing your request\. Please try again later\./)
    ).toBeInTheDocument();

    expect(Logger.prototype.error).toHaveBeenCalledWith(
      'failed to update subscription',
      {
        message: 'subscription update task has encountered an unknown error',
        payload: {
          code: ExceptionCode.UNKNOWN,
          extra: {
            originalStacktrace: expect.any(String)
          },

          requestId: expect.any(String),
          requestMethod: '',
          requestPath: '',

          timestamp: expect.any(String)
        }
      },
      {
        currentPlan: 'Essential (Monthly)',
        paymentMethodId: 'pm_1',
        selectedPlan: 'Lite (Monthly)'
      }
    );
  });

  it('Shows payment method in consent if amount due is not a refund', async () => {
    await render({ checkoutPreviewResponse: { amountDue: '199' } });

    expect(
      screen.getAllByText(`${capitalize(paymentMethods[0]!.brand)} ××××-${paymentMethods[0]!.last4}`)
    ).toHaveLength(2);

    expect(
      screen.getByText(
        /By downgrading your subscription to Lite \(Monthly\), you acknowledge and agree to the terms and conditions of the reduced plan, including any changes to features, pricing, and billing cycles\./
      )
    ).toBeInTheDocument();

    expect(screen.getByText(/You also authorize Cloudy Clip to charge/)).toBeInTheDocument();
    expect(screen.getByText(/for the amount due today\./)).toBeInTheDocument();
  });

  it('Can add payment method', async () => {
    location.pathname = '/checkout';

    await render({
      additionalHandlers: [
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
      additionalHandlers: [
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
      additionalHandlers: [
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
