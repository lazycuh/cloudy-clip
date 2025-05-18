import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { ExceptionCode } from '@lazycuh/http/src';
import { Logger } from '@lazycuh/logging';
import { Optional } from '@lazycuh/optional';
import { AuthenticatedUser, UserService } from '@lazycuh/web-ui-common/auth';
import { CancellationReason } from '@lazycuh/web-ui-common/entitlement';
import { delayBy } from '@lazycuh/web-ui-common/utils/delay-by';
import { RenderResult, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { http, HttpHandler, HttpResponse } from 'msw';
import { CheckoutSession } from 'src/app/pricing/models';
import { describe, expect, it, vi } from 'vitest';

import { ESSENTIAL_YEARLY_PLAN, FREE_MONTHLY_PLAN } from 'test/data';
import {
  assertCalledOnceWith,
  convertToResponsePayload,
  deepCloneObject,
  renderComponent,
  startMockingApiRequests
} from 'test/utils';
import { generateAuthenticatedUser } from 'test/utils/generate-authenticated-user';

import { SubscriptionService } from '../services';
import { SubscriptionComponent } from '../subscription.component';

import { CanceledStatusComponent } from './canceled-status.component';

type RenderOptions = {
  authenticatedUser: AuthenticatedUser;
  cancellationReason: CancellationReason;
  handlers: HttpHandler[];
};
describe(CanceledStatusComponent, () => {
  const apiRequestMockServer = startMockingApiRequests();

  const render = async (options: Partial<RenderOptions> = {}) => {
    options.handlers ??= [
      http.post(`${__ORCHESTRATOR_URL__}/v1/subscriptions/my/reactivate`, () => {
        return new HttpResponse(null, { status: 204 });
      })
    ];
    options.cancellationReason ??= 'REQUESTED_BY_USER';

    const user = deepCloneObject(options.authenticatedUser ?? generateAuthenticatedUser(ESSENTIAL_YEARLY_PLAN));

    apiRequestMockServer.resetHandlers(...options.handlers);

    user.subscription!.cancellationReason = options.cancellationReason;
    user.subscription!.canceledAt = '2025-02-15T00:00:00.000Z';
    vi.spyOn(UserService.prototype, 'getAuthenticatedUser').mockReturnValue(user);
    vi.spyOn(UserService.prototype, 'findAuthenticatedUser').mockReturnValue(Optional.of(user));

    return renderComponent(SubscriptionComponent, { providers: [SubscriptionService] });
  };

  async function assertCancellationReason(
    renderResult: RenderResult<SubscriptionComponent, SubscriptionComponent>,
    reasonText: string
  ) {
    const detailRows = renderResult.container.querySelectorAll<HTMLElement>('.my-subscription__detail-row');
    expect(detailRows).toHaveLength(2);

    const user = userEvent.setup();
    await user.click(detailRows[0]!.querySelector('.info-tooltip button')!);

    await delayBy(16);

    expect(screen.getByText('Canceled on:')).toBeInTheDocument();
    expect(screen.getByText('February 14, 2025')).toBeInTheDocument();
    expect(screen.getByText('Reason:')).toBeInTheDocument();
    expect(screen.getByText(reasonText)).toBeInTheDocument();
  }

  it('Renders correctly', async () => {
    const renderResult = await render();

    function assertDetailRow(row: HTMLElement, label: string, value: string) {
      expect(row.firstElementChild).toHaveTextContent(label);
      expect(row.lastElementChild).toHaveTextContent(value);
    }

    const detailRows = renderResult.container.querySelectorAll<HTMLElement>('.my-subscription__detail-row');
    expect(detailRows).toHaveLength(2);

    expect(screen.getByText('Subscription')).toBeInTheDocument();
    expect(screen.getByText('Reactivate subscription')).toBeInTheDocument();

    assertDetailRow(detailRows[0]!, 'Status', 'Canceled');
    assertDetailRow(detailRows[1]!, 'Plan', 'Essential (Yearly)');

    await assertCancellationReason(renderResult, 'Canceled by user');
  });

  it('Can reactivate paid subscription by navigating to checkout page', async () => {
    await render();

    const user = userEvent.setup();
    await user.click(screen.getByText('Reactivate subscription'));

    await delayBy(16);

    expect(HttpClient.prototype.patch).not.toHaveBeenCalled();

    assertCalledOnceWith(Router.prototype.navigateByUrl, '/checkout', {
      state: {
        checkoutSession: new CheckoutSession(ESSENTIAL_YEARLY_PLAN, 'REACTIVATION')
      }
    });
  });

  it('Can reactivate free subscription without navigating to checkout page', async () => {
    await render({
      authenticatedUser: generateAuthenticatedUser(FREE_MONTHLY_PLAN)
    });

    const user = userEvent.setup();
    await user.click(screen.getByText('Reactivate subscription'));

    await delayBy(16);

    assertCalledOnceWith(HttpClient.prototype.post, `${__ORCHESTRATOR_URL__}/v1/subscriptions/my/reactivate`, {});

    expect(Router.prototype.navigateByUrl).not.toHaveBeenCalled();

    expect(
      screen.getByText('Your subscription has been reactivated. Thank you for your continuing support.')
    ).toBeInTheDocument();
  });

  it('Shows notification with default message when reactivating free plan fails', async () => {
    await render({
      authenticatedUser: generateAuthenticatedUser(FREE_MONTHLY_PLAN),
      handlers: [
        http.post(`${__ORCHESTRATOR_URL__}/v1/subscriptions/my/reactivate`, () => {
          return HttpResponse.json(convertToResponsePayload({ code: ExceptionCode.UNKNOWN }, 'expected'), {
            status: 500
          });
        })
      ]
    });

    const user = userEvent.setup();
    await user.click(screen.getByText('Reactivate subscription'));

    await delayBy(16);

    expect(
      screen.getByText(/An unknown error has occurred while processing your request\. Please try again later\./)
    ).toBeInTheDocument();

    assertCalledOnceWith(Logger.prototype.error, 'failed to reactivate subscription', {
      message: 'expected',
      payload: { code: ExceptionCode.UNKNOWN }
    });
  });

  // eslint-disable-next-line vitest/expect-expect
  it('Renders PAYMENT_FAILED reason correctly', async () => {
    const renderResult = await render({ cancellationReason: 'PAYMENT_FAILED' });

    await assertCancellationReason(renderResult, 'Failed payment');
  });

  // eslint-disable-next-line vitest/expect-expect
  it('Renders PAYMENT_DISPUTED reason correctly', async () => {
    const renderResult = await render({ cancellationReason: 'PAYMENT_DISPUTED' });

    await assertCancellationReason(renderResult, 'Disputed payment');
  });

  // eslint-disable-next-line vitest/expect-expect
  it('Renders unknown reason correctly', async () => {
    const renderResult = await render({ cancellationReason: '' as CancellationReason });
    await assertCancellationReason(renderResult, 'Unknown');
  });
});
