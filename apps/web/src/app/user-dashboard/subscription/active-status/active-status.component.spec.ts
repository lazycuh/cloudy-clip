/* eslint-disable max-len */
/* eslint-disable @stylistic/quotes */
import { ExceptionCode } from '@lazycuh/http/src';
import { Optional } from '@lazycuh/optional';
import { UserService } from '@lazycuh/web-ui-common/auth';
import { Plan } from '@lazycuh/web-ui-common/entitlement';
import { ProgressService } from '@lazycuh/web-ui-common/progress';
import { delayBy } from '@lazycuh/web-ui-common/utils/delay-by';
import { screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { http, HttpHandler, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';

import { FREE_MONTHLY_PLAN, LITE_MONTHLY_PLAN } from 'test/data';
import { convertToResponsePayload, deepCloneObject, renderComponent, startMockingApiRequests } from 'test/utils';
import { generateAuthenticatedUser } from 'test/utils/generate-authenticated-user';

import { MY_PAYMENTS_ENDPOINT } from '../../billing-history/services';
import { SubscriptionService } from '../services';
import { SubscriptionComponent } from '../subscription.component';

import { ActiveStatusComponent } from './active-status.component';

describe(ActiveStatusComponent.name, () => {
  type RenderOptions = { handlers: HttpHandler[]; plan: Plan };

  const apiRequestMockServer = startMockingApiRequests();

  const render = async (options: Partial<RenderOptions> = {}) => {
    options.plan ??= LITE_MONTHLY_PLAN;
    options.handlers ??= [
      http.get(MY_PAYMENTS_ENDPOINT, () => {
        return HttpResponse.json(convertToResponsePayload({ page: [{ status: 'PAID' }] }));
      }),
      http.get(`${__ORCHESTRATOR_URL__}/v1/billing/my/upcoming-payment`, () => {
        const dueDate = new Date('2025-02-13T00:00:00.000Z');
        dueDate.setMonth(dueDate.getMonth() + 1);

        return HttpResponse.json(
          convertToResponsePayload({
            amountDue: '1234',
            currencyCode: 'usd',
            discount: '0',
            dueDate: dueDate.toISOString(),
            subtotal: '1000',
            tax: '234',
            taxPercentage: '23.4'
          })
        );
      })
    ];

    apiRequestMockServer.resetHandlers(...options.handlers);

    const user = deepCloneObject(generateAuthenticatedUser(options.plan));
    vi.spyOn(UserService.prototype, 'getAuthenticatedUser').mockReturnValue(user);
    vi.spyOn(UserService.prototype, 'findAuthenticatedUser').mockReturnValue(Optional.of(user));

    return renderComponent(SubscriptionComponent, { providers: [SubscriptionService] });
  };

  it('Renders correctly', async () => {
    const renderResult = await render();

    await delayBy(16);

    function assertDetailRow(row: HTMLElement, label: string, value: string) {
      expect(row.firstElementChild).toHaveTextContent(label);
      expect(row.lastElementChild).toHaveTextContent(value);
    }

    const detailRows = renderResult.container.querySelectorAll<HTMLElement>('.my-subscription__detail-row');
    expect(detailRows).toHaveLength(3);

    expect(screen.getByText('Subscription')).toBeInTheDocument();
    expect(screen.getByText('Change plan')).toHaveAttribute('href', '/pricing#plan-selection');

    assertDetailRow(detailRows[0]!, 'Status', 'Active');
    assertDetailRow(detailRows[1]!, 'Plan', 'Lite (Monthly)');
    assertDetailRow(detailRows[2]!, 'Upcoming payment', '$12.34 per month Due date: March 12, 2025');

    const user = userEvent.setup();
    await user.click(detailRows[2]!.querySelector('.info-tooltip button')!);

    await delayBy(16);

    expect(screen.getByText('Subtotal:')).toBeInTheDocument();
    expect(screen.getByText('$10.00')).toBeInTheDocument();
    expect(screen.getByText('Tax:')).toBeInTheDocument();
    expect(screen.getByText('$2.34 (23.4%)')).toBeInTheDocument();
    expect(screen.getByText('Due date:')).toBeInTheDocument();
    expect(screen.getByText('$2.34 (23.4%)')).toBeInTheDocument();
  });

  it('Can cancel paid subscription', async () => {
    await render({
      handlers: [
        http.get(MY_PAYMENTS_ENDPOINT, () => {
          return HttpResponse.json(convertToResponsePayload({ page: [{ status: 'PAID' }] }));
        }),
        http.get(`${__ORCHESTRATOR_URL__}/v1/billing/my/upcoming-payment`, () => {
          const dueDate = new Date('2025-02-13T07:19:31.370Z');
          dueDate.setMonth(new Date().getMonth() + 1);

          return HttpResponse.json(
            convertToResponsePayload({
              amountDue: '1234',
              currencyCode: 'usd',
              discount: '0',
              dueDate: dueDate.toISOString(),
              subtotal: '1000',
              tax: '234',
              taxPercentage: '23.4'
            })
          );
        }),
        http.get(`${__ORCHESTRATOR_URL__}/v1/subscriptions/my/cancellation`, () => {
          return HttpResponse.json(convertToResponsePayload(567));
        }),
        http.delete(`${__ORCHESTRATOR_URL__}/v1/subscriptions/my`, () => {
          return new HttpResponse(null, { status: 204 });
        })
      ]
    });

    const user = userEvent.setup();
    await user.click(screen.getByText('Cancel subscription'));

    await delayBy(16);

    expect(ProgressService.prototype.openIndeterminateProgressIndicator).toHaveBeenCalledOnce();
    expect(ProgressService.prototype.close).toHaveBeenCalledOnce();

    expect(screen.getByText(`We're truly saddened to see you go, Hello World!`)).toBeInTheDocument();
    expect(
      screen.getByText(
        'Your subscription will be canceled immediately and you will lose access to your created journals.'
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText(`We're also refunding approximately $5.67 for the unused portion of your subscription.`)
    ).toBeInTheDocument();
    expect(screen.getByText('Attention')).toBeInTheDocument();
    expect(
      screen.getByText(
        'After 7 days, all your data will be permanently deleted unless the subscription is reactivated before that.'
      )
    ).toBeInTheDocument();

    const closebutton = screen.getByText('Close');
    expect(closebutton).toBeEnabled();

    const confirmCancellationButton = screen.getByText('Confirm cancellation').parentElement!.parentElement!;
    expect(confirmCancellationButton).toBeDisabled();

    await user.click(screen.getByText('I have read and agreed to the previous statements.'));

    await delayBy(16);

    expect(closebutton).toBeEnabled();
    expect(confirmCancellationButton).toBeEnabled();

    await user.click(confirmCancellationButton);
    expect(confirmCancellationButton).toBeDisabled();

    expect(ProgressService.prototype.openIndeterminateProgressIndicator).toBeCalledTimes(1);
    expect(ProgressService.prototype.close).toBeCalledTimes(1);
    await delayBy(16);

    expect(screen.getByText(/Your subscription has been canceled. A refund of approximately/)).toBeInTheDocument();

    expect(screen.getByText('$5.67')).toBeInTheDocument();
    expect(
      screen.getByText(/will be issued back to the original payment method within 5-10 business days\./)
    ).toBeInTheDocument();
    expect(screen.getByText(/To check the status of your refund, please go to/)).toBeInTheDocument();
    expect(screen.getByText('Billing history')).toBeInTheDocument();
    expect(screen.getByText(/page\./)).toBeInTheDocument();
  });

  it('Can cancel free subscription', async () => {
    vi.spyOn(SubscriptionService.prototype, 'getUpcomingPayment');
    vi.spyOn(SubscriptionService.prototype, 'getSubscriptionCancellationRefund');

    await render({
      handlers: [
        http.delete(`${__ORCHESTRATOR_URL__}/v1/subscriptions/my`, () => {
          return new HttpResponse(null, { status: 204 });
        })
      ],
      plan: FREE_MONTHLY_PLAN
    });

    const user = userEvent.setup();
    await user.click(screen.getByText('Cancel subscription'));

    expect(ProgressService.prototype.openIndeterminateProgressIndicator).not.toHaveBeenCalled();
    expect(SubscriptionService.prototype.getUpcomingPayment).not.toHaveBeenCalled();
    expect(SubscriptionService.prototype.getSubscriptionCancellationRefund).not.toHaveBeenCalled();

    expect(screen.getByText(`We're truly saddened to see you go, Hello World!`)).toBeInTheDocument();
    expect(
      screen.getByText(
        'Your subscription will be canceled immediately and you will lose access to your created journals.'
      )
    ).toBeInTheDocument();
    expect(
      screen.queryByText(`We're also refunding approximately $5.67 for the unused portion of your subscription.`)
    ).not.toBeInTheDocument();
    expect(screen.getByText('Attention')).toBeInTheDocument();
    expect(
      screen.getByText(
        'After 7 days, all your data will be permanently deleted unless the subscription is reactivated before that.'
      )
    ).toBeInTheDocument();

    const closebutton = screen.getByText('Close');
    expect(closebutton).toBeEnabled();

    const confirmCancellationButton = screen.getByText('Confirm cancellation').parentElement!.parentElement!;
    expect(confirmCancellationButton).toBeDisabled();

    await user.click(screen.getByText('I have read and agreed to the previous statements.'));

    expect(closebutton).toBeEnabled();
    expect(confirmCancellationButton).toBeEnabled();

    await user.click(confirmCancellationButton);
    expect(confirmCancellationButton).toBeDisabled();

    expect(ProgressService.prototype.close).toBeCalledTimes(1);

    expect(screen.getByText('Your subscription has been canceled.')).toBeInTheDocument();
    expect(screen.queryByText(/A refund of approximately/)).not.toBeInTheDocument();
  });

  it('Shows a notification when user tries to cancel a paid subscription that was started less than 7 days ago', async () => {
    await render({
      handlers: [
        http.get(MY_PAYMENTS_ENDPOINT, () => {
          return HttpResponse.json(convertToResponsePayload({ page: [{ status: 'PAID' }] }));
        }),
        http.get(`${__ORCHESTRATOR_URL__}/v1/billing/my/upcoming-payment`, () => {
          const dueDate = new Date('2025-02-13T07:19:31.370Z');
          dueDate.setMonth(new Date().getMonth() + 1);

          return HttpResponse.json(
            convertToResponsePayload({
              amountDue: '1234',
              currencyCode: 'usd',
              discount: '0',
              dueDate: dueDate.toISOString(),
              subtotal: '1000',
              tax: '234',
              taxPercentage: '23.4'
            })
          );
        }),
        http.get(`${__ORCHESTRATOR_URL__}/v1/subscriptions/my/cancellation`, () => {
          return HttpResponse.json(
            convertToResponsePayload(
              {
                code: ExceptionCode.VALIDATION,
                extra: { startDate: '2025-03-13T07:19:31.370Z' }
              },
              'subscription was created less than 7 days ago'
            ),
            { status: 400 }
          );
        })
      ]
    });

    const user = userEvent.setup();
    await user.click(screen.getByText('Cancel subscription'));

    expect(screen.queryByText('Confirm cancellation')).not.toBeInTheDocument();

    expect(
      screen.getByText(
        'Our apologies, our abuse prevention procedures only allow cancellation at least 7 days after your subscription was first created which was on March 13, 2025.'
      )
    );
  });

  it('Shows a notification with default message when getting refund amount fails unknowingly', async () => {
    await render({
      handlers: [
        http.get(MY_PAYMENTS_ENDPOINT, () => {
          return HttpResponse.json(convertToResponsePayload({ page: [{ status: 'PAID' }] }));
        }),
        http.get(`${__ORCHESTRATOR_URL__}/v1/billing/my/upcoming-payment`, () => {
          const dueDate = new Date('2025-02-13T07:19:31.370Z');
          dueDate.setMonth(new Date().getMonth() + 1);

          return HttpResponse.json(
            convertToResponsePayload({
              amountDue: '1234',
              currencyCode: 'usd',
              discount: '0',
              dueDate: dueDate.toISOString(),
              subtotal: '1000',
              tax: '234',
              taxPercentage: '23.4'
            })
          );
        }),
        http.get(`${__ORCHESTRATOR_URL__}/v1/subscriptions/my/cancellation`, () => {
          return HttpResponse.json(
            convertToResponsePayload({
              code: ExceptionCode.UNKNOWN
            }),
            { status: 500 }
          );
        })
      ]
    });

    const user = userEvent.setup();
    await user.click(screen.getByText('Cancel subscription'));

    expect(screen.queryByText('Confirm cancellation')).not.toBeInTheDocument();

    expect(screen.getByText(/An unknown error has occurred while processing your request. Please try again later\./));
  });

  it('Shows a notification with a default message when cancellation fails', async () => {
    await render({
      handlers: [
        http.get(MY_PAYMENTS_ENDPOINT, () => {
          return HttpResponse.json(convertToResponsePayload({ page: [{ status: 'PAID' }] }));
        }),
        http.get(`${__ORCHESTRATOR_URL__}/v1/billing/my/upcoming-payment`, () => {
          const dueDate = new Date('2025-02-13T07:19:31.370Z');
          dueDate.setMonth(new Date().getMonth() + 1);

          return HttpResponse.json(
            convertToResponsePayload({
              amountDue: '1234',
              currencyCode: 'usd',
              discount: '0',
              dueDate: dueDate.toISOString(),
              subtotal: '1000',
              tax: '234',
              taxPercentage: '23.4'
            })
          );
        }),
        http.get(`${__ORCHESTRATOR_URL__}/v1/subscriptions/my/cancellation`, () => {
          return HttpResponse.json(convertToResponsePayload(567));
        }),
        http.delete(`${__ORCHESTRATOR_URL__}/v1/subscriptions/my`, () => {
          return HttpResponse.json(convertToResponsePayload({ code: ExceptionCode.UNKNOWN }), { status: 500 });
        })
      ]
    });

    const user = userEvent.setup();
    await user.click(screen.getByText('Cancel subscription'));

    await user.click(screen.getByText('I have read and agreed to the previous statements.'));
    await user.click(screen.getByText('Confirm cancellation'));

    expect(screen.getByText(/An unknown error has occurred while processing your request. Please try again later\./));
  });

  it('Renders a message box when fetching upcoming payment fails', async () => {
    await render({
      handlers: [
        http.get(MY_PAYMENTS_ENDPOINT, () => {
          return HttpResponse.json(convertToResponsePayload({ page: [{ status: 'PAID' }] }));
        }),
        http.get(`${__ORCHESTRATOR_URL__}/v1/billing/my/upcoming-payment`, () => {
          const dueDate = new Date('2025-02-13T07:19:31.370Z');
          dueDate.setMonth(new Date().getMonth() + 1);

          return HttpResponse.json(convertToResponsePayload({ code: ExceptionCode.UNKNOWN }, 'expected'), {
            status: 500
          });
        })
      ]
    });

    expect(screen.getByText('Unable to retrieve your upcoming payment amount')).toBeInTheDocument();
    expect(
      screen.getByText('Please try reloading your browser or contact us if the issue persists.')
    ).toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(screen.getByText('Reload page'));
    expect(window.location.reload).toHaveBeenCalledOnce();

    expect(screen.getByText('Contact us')).toHaveAttribute('target', '_blank');
    expect(screen.getByText('Contact us')).toHaveAttribute(
      'href',
      'mailto:heretohelp@cloudyclip.com?subject=%5BTrade%20Timeline%5D%20Upcoming%20payment%20amount%20retrieval%20error&body=I%20keep%20getting%20error%20retrieving%20upcoming%20payment%20amount.%20My%20email%20address%20is%20helloworld@gmail.com.'
    );
  });
});
