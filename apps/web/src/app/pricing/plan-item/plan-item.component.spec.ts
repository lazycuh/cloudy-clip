import { screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';

import {
  ALL_PLANS,
  ESSENTIAL_MONTHLY_PLAN,
  ESSENTIAL_YEARLY_PLAN,
  FREE_MONTHLY_PLAN,
  FREE_YEARLY_PLAN,
  LITE_MONTHLY_PLAN
} from 'test/data';
import {
  convertToResponsePayload,
  deepCloneObject,
  mockAuthenticatedUser,
  renderComponent,
  startMockingApiRequests
} from 'test/utils';

import { PlanListComponent } from '../plan-list';
import { PlanListService } from '../plan-list/plan-list.service';

import { PlanItemComponent } from './plan-item.component';

describe(PlanItemComponent.name, () => {
  const apiRequestMockServer = startMockingApiRequests();

  it('Renders free plan correctly for new user', async () => {
    const startForFreeMock = vi.fn();

    const renderResult = await renderComponent(PlanItemComponent, {
      inputs: {
        plan: deepCloneObject(FREE_MONTHLY_PLAN)
      },
      on: {
        subscribe: startForFreeMock
      }
    });

    expect(screen.getByText('Free')).toBeInTheDocument();
    expect(screen.getByText('$0.00')).toBeInTheDocument();
    expect(renderResult.container.querySelector('.plan-item__price__renewal-interval')).toHaveTextContent('per month');

    const user = userEvent.setup();
    await user.click(screen.getByText('Start for free'));
    expect(startForFreeMock).toHaveBeenCalledOnce();

    expect(screen.getByText('No credit card required')).toHaveStyle('opacity: 1');
    expect(screen.getByText('Free includes:')).toBeInTheDocument();
    expect(screen.getByText('Unlimited number of journal entries')).toBeInTheDocument();
  });

  it('Renders non-free plan correctly', async () => {
    const startNowMock = vi.fn();

    const renderResult = await renderComponent(PlanItemComponent, {
      inputs: {
        plan: deepCloneObject(LITE_MONTHLY_PLAN)
      },
      on: {
        subscribe: startNowMock
      }
    });

    expect(screen.getByText('Lite')).toBeInTheDocument();
    expect(screen.getByText('$1.99')).toBeInTheDocument();
    expect(renderResult.container.querySelector('.plan-item__price__renewal-interval')).toHaveTextContent('per month');

    const user = userEvent.setup();
    await user.click(screen.getByText('Start now'));
    expect(startNowMock).toHaveBeenCalledOnce();

    expect(screen.getByText('No credit card required')).toHaveStyle('opacity: 0');

    expect(screen.getByText('Lite includes:')).toBeInTheDocument();
    expect(screen.getByText('Unlimited number of journal entries')).toBeInTheDocument();
  });

  it('Renders yearly plan correctly', async () => {
    const startNowMock = vi.fn();

    const renderResult = await renderComponent(PlanItemComponent, {
      inputs: {
        plan: deepCloneObject(ESSENTIAL_YEARLY_PLAN)
      },
      on: {
        subscribe: startNowMock
      }
    });

    expect(screen.getByText('Essential')).toBeInTheDocument();
    expect(screen.getByText('$47.88')).toBeInTheDocument();
    expect(screen.getByText('$39.90')).toBeInTheDocument();
    expect(renderResult.container.querySelector('.plan-item__price__renewal-interval')).toHaveTextContent('per year');

    const user = userEvent.setup();
    await user.click(screen.getByText('Start now'));
    expect(startNowMock).toHaveBeenCalledOnce();

    expect(screen.getByText('No credit card required')).toHaveStyle('opacity: 0');

    expect(screen.getByText('Essential includes:')).toBeInTheDocument();
    expect(screen.getByText('Unlimited number of journal entries')).toBeInTheDocument();
  });

  it('Renders correctly for downgrade', async () => {
    mockAuthenticatedUser(ESSENTIAL_MONTHLY_PLAN);

    const downgradeMock = vi.fn();

    await renderComponent(PlanItemComponent, {
      inputs: {
        plan: deepCloneObject(LITE_MONTHLY_PLAN)
      },
      on: {
        downgrade: downgradeMock
      }
    });

    expect(screen.queryByText('Essential')).not.toBeInTheDocument();
    expect(screen.getByText('Lite')).toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(screen.getByText('Downgrade'));
    expect(downgradeMock).toHaveBeenCalledOnce();
  });

  it('Renders correctly for upgrade', async () => {
    mockAuthenticatedUser(LITE_MONTHLY_PLAN);

    const upgradeMock = vi.fn();

    await renderComponent(PlanItemComponent, {
      inputs: {
        plan: deepCloneObject(ESSENTIAL_YEARLY_PLAN)
      },
      on: {
        upgrade: upgradeMock
      }
    });

    expect(screen.queryByText('Lite')).not.toBeInTheDocument();
    expect(screen.getByText('Essential')).toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(screen.getByText('Upgrade'));
    expect(upgradeMock).toHaveBeenCalledOnce();
  });

  it('Renders correctly for switching to yearly plan from monthly', async () => {
    mockAuthenticatedUser(ESSENTIAL_MONTHLY_PLAN);

    const intervalChangeMock = vi.fn();

    const renderResult = await renderComponent(PlanItemComponent, {
      inputs: {
        plan: deepCloneObject(ESSENTIAL_YEARLY_PLAN)
      },
      on: {
        changeRenewalInterval: intervalChangeMock
      }
    });

    expect(screen.getByText('Essential')).toBeInTheDocument();
    expect(renderResult.container.querySelector('.plan-item__price__renewal-interval')).toHaveTextContent('per year');
    expect(renderResult.container.querySelector('.plan-item__price__renewal-interval')).not.toHaveTextContent(
      'per month'
    );

    const user = userEvent.setup();
    await user.click(screen.getByText('Switch to yearly'));
    expect(intervalChangeMock).toHaveBeenCalledOnce();
  });

  it('Renders correctly for switching to monthly plan from yearly', async () => {
    mockAuthenticatedUser(ESSENTIAL_YEARLY_PLAN);

    const intervalChangeMock = vi.fn();

    const renderResult = await renderComponent(PlanItemComponent, {
      inputs: {
        plan: deepCloneObject(ESSENTIAL_MONTHLY_PLAN)
      },
      on: {
        changeRenewalInterval: intervalChangeMock
      }
    });

    expect(screen.getByText('Essential')).toBeInTheDocument();
    expect(renderResult.container.querySelector('.plan-item__price__renewal-interval')).toHaveTextContent('per month');
    expect(renderResult.container.querySelector('.plan-item__price__renewal-interval')).not.toHaveTextContent(
      'per year'
    );

    const user = userEvent.setup();
    await user.click(screen.getByText('Switch to monthly'));
    expect(intervalChangeMock).toHaveBeenCalledOnce();
  });

  it('Renders correctly for managing current plan', async () => {
    mockAuthenticatedUser(ESSENTIAL_MONTHLY_PLAN);

    const renderResult = await renderComponent(PlanItemComponent, {
      inputs: {
        plan: deepCloneObject(ESSENTIAL_MONTHLY_PLAN)
      }
    });

    expect(renderResult.container).toHaveClass('active-plan');
    expect(screen.getByText('Essential')).toBeInTheDocument();
    expect(renderResult.container.querySelector('.plan-item__price__renewal-interval')).toHaveTextContent('per month');
    expect(renderResult.container.querySelector('.plan-item__price__renewal-interval')).not.toHaveTextContent(
      'per year'
    );

    expect(screen.getByText('Manage')).toHaveAttribute('href', '/my/subscription');
  });

  it('Shows "Manage" button for free yearly plan even when active plan is free monthly plan', async () => {
    mockAuthenticatedUser(FREE_MONTHLY_PLAN);

    apiRequestMockServer.resetHandlers(
      http.get(`${__ORCHESTRATOR_URL__}/v1/plans`, () => {
        return HttpResponse.json(convertToResponsePayload(ALL_PLANS));
      })
    );

    await renderComponent(PlanListComponent, { providers: [PlanListService] });

    expect(screen.getByText('Manage')).toBeInTheDocument();
    expect(screen.getAllByText('Upgrade')).toHaveLength(2);

    const user = userEvent.setup();
    await user.click(screen.getByText('Yearly'));
    expect(screen.getByText('Manage')).toBeInTheDocument();
    expect(screen.getAllByText('Upgrade')).toHaveLength(2);

    await user.click(screen.getByText('Monthly'));
  });

  it('Shows "Manage" button for free monly plan even when active plan is free yearly plan', async () => {
    mockAuthenticatedUser(FREE_YEARLY_PLAN);

    apiRequestMockServer.resetHandlers(
      http.get(`${__ORCHESTRATOR_URL__}/v1/plans`, () => {
        return HttpResponse.json(convertToResponsePayload(ALL_PLANS));
      })
    );

    await renderComponent(PlanListComponent, { providers: [PlanListService] });

    expect(screen.getByText('Manage')).toBeInTheDocument();
    expect(screen.getAllByText('Upgrade')).toHaveLength(2);

    const user = userEvent.setup();
    await user.click(screen.getByText('Yearly'));
    expect(screen.getByText('Manage')).toBeInTheDocument();
    expect(screen.getAllByText('Upgrade')).toHaveLength(2);

    await user.click(screen.getByText('Monthly'));
  });
});
