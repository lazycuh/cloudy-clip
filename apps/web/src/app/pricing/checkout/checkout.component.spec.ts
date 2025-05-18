/* eslint-disable max-len */

import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { Optional } from '@lazycuh/optional';
import { UserService } from '@lazycuh/web-ui-common/auth';
import { Plan } from '@lazycuh/web-ui-common/entitlement';
import { delayBy } from '@lazycuh/web-ui-common/utils/delay-by';
import { Stripe } from '@stripe/stripe-js';
import { screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ESSENTIAL_MONTHLY_PLAN, FREE_MONTHLY_PLAN, LITE_MONTHLY_PLAN } from 'test/data';
import { assertCalledOnceWith, deepCloneObject, mockAuthenticatedUser, renderComponent } from 'test/utils';
import { generateAuthenticatedUser } from 'test/utils/generate-authenticated-user';

import { CheckoutComponent } from './checkout.component';
import { CheckoutService } from './services';

describe(CheckoutComponent.name, () => {
  async function render(currentNavigationExtras: Record<string, unknown>, currentPlan?: Plan) {
    mockAuthenticatedUser(currentPlan);

    const routerMock = {
      getCurrentNavigation: () => ({
        extras: deepCloneObject(currentNavigationExtras)
      }),
      navigateByUrl: vi.fn().mockResolvedValue(true)
    };

    await delayBy(32);

    return renderComponent(CheckoutComponent, {
      providers: [
        CheckoutService,
        {
          provide: Router,
          useValue: routerMock
        }
      ]
    });
  }

  afterEach(() => {
    sessionStorage.clear();
  });

  it('Should navigate to /my/account page when checking out new subscription and user has active paid subscription', async () => {
    await render(
      {
        state: {
          checkoutSession: {
            selectedPlan: ESSENTIAL_MONTHLY_PLAN,
            type: 'NEW_SUBSCRIPTION'
          }
        }
      },
      LITE_MONTHLY_PLAN
    );

    assertCalledOnceWith(TestBed.inject(Router).navigateByUrl, '/my/account');
  });

  it('Should not navigate to /my/account page when checking out new subscription and user has active free subscription', async () => {
    await render(
      {
        state: {
          checkoutSession: {
            selectedPlan: ESSENTIAL_MONTHLY_PLAN,
            type: 'NEW_SUBSCRIPTION'
          }
        }
      },
      FREE_MONTHLY_PLAN
    );

    expect(TestBed.inject(Router).navigateByUrl).not.toHaveBeenCalledOnce();
    expect(screen.getByText('Please enter your billing details')).toBeInTheDocument();
  });

  it('Should not navigate to /my/account page when checking out new subscription and user has a canceled subscription', async () => {
    const user = deepCloneObject(generateAuthenticatedUser(LITE_MONTHLY_PLAN));
    user.subscription!.canceledAt = new Date().toISOString();
    user.subscription!.cancellationReason = 'REQUESTED_BY_USER';

    vi.spyOn(UserService.prototype, 'getAuthenticatedUser').mockReturnValue(user);
    vi.spyOn(UserService.prototype, 'findAuthenticatedUser').mockReturnValue(Optional.of(user));

    const routerMock = {
      getCurrentNavigation: () => ({
        extras: deepCloneObject({
          state: {
            checkoutSession: {
              selectedPlan: ESSENTIAL_MONTHLY_PLAN,
              type: 'NEW_SUBSCRIPTION'
            }
          }
        })
      }),
      navigateByUrl: vi.fn().mockResolvedValue(true)
    };

    await renderComponent(CheckoutComponent, {
      providers: [
        CheckoutService,
        {
          provide: Router,
          useValue: routerMock
        }
      ]
    });

    expect(TestBed.inject(Router).navigateByUrl).not.toHaveBeenCalledOnce();
    expect(screen.getByText('Please enter your billing details')).toBeInTheDocument();
  });

  it('Should not navigate to /my/account page when updating an active subscription', async () => {
    vi.spyOn(CheckoutService.prototype, 'previewCheckout').mockResolvedValue({
      amountDue: '239.9',
      currencyCode: 'usd',
      discount: '0',
      refund: '199',
      storedPaymentMethods: [],
      subtotal: '200',
      tax: '39.9',
      taxPercentage: '10'
    });

    await render(
      {
        state: {
          checkoutSession: {
            selectedPlan: LITE_MONTHLY_PLAN,
            type: 'UPGRADE'
          }
        }
      },
      FREE_MONTHLY_PLAN
    );

    expect(TestBed.inject(Router).navigateByUrl).not.toHaveBeenCalledOnce();
    expect(screen.getByText(/By upgrading your subscription/)).toBeInTheDocument();
  });

  it('Should navigate to /pricing page when checkout session is not found', async () => {
    await render({});

    assertCalledOnceWith(TestBed.inject(Router).navigateByUrl, '/pricing');
  });

  it('Renders correctly when window.stripeInstance is null', async () => {
    window.stripeInstance = null;

    await render({
      state: {
        checkoutSession: {
          selectedPlan: LITE_MONTHLY_PLAN,
          type: 'NEW_SUBSCRIPTION'
        }
      }
    });

    expect(screen.getByText('Unable to establish your checkout session')).toBeInTheDocument();
    expect(screen.getByText('We were not able to determine what went wrong.')).toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(screen.getByText('Reload page'));
    expect(window.location.reload).toHaveBeenCalledOnce();

    expect(screen.getByText('Contact us')).toHaveAttribute(
      'href',
      'mailto:heretohelp@cloudyclip.com?subject=%5BTrade%20Timeline%5D%20Unable%20to%20establish%20checkout%20session&body=Please%20check%20why%20I%20was%20not%20able%20to%20check%20out.%20My%20email%20address%20is%20helloworld@gmail.com'
    );
  });

  it('Should use stored checkout session found in session storage', async () => {
    sessionStorage.setItem(
      'checkoutSession',
      JSON.stringify({
        selectedPlan: LITE_MONTHLY_PLAN,
        type: 'NEW_SUBSCRIPTION'
      })
    );

    window.stripeInstance = {} as unknown as Stripe;

    vi.spyOn(CheckoutService.prototype, 'findBillingInfo').mockResolvedValue(Optional.empty());

    await render({});

    await delayBy(32);

    expect(screen.getByText('Please enter your billing details')).toBeInTheDocument();
  });

  it('Navigates to /pricing page when checkout session is neither found in session storage nor in router state', async () => {
    await render({});

    assertCalledOnceWith(TestBed.inject(Router).navigateByUrl, '/pricing');
  });
});
