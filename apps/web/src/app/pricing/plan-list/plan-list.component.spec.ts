import { Router } from '@angular/router';
import { ExceptionCode } from '@lazycuh/http/src';
import { Plan } from '@lazycuh/web-ui-common/entitlement';
import { screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { ALL_PLANS, ESSENTIAL_MONTHLY_PLAN, FREE_MONTHLY_PLAN, LITE_MONTHLY_PLAN } from 'test/data';
import {
  assertCalledOnceWith,
  convertToResponsePayload,
  deepCloneObject,
  mockAuthenticatedUser,
  renderComponent,
  startMockingApiRequests
} from 'test/utils';

import { CheckoutSession } from '../models';

import { PlanListComponent } from './plan-list.component';
import { PlanListService } from './plan-list.service';

describe(PlanListComponent.name, () => {
  const apiRequestMockServer = startMockingApiRequests();

  async function render(response?: ReturnType<typeof HttpResponse.json>) {
    response ??= HttpResponse.json(convertToResponsePayload(ALL_PLANS));

    apiRequestMockServer.resetHandlers(
      http.get(`${__ORCHESTRATOR_URL__}/v1/plans`, () => {
        return response;
      })
    );

    mockAuthenticatedUser(LITE_MONTHLY_PLAN);

    return renderComponent(PlanListComponent, {
      providers: [PlanListService]
    });
  }

  it('Has "Start for free" button', async () => {
    await render();

    const user = userEvent.setup();
    await user.click(screen.getAllByText('Start for free')[0]!);

    assertCalledOnceWith(Router.prototype.navigateByUrl, '/checkout', {
      state: {
        checkoutSession: new CheckoutSession(FREE_MONTHLY_PLAN, 'NEW_SUBSCRIPTION')
      }
    });
  });

  it('Has expected tag line', async () => {
    const renderResult = await render();

    expect(renderResult.container.querySelector('.plan-list__tag-line')).toHaveTextContent(
      'Start for free or Try one of our most affordable plans'
    );
  });

  it('Can show monthly and yearly plans', async () => {
    const renderResult = await render();

    expect(screen.getByText('Monthly')).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByText('Yearly')).toHaveAttribute('aria-checked', 'false');
    expect(renderResult.container.querySelector('.plan-item__price__renewal-interval')).toHaveTextContent('per month');
    expect(window.location.href).toContain('interval=1m');

    const user = userEvent.setup();
    await user.click(screen.getByText('Yearly'));

    expect(screen.getByText('Monthly')).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByText('Yearly')).toHaveAttribute('aria-checked', 'true');
    expect(renderResult.container.querySelector('.plan-item__price__renewal-interval')).toHaveTextContent('per year');
    expect(window.location.href).toContain('interval=1y');
  });

  it('Navigates to unknown error page when fetching plans fails', async () => {
    await render(
      HttpResponse.json(convertToResponsePayload({ code: ExceptionCode.UNKNOWN }, 'expected'), { status: 500 })
    );

    assertCalledOnceWith(Router.prototype.navigateByUrl, '/errors/unknown', {
      skipLocationChange: true,
      state: { requestId: undefined }
    });
  });

  it('Navigates to renewal interval change checkout page', async () => {
    await render();

    const user = userEvent.setup();
    await user.click(screen.getByText('Yearly'));
    await user.click(screen.getByText('Switch to yearly'));

    assertCalledOnceWith(Router.prototype.navigateByUrl, '/checkout', {
      state: {
        checkoutSession: new CheckoutSession(expect.anything() as Plan, 'RENEWAL_INTERVAL_CHANGE')
      }
    });

    await user.click(screen.getByText('Monthly'));
  });

  it('Navigates to downgrade checkout page', async () => {
    await render();

    const user = userEvent.setup();
    await user.click(screen.getByText('Downgrade'));

    assertCalledOnceWith(Router.prototype.navigateByUrl, '/checkout', {
      state: {
        checkoutSession: new CheckoutSession(expect.anything() as Plan, 'DOWNGRADE')
      }
    });
  });

  it('Navigates to upgrade checkout page', async () => {
    await render();

    const user = userEvent.setup();
    await user.click(screen.getByText('Upgrade'));

    const essentialMonthlyPlan = deepCloneObject(ESSENTIAL_MONTHLY_PLAN);
    essentialMonthlyPlan.isFreePlan = false;

    assertCalledOnceWith(Router.prototype.navigateByUrl, '/checkout', {
      state: {
        checkoutSession: new CheckoutSession(expect.anything() as Plan, 'UPGRADE')
      }
    });
  });

  it('Can switch between viewing monthly and yearly plans', async () => {
    await render();

    const user = userEvent.setup();

    expect(screen.getAllByText('per')).toHaveLength(3);
    expect(screen.getAllByText('month')).toHaveLength(3);
    expect(screen.queryByText('year')).not.toBeInTheDocument();

    await user.click(screen.getByText('Yearly'));

    expect(screen.getAllByText('per')).toHaveLength(3);
    expect(screen.getAllByText('year')).toHaveLength(3);
    expect(screen.queryByText('month')).not.toBeInTheDocument();

    await user.click(screen.getByText('Monthly'));
    expect(screen.getAllByText('per')).toHaveLength(3);
    expect(screen.getAllByText('month')).toHaveLength(3);
    expect(screen.queryByText('year')).not.toBeInTheDocument();
  });
});
