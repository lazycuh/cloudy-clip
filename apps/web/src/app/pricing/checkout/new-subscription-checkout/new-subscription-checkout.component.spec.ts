/* eslint-disable camelcase */
/* eslint-disable @stylistic/quotes */
/* eslint-disable max-len */
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { ExceptionCode, getAliasFor } from '@lazycuh/http/src';
import { Logger } from '@lazycuh/logging';
import { UserService } from '@lazycuh/web-ui-common/auth';
import { EntitlementService, Plan } from '@lazycuh/web-ui-common/entitlement';
import { delayBy } from '@lazycuh/web-ui-common/utils/delay-by';
import { StripeElements, StripeError, StripePaymentElement } from '@stripe/stripe-js';
import { screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { http, HttpHandler, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { calculateTax, parseCurrency } from '@common/currency';
import { TaskService } from '@common/task';

import { ESSENTIAL_MONTHLY_PLAN, FREE_MONTHLY_PLAN } from 'test/data';
import {
  assertCalledOnceWith,
  convertToResponsePayload,
  deepCloneObject,
  renderComponent,
  startMockingApiRequests
} from 'test/utils';
import { generateAuthenticatedUser } from 'test/utils/generate-authenticated-user';

import { CheckoutComponent } from '../checkout.component';
import { NewSubscriptionCheckoutResponse } from '../models';
import { CheckoutService } from '../services';

import { NewSubscriptionCheckoutComponent } from './new-subscription-checkout.component';

type RenderOptions = {
  additionalHandlers?: HttpHandler[];
  billingInfoResponse?: HttpResponse;
  checkoutResponse?: Partial<NewSubscriptionCheckoutResponse>;
  selectedPlan?: Plan;
};

describe(NewSubscriptionCheckoutComponent.name, () => {
  const TEST_USER_WITHOUT_SUBSCRIPTION = generateAuthenticatedUser();
  const apiRequestMockServer = startMockingApiRequests();

  let stripeElementsInstanceMock: Partial<StripeElements>;
  let stripePaymentElementMock: Partial<StripePaymentElement>;

  async function render(options: RenderOptions = {}) {
    options = Object.assign(
      {
        billingInfoResponse: new HttpResponse(undefined, { status: 404 })
      },
      options
    );

    const selectedPlan = deepCloneObject(options.selectedPlan ?? ESSENTIAL_MONTHLY_PLAN);

    apiRequestMockServer.resetHandlers(
      http.get(`${__ORCHESTRATOR_URL__}/v1/billing/my/info`, () => {
        return options.billingInfoResponse;
      }),
      ...(options.additionalHandlers ?? [])
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
              extras: { state: { checkoutSession: { selectedPlan, type: 'NEW_SUBSCRIPTION' } } }
            }),
            navigateByUrl: vi.fn().mockResolvedValue(true)
          }
        }
      ]
    });

    return renderResult;
  }

  async function fillOutBillingInfoFormAndGoToPaymentScreen(options: RenderOptions = {}) {
    const selectedPlan = options.selectedPlan ?? ESSENTIAL_MONTHLY_PLAN;
    const taxPercentage = '10';
    const tax = calculateTax(selectedPlan.discountedPrice, options.checkoutResponse?.taxPercentage ?? taxPercentage);

    const checkoutResponse: NewSubscriptionCheckoutResponse = Object.assign(
      {
        amountDue: String(parseCurrency(selectedPlan.discountedPrice).add(tax).intValue),
        clientSecret: 'client-secret',
        discount: '0',
        tax: String(tax.intValue),
        taxPercentage
      },
      options.checkoutResponse ?? {}
    );

    options.checkoutResponse = checkoutResponse;

    options.additionalHandlers ??= [
      http.post(`${__ORCHESTRATOR_URL__}/v1/checkout`, () => {
        return HttpResponse.json(
          convertToResponsePayload({
            checkoutResponse,
            taskId: 'taskId'
          })
        );
      })
    ];

    const renderResult = await render(options);

    const continueToPaymentButton = renderResult.container.querySelector('button[aria-label="Continue to payment"]')!;
    expect(continueToPaymentButton).toBeDisabled();

    const user = userEvent.setup();
    await user.type(renderResult.getByLabelText('Full name'), TEST_USER_WITHOUT_SUBSCRIPTION.displayName);
    await user.type(renderResult.getByLabelText('Country'), 'United States');
    await user.type(renderResult.getByLabelText('Zip code/Postal code'), '99301');

    const carouselItems = renderResult.container.querySelectorAll('[role="tabpanel"]');
    expect(carouselItems).toHaveLength(2);
    expect(carouselItems[0]).toHaveAttribute('aria-hidden', 'false');
    expect(carouselItems[1]).toHaveAttribute('aria-hidden', 'true');

    expect(continueToPaymentButton).toBeEnabled();
    await user.click(continueToPaymentButton);

    expect(carouselItems[0]).toHaveAttribute('aria-hidden', 'true');
    expect(carouselItems[1]).toHaveAttribute('aria-hidden', 'false');

    await delayBy(16);

    return renderResult;
  }

  beforeEach(() => {
    stripePaymentElementMock = {
      mount: vi.fn(),
      off: vi.fn(),
      on: vi.fn().mockImplementation((event: string, fn: (event: { complete: boolean }) => void) => {
        if (event === 'change') {
          fn({ complete: true });
        }
      }),
      once: vi.fn().mockImplementation((event: string, fn: () => void) => {
        if (event === 'ready') {
          fn();
        }
      }),
      update: vi.fn()
    };

    stripeElementsInstanceMock = {
      create: vi.fn().mockReturnValue(stripePaymentElementMock)
    };

    vi.stubGlobal('stripeInstance', {
      confirmPayment: vi.fn().mockResolvedValue({}),
      elements: vi.fn().mockReturnValue(stripeElementsInstanceMock)
    });

    vi.spyOn(UserService.prototype, 'getAuthenticatedUser').mockReturnValue(TEST_USER_WITHOUT_SUBSCRIPTION);
  });

  it('Renders checkout summary correctly', { timeout: 10000 }, async () => {
    const renderResult = await render();

    const user = userEvent.setup();

    expect(renderResult.container.querySelector('[aria-label="Return to previous page"]')).toBeInTheDocument();
    expect(screen.getByText('Order summary')).toBeInTheDocument();
    expect(screen.getByText('Essential')).toBeInTheDocument();
    expect(screen.getByText('then $3.99 per month')).toBeInTheDocument();

    const infoTooltipButton = renderResult.container.querySelector('.info-tooltip button')!;
    expect(infoTooltipButton).toBeInTheDocument();
    await user.click(infoTooltipButton);

    expect(
      screen.getByText(
        /is the estimated recurring total as of today\. This price may change if your tax rates or applied discounts change in the/
      )
    ).toBeInTheDocument();
    expect(screen.getAllByText('$3.99')).toHaveLength(3);
    expect(screen.getByText(`What you'll get:`)).toBeInTheDocument();
    expect(screen.getByText('Unlimited number of journal entries')).toBeInTheDocument();
    expect(screen.getByText('No character count restriction')).toBeInTheDocument();
    expect(screen.getByText('Lifetime data storage')).toBeInTheDocument();
    expect(screen.getByText('Ability to embed images')).toBeInTheDocument();
    expect(screen.getByText('Subtotal')).toBeInTheDocument();
    // expect(screen.getByText('Redeem coupon')).toBeInTheDocument();
    expect(screen.getByText('Tax')).toBeInTheDocument();
    expect(screen.getByText('Calculated at next step')).toBeInTheDocument();
    expect(screen.getByText('Due today')).toBeInTheDocument();
    expect(screen.getByText('Refund policy')).toHaveAttribute('href', '/policies/refund-policy');
    expect(screen.getByText('Please enter your billing details')).toBeInTheDocument();
    expect(
      screen.getByText('We collect this information to help combat fraud, and to keep your payment secure.')
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Full name')).toHaveValue('');
    expect(screen.getByLabelText('Country')).toHaveValue('United States');
    expect(screen.getByLabelText('Zip code/Postal code')).toHaveValue('');
  });

  it("Populates billing info form when user's billing info already exists", async () => {
    const renderResult = await render({
      billingInfoResponse: HttpResponse.json({
        payload: {
          countryCode: 'US',
          postalCode: '99301'
        }
      })
    });

    expect(renderResult.getByLabelText('Full name')).toHaveValue(TEST_USER_WITHOUT_SUBSCRIPTION.displayName);
    expect(renderResult.getByLabelText('Country')).toHaveValue('United States');
    expect(renderResult.getByLabelText('Zip code/Postal code')).toHaveValue('99301');
  });

  it('Updates payment summary after filling out billing info', async () => {
    await fillOutBillingInfoFormAndGoToPaymentScreen({
      additionalHandlers: [
        http.post(`${__ORCHESTRATOR_URL__}/v1/checkout`, () => {
          return HttpResponse.json(
            convertToResponsePayload({
              checkoutResponse: {
                amountDue: '438.9',
                clientSecret: 'client-secret',
                discount: '0',
                tax: '39.9',
                taxPercentage: '10'
              },
              taskId: 'taskId'
            })
          );
        })
      ]
    });

    expect(screen.getAllByText('$4.39')).toHaveLength(3);
    expect(screen.getByText('then $4.39 per month')).toBeInTheDocument();
    expect(screen.getByText('$0.40 (10%)')).toBeInTheDocument();
    expect(screen.queryByText('Calculated at next step')).not.toBeInTheDocument();

    assertCalledOnceWith(
      HttpClient.prototype.post,
      `${__ORCHESTRATOR_URL__}/v1/checkout`,
      {
        countryCode: 'US',
        couponCode: '',
        fullName: TEST_USER_WITHOUT_SUBSCRIPTION.displayName,
        offeringId: ESSENTIAL_MONTHLY_PLAN.offeringId,
        postalCode: '99301'
      },
      { headers: { [getAliasFor('turnstileTokenHeader')]: 'test-token' } }
    );
  });

  it('Shows $0.00 for tax when there is no tax', async () => {
    await fillOutBillingInfoFormAndGoToPaymentScreen({ checkoutResponse: { tax: '0', taxPercentage: '0.00' } });

    expect(screen.getByText('$0.00')).toBeInTheDocument();
    expect(screen.queryByText('Calculated at next step')).not.toBeInTheDocument();
  });

  it('Goes to payment confirmation screen after filling out billing info', async () => {
    await fillOutBillingInfoFormAndGoToPaymentScreen();

    expect(screen.getByText('$0.40 (10%)')).toBeInTheDocument();
    expect(screen.getByText('Back')).toBeInTheDocument();
    expect(screen.getByText('Confirm payment')).toBeInTheDocument();

    assertCalledOnceWith(window.stripeInstance!.elements, {
      appearance: {
        theme: 'night',
        variables: {
          fontFamily: 'YoMama',
          fontSizeBase: '16px',
          fontSmooth: 'unset'
        }
      },
      clientSecret: 'client-secret',
      fonts: [{ cssSrc: '/styles.css' }],

      loader: 'always'
    });

    // eslint-disable-next-line @typescript-eslint/no-deprecated
    assertCalledOnceWith(stripeElementsInstanceMock.create!, 'payment', {
      defaultValues: {
        billingDetails: {
          address: {
            country: 'US',
            postal_code: '99301'
          },
          email: TEST_USER_WITHOUT_SUBSCRIPTION.email,
          name: TEST_USER_WITHOUT_SUBSCRIPTION.displayName
        }
      },
      fields: { billingDetails: 'never' }
    });

    assertCalledOnceWith(stripePaymentElementMock.mount!, '.lc-checkout__payment__collection');
    expect(stripePaymentElementMock.once).toHaveBeenCalledTimes(2);
    expect(stripePaymentElementMock.once).toHaveBeenCalledWith('ready', expect.any(Function));
    assertCalledOnceWith(stripePaymentElementMock.on!, 'change', expect.any(Function));
    expect(stripePaymentElementMock.once).toHaveBeenCalledWith('loaderror', expect.any(Function));
  });

  it('Shows notification when loading payment form fails', async () => {
    // eslint-disable-next-line vitest/prefer-spy-on
    stripePaymentElementMock.once = vi
      .fn()
      .mockImplementation((event: string, fn: (details: { error: unknown }) => void) => {
        if (event === 'loaderror') {
          fn({ error: new Error('Expected') });
        }
      });

    await fillOutBillingInfoFormAndGoToPaymentScreen();

    expect(screen.getByText('Failed to load payment form. Please trying refreshing your browser.')).toBeInTheDocument();
  });

  it('Shows notification when payment fails', async () => {
    const cardError: StripeError = {
      code: 'card_declined',
      decline_code: 'try_again_later',
      type: 'card_error'
    };

    vi.spyOn(window.stripeInstance!, 'confirmPayment').mockResolvedValue({
      error: cardError
    });

    await fillOutBillingInfoFormAndGoToPaymentScreen();

    const user = userEvent.setup();
    await user.click(screen.getByText('Confirm payment'));

    await delayBy(500);

    expect(
      screen.getByText(
        'Your card was declined. Please try again later or contact your bank for details if the issue persists.'
      )
    ).toBeInTheDocument();

    assertCalledOnceWith(Logger.prototype.error, 'failed to check out paid plan', cardError, {
      plan: 'Essential (Monthly)'
    });
  });

  it('Shows notification when payment for paid plan fails unknowningly', async () => {
    const error = new Error('Expected');
    vi.spyOn(window.stripeInstance!, 'confirmPayment').mockRejectedValue(error);

    await fillOutBillingInfoFormAndGoToPaymentScreen();

    const user = userEvent.setup();
    await user.click(screen.getByText('Confirm payment'));

    await delayBy(16);

    expect(
      screen.getByText(/An unknown error has occurred while processing your request. Please try again later\./)
    ).toBeInTheDocument();

    assertCalledOnceWith(
      Logger.prototype.error,
      'failed to check out paid plan',
      {
        message: 'Expected',
        payload: {
          code: ExceptionCode.UNKNOWN,
          extra: {
            originalStacktrace: error.stack
          },

          requestId: expect.any(String),
          requestMethod: '',
          requestPath: '',

          timestamp: expect.any(String)
        }
      },
      {
        plan: 'Essential (Monthly)'
      }
    );
  });

  it('Shows notification when checking out paid plan fails unknowningly', async () => {
    await render({
      additionalHandlers: [
        http.post(`${__ORCHESTRATOR_URL__}/v1/checkout`, () => {
          return HttpResponse.json(
            convertToResponsePayload(
              {
                code: ExceptionCode.UNKNOWN
              },
              'expected'
            ),
            { status: 500 }
          );
        })
      ],
      selectedPlan: ESSENTIAL_MONTHLY_PLAN
    });

    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Full name'), TEST_USER_WITHOUT_SUBSCRIPTION.displayName);
    await user.type(screen.getByLabelText('Country'), 'United States');
    await user.type(screen.getByLabelText('Zip code/Postal code'), '99301');

    await user.click(screen.getByText('Continue to payment'));

    await delayBy(16);

    expect(
      screen.getByText(/An unknown error has occurred while processing your request. Please try again later\./)
    ).toBeInTheDocument();

    assertCalledOnceWith(
      Logger.prototype.error,
      'failed to check out paid plan',
      {
        message: 'expected',
        payload: { code: ExceptionCode.UNKNOWN }
      },
      {
        plan: 'Essential (Monthly)'
      }
    );
  });

  it('Configures stripe instance to redirect back to purchase confirmation page after successful payment', async () => {
    await fillOutBillingInfoFormAndGoToPaymentScreen();

    const user = userEvent.setup();
    await user.click(screen.getByText('Confirm payment'));

    assertCalledOnceWith(window.stripeInstance!.confirmPayment, {
      clientSecret: '',
      confirmParams: {
        payment_method_data: {
          billing_details: {
            address: {
              city: '',
              country: 'US',
              line1: '',
              line2: '',
              postal_code: '99301',
              state: ''
            },
            email: TEST_USER_WITHOUT_SUBSCRIPTION.email,
            name: TEST_USER_WITHOUT_SUBSCRIPTION.displayName,
            phone: ''
          }
        },
        return_url: `${__ORIGIN__}/purchase/confirmation?task=taskId`
      },
      elements: stripeElementsInstanceMock
    });
  });

  it('Does not ask for payment when checking out free plan', async () => {
    const renderResult = await render({
      additionalHandlers: [
        http.post(`${__ORCHESTRATOR_URL__}/v1/checkout`, () => {
          return HttpResponse.json(
            convertToResponsePayload({
              checkoutResponse: {
                amountDue: '0',
                clientSecret: 'client-secret',
                discount: '0',
                tax: '0',
                taxPercentage: '0.00'
              },
              taskId: 'taskId'
            })
          );
        })
      ],
      selectedPlan: FREE_MONTHLY_PLAN
    });

    expect(screen.getByText('$0.00')).toBeInTheDocument();
    expect(screen.getByText('then $0.00 per month')).toBeInTheDocument();

    expect(renderResult.container.querySelector('button[aria-label="Continue to payment"]')).not.toBeInTheDocument();

    expect(window.location.pathname).not.toEqual('/purchase/confirmation');

    const subscribeButton = renderResult.container.querySelector('button[aria-label="Subscribe to selected plan"]')!;
    expect(subscribeButton).toBeDisabled();

    const user = userEvent.setup();
    await user.type(renderResult.getByLabelText('Full name'), TEST_USER_WITHOUT_SUBSCRIPTION.displayName);
    await user.type(renderResult.getByLabelText('Country'), 'United States');
    await user.type(renderResult.getByLabelText('Zip code/Postal code'), '99301');

    expect(subscribeButton).toBeEnabled();

    await user.click(subscribeButton);

    expect(screen.queryByText('Back')).not.toBeInTheDocument();
    expect(screen.queryByText('Confirm payment')).not.toBeInTheDocument();
    expect(window.location.pathname).toEqual('/purchase/confirmation');
  });

  it('Shows notification when checking out free fails', async () => {
    const renderResult = await render({
      additionalHandlers: [
        http.post(`${__ORCHESTRATOR_URL__}/v1/checkout`, () => {
          return HttpResponse.json(
            convertToResponsePayload(
              {
                code: ExceptionCode.UNKNOWN
              },
              'expected'
            ),
            { status: 500 }
          );
        })
      ],
      selectedPlan: FREE_MONTHLY_PLAN
    });

    const user = userEvent.setup();
    await user.type(renderResult.getByLabelText('Full name'), TEST_USER_WITHOUT_SUBSCRIPTION.displayName);
    await user.type(renderResult.getByLabelText('Country'), 'United States');
    await user.type(renderResult.getByLabelText('Zip code/Postal code'), '99301');

    await user.click(screen.getByText('Subscribe'));

    await delayBy(16);

    expect(
      screen.getByText(/An unknown error has occurred while processing your request. Please try again later\./)
    ).toBeInTheDocument();

    assertCalledOnceWith(
      Logger.prototype.error,
      'failed to check out free plan',
      {
        message: 'expected',
        payload: { code: ExceptionCode.UNKNOWN }
      },
      {
        plan: 'Free (Monthly)'
      }
    );
  });

  it('Can go back and forth between billing info and payment form screens without calling backend', async () => {
    const checkOutNewSubscriptionMethodSpy = vi.spyOn(CheckoutService.prototype, 'checkOutNewSubscription');

    const renderResult = await fillOutBillingInfoFormAndGoToPaymentScreen();

    expect(checkOutNewSubscriptionMethodSpy).toHaveBeenCalledOnce();

    const carouselItems = renderResult.container.querySelectorAll('[role="tabpanel"]');
    const user = userEvent.setup();

    await user.click(screen.getByText('Back'));

    expect(carouselItems[0]).toHaveAttribute('aria-hidden', 'false');
    expect(carouselItems[1]).toHaveAttribute('aria-hidden', 'true');

    await user.click(screen.getByText('Continue to payment'));

    expect(carouselItems[0]).toHaveAttribute('aria-hidden', 'true');
    expect(carouselItems[1]).toHaveAttribute('aria-hidden', 'false');

    expect(checkOutNewSubscriptionMethodSpy).toHaveBeenCalledOnce();
  });

  it('Can go back to update billing info', async () => {
    const checkOutNewSubscriptionMethodSpy = vi.spyOn(CheckoutService.prototype, 'checkOutNewSubscription');

    await fillOutBillingInfoFormAndGoToPaymentScreen();

    expect(checkOutNewSubscriptionMethodSpy).toHaveBeenCalledOnce();

    apiRequestMockServer.resetHandlers(
      http.post(`${__ORCHESTRATOR_URL__}/v1/checkout`, () => {
        return HttpResponse.json(
          convertToResponsePayload({
            checkoutResponse: {
              amountDue: '399',
              clientSecret: 'client-secret',
              discount: '0',
              tax: '0',
              taxPercentage: '0.00'
            },
            taskId: 'taskId'
          })
        );
      })
    );

    const user = userEvent.setup();
    await user.click(screen.getByText('Back'));

    const fullNameInput = screen.getByLabelText('Full name');
    await user.clear(fullNameInput);
    await user.type(fullNameInput, 'New Name');

    await user.click(screen.getByText('Continue to payment'));

    expect(checkOutNewSubscriptionMethodSpy).toHaveBeenCalledTimes(2);

    expect(checkOutNewSubscriptionMethodSpy.mock.lastCall![0].fullName).toEqual('New Name');
  });
});
