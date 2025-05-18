import { ExceptionCode } from '@lazycuh/http/src';
import { UserService } from '@lazycuh/web-ui-common/auth';
import { delayBy } from '@lazycuh/web-ui-common/utils/delay-by';
import { screen } from '@testing-library/angular';
import { delay, http, HttpResponse } from 'msw';
import { BillingService } from 'src/app/user-dashboard/billing-history/services';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { convertToResponsePayload, renderComponent, startMockingApiRequests } from 'test/utils';

import { PurchaseConfirmationComponent } from './purchase-confirmation.component';

describe(PurchaseConfirmationComponent.name, () => {
  const apiRequestMockServer = startMockingApiRequests();

  beforeEach(() => {
    document.location.search = '';
    vi.spyOn(UserService.prototype, 'restoreSession').mockResolvedValue(true);
  });

  it('Shows loader while checking for subscription status', async () => {
    const taskId = 'task-id';

    document.location.search = `?task=${taskId}`;

    apiRequestMockServer.resetHandlers(
      http.get(`${__ORCHESTRATOR_URL__}/v1/tasks/${taskId}`, async () => {
        await delay(1000);

        return HttpResponse.json(convertToResponsePayload({ status: 'SUCCESS' }));
      })
    );

    await renderComponent(PurchaseConfirmationComponent, {
      providers: [BillingService]
    });

    expect(screen.getByText('Checking your subscription status. Please wait.')).toBeInTheDocument();
  });

  it('Renders correctly when subscription is active', async () => {
    const taskId = 'task-id';

    document.location.search = `?task=${taskId}`;

    apiRequestMockServer.resetHandlers(
      http.get(`${__ORCHESTRATOR_URL__}/v1/tasks/${taskId}`, () => {
        return HttpResponse.json(convertToResponsePayload({ status: 'SUCCESS' }));
      })
    );

    await renderComponent(PurchaseConfirmationComponent, {
      providers: [BillingService]
    });

    expect(screen.getByText('Thank you for joining Cloudy Clip')).toBeInTheDocument();
    expect(screen.getByText('Your subscription is now active.')).toBeInTheDocument();
    expect(screen.getByText('Go to dashboard')).toHaveAttribute('href', '/my/account');
    expect(screen.getByText('Start journaling')).toHaveAttribute('href', '/timeline');
  });

  it('Renders correctly when subscription processing fails unknowingly', async () => {
    const taskId = 'task-id';

    document.location.search = `?task=${taskId}`;

    apiRequestMockServer.resetHandlers(
      http.get(`${__ORCHESTRATOR_URL__}/v1/tasks/${taskId}`, () => {
        return HttpResponse.json(convertToResponsePayload({ status: 'FAILURE' }));
      }),
      http.get(`${__ORCHESTRATOR_URL__}/v1/billing/my/payments`, () => {
        return HttpResponse.json(convertToResponsePayload({ page: [{ failureReason: null }] }));
      })
    );

    await renderComponent(PurchaseConfirmationComponent, {
      providers: [BillingService]
    });

    expect(screen.getByText('No record of your subscription was found')).toBeInTheDocument();
  });

  it('Renders correctly when payment fails', async () => {
    const taskId = 'task-id';

    document.location.search = `?task=${taskId}`;

    apiRequestMockServer.resetHandlers(
      http.get(`${__ORCHESTRATOR_URL__}/v1/tasks/${taskId}`, () => {
        return HttpResponse.json(convertToResponsePayload({ status: 'FAILURE' }));
      }),
      http.get(`${__ORCHESTRATOR_URL__}/v1/billing/my/payments`, () => {
        return HttpResponse.json(
          convertToResponsePayload({ page: [{ failureReason: 'card_declined.generic_decline' }] })
        );
      })
    );

    await renderComponent(PurchaseConfirmationComponent, {
      providers: [BillingService]
    });

    expect(screen.getByText('No record of your subscription was found')).toBeInTheDocument();
    expect(screen.getByText('Your card was declined. Please contact your bank for details.')).toBeInTheDocument();
  });

  it('Renders correctly when payment fails with an unhandled error', async () => {
    const taskId = 'task-id';

    document.location.search = `?task=${taskId}`;

    apiRequestMockServer.resetHandlers(
      http.get(`${__ORCHESTRATOR_URL__}/v1/tasks/${taskId}`, () => {
        return HttpResponse.json(convertToResponsePayload({ status: 'FAILURE' }));
      }),
      http.get(`${__ORCHESTRATOR_URL__}/v1/billing/my/payments`, () => {
        return HttpResponse.json(convertToResponsePayload({ page: [{ failureReason: 'unknown' }] }));
      })
    );

    await renderComponent(PurchaseConfirmationComponent, {
      providers: [BillingService]
    });

    expect(screen.getByText('No record of your subscription was found')).toBeInTheDocument();
    expect(
      screen.getByText(/An unknown error has occurred while processing your request\. Please try again later\./)
    ).toBeInTheDocument();
    expect(screen.getByText(/If you continue having issues, please contact us\./)).toBeInTheDocument();
  });

  it('Renders correctly when checking status fails unknowingly', async () => {
    const taskId = 'task-id';

    document.location.search = `?task=${taskId}`;

    apiRequestMockServer.resetHandlers(
      http.get(`${__ORCHESTRATOR_URL__}/v1/tasks/${taskId}`, () => {
        return HttpResponse.json(convertToResponsePayload({ code: ExceptionCode.UNKNOWN }, 'expected'), {
          status: 500
        });
      })
    );

    vi.useFakeTimers();

    void vi.advanceTimersByTimeAsync(16_000);

    await renderComponent(PurchaseConfirmationComponent, {
      providers: [BillingService]
    });

    vi.useRealTimers();

    await delayBy(250);

    expect(screen.getByText('No record of your subscription was found')).toBeInTheDocument();
    expect(screen.getByText('If it is a mistake, please let us know.')).toBeInTheDocument();
  });

  it('Renders correctly when getting latest payment fails unknowingly', async () => {
    const taskId = 'task-id';

    document.location.search = `?task=${taskId}`;

    apiRequestMockServer.resetHandlers(
      http.get(`${__ORCHESTRATOR_URL__}/v1/tasks/${taskId}`, () => {
        return HttpResponse.json(convertToResponsePayload({ status: 'FAILURE' }));
      }),
      http.get(`${__ORCHESTRATOR_URL__}/v1/billing/my/payments`, () => {
        return HttpResponse.json(convertToResponsePayload({ code: ExceptionCode.UNKNOWN }, 'expected'), {
          status: 500
        });
      })
    );

    await renderComponent(PurchaseConfirmationComponent, {
      providers: [BillingService]
    });

    expect(screen.getByText('No record of your subscription was found')).toBeInTheDocument();
    expect(screen.getByText('If it is a mistake, please let us know.')).toBeInTheDocument();
  });

  it('Renders correctly when `taskId` query param is not present', async () => {
    await renderComponent(PurchaseConfirmationComponent, {
      providers: [BillingService]
    });

    await delayBy(16);

    expect(screen.getByText('No record of your subscription was found')).toBeInTheDocument();
  });
});
