/* eslint-disable max-len */
import { HttpClient } from '@angular/common/http';
import { ExceptionCode } from '@lazycuh/http/src';
import { Logger } from '@lazycuh/logging';
import { UserService } from '@lazycuh/web-ui-common/auth';
import { ProgressService } from '@lazycuh/web-ui-common/progress';
import { delayBy } from '@lazycuh/web-ui-common/utils/delay-by';
import { screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { delay, http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { LITE_MONTHLY_PLAN } from 'test/data';
import { assertCalledOnceWith, convertToResponsePayload, renderComponent, startMockingApiRequests } from 'test/utils';
import { generateAuthenticatedUser } from 'test/utils/generate-authenticated-user';

import { PaymentMethod } from './models';
import { PaymentMethodListComponent } from './payment-method-list.component';

describe(PaymentMethodListComponent.name, () => {
  const apiRequestMockServer = startMockingApiRequests();

  beforeEach(() => {
    vi.spyOn(UserService.prototype, 'getAuthenticatedUser').mockReturnValue(
      generateAuthenticatedUser(LITE_MONTHLY_PLAN)
    );
  });

  it('Shows a loader while fetching payment methods', async () => {
    apiRequestMockServer.resetHandlers(
      http.get(`${__ORCHESTRATOR_URL__}/v1/billing/my/payment-methods`, async () => {
        await delay(500);

        return HttpResponse.json(convertToResponsePayload([]));
      })
    );

    const renderResult = await renderComponent(PaymentMethodListComponent);

    expect(renderResult.container.querySelectorAll('.content-loading-indicator')).toHaveLength(1);

    await delayBy(550);

    expect(ProgressService.prototype.openIndeterminateProgressIndicator).toHaveBeenCalledOnce();
    expect(ProgressService.prototype.close).toHaveBeenCalledOnce();
  });

  it('Shows notification when fetching payment methods fails', async () => {
    apiRequestMockServer.resetHandlers(
      http.get(`${__ORCHESTRATOR_URL__}/v1/billing/my/payment-methods`, () => {
        return HttpResponse.json(convertToResponsePayload({ code: ExceptionCode.UNKNOWN }, 'expected'), {
          status: 500
        });
      })
    );

    await renderComponent(PaymentMethodListComponent);

    expect(
      screen.getByText(/An unknown error has occurred while processing your request\. Please try again later\./)
    ).toBeInTheDocument();

    assertCalledOnceWith(Logger.prototype.error, 'failed to get payment methods', {
      message: 'expected',
      payload: { code: ExceptionCode.UNKNOWN }
    });
  });

  it('Renders correctly when no payment method is found', async () => {
    apiRequestMockServer.resetHandlers(
      http.get(`${__ORCHESTRATOR_URL__}/v1/billing/my/payment-methods`, () => {
        return HttpResponse.json(convertToResponsePayload([]));
      })
    );

    await renderComponent(PaymentMethodListComponent);

    expect(screen.getByText('We have no records of your stored payment methods')).toBeInTheDocument();
    expect(screen.getByText('If it is a mistake, please let us know.')).toBeInTheDocument();
    expect(screen.getByText('Explore plans')).toHaveAttribute('href', '/pricing');
    expect(screen.getByText('Contact us')).toHaveAttribute('target', '_blank');
    expect(screen.getByText('Contact us')).toHaveAttribute(
      'href',
      'mailto:heretohelp@cloudyclip.com?subject=%5BTrade%20Timeline%5D%20Payment%20methods%20not%20found&body=My%20payment%20method%20list%20shows%20no%20records.%20My%20email%20address%20is%20helloworld@gmail.com.'
    );
  });

  it('Renders returned payment methods correctly with default payment first, expired payment methods last', async () => {
    const paymentMethods: PaymentMethod[] = [
      {
        brand: 'visa',
        expMonth: '1',
        expYear: '2024',
        isDefault: false,
        last4: '4444',
        paymentMethodId: '3'
      },
      {
        brand: 'mastercard',
        expMonth: '5',
        expYear: '2035',
        isDefault: false,
        last4: '4343',
        paymentMethodId: '2'
      },
      {
        brand: 'visa',
        expMonth: '4',
        expYear: '2034',
        isDefault: true,
        last4: '4242',
        paymentMethodId: '1'
      }
    ];

    apiRequestMockServer.resetHandlers(
      http.get(`${__ORCHESTRATOR_URL__}/v1/billing/my/payment-methods`, () => {
        return HttpResponse.json(convertToResponsePayload(paymentMethods));
      })
    );

    function assertCardBrandImage(paymentMethodElement: HTMLElement, brand: string) {
      expect(paymentMethodElement.lastElementChild?.lastElementChild?.lastElementChild).toHaveAttribute(
        'src',
        `/images/${brand}.png`
      );
      expect(paymentMethodElement.lastElementChild?.lastElementChild?.lastElementChild).toHaveAttribute(
        'alt',
        `${brand}'s logo`
      );
    }

    const renderResult = await renderComponent(PaymentMethodListComponent);

    const paymentMethodElements = renderResult.container.querySelectorAll<HTMLElement>(
      '.payment-method-list__payment-method'
    );
    expect(paymentMethodElements).toHaveLength(3);

    expect(screen.getByText('Payment methods')).toBeInTheDocument();
    expect(screen.getByText('4 / 2034')).toBeInTheDocument();
    expect(screen.getByText('4242')).toBeInTheDocument();
    assertCardBrandImage(paymentMethodElements[0]!, 'visa');

    expect(screen.getByText('5 / 2035')).toBeInTheDocument();
    expect(screen.getByText('4343')).toBeInTheDocument();
    assertCardBrandImage(paymentMethodElements[1]!, 'mastercard');

    expect(screen.getByText('1 / 2024')).toBeInTheDocument();
    expect(screen.getByText('4444')).toBeInTheDocument();
    assertCardBrandImage(paymentMethodElements[2]!, 'visa');

    expect(screen.getAllByText('××××')).toHaveLength(9);
  });

  it('Disable removal of default payment method', async () => {
    const paymentMethods: PaymentMethod[] = [
      {
        brand: 'visa',
        expMonth: '4',
        expYear: '2034',
        isDefault: true,
        last4: '4242',
        paymentMethodId: '1'
      },
      {
        brand: 'mastercard',
        expMonth: '5',
        expYear: '2035',
        isDefault: false,
        last4: '4343',
        paymentMethodId: '2'
      }
    ];

    apiRequestMockServer.resetHandlers(
      http.get(`${__ORCHESTRATOR_URL__}/v1/billing/my/payment-methods`, () => {
        return HttpResponse.json(convertToResponsePayload(paymentMethods));
      })
    );

    const renderResult = await renderComponent(PaymentMethodListComponent);

    const paymentMethodElements = renderResult.container.querySelectorAll<HTMLElement>(
      '.payment-method-list__payment-method'
    );
    expect(paymentMethodElements[0]).toHaveClass('is-default');
    expect(paymentMethodElements[0]?.querySelector('button')).toBeDisabled();

    const user = userEvent.setup();
    await user.click(paymentMethodElements[0]!.querySelector('.info-tooltip button')!);

    await delayBy(16);

    expect(screen.getByText('Default payment method cannot be removed')).toBeInTheDocument();

    expect(paymentMethodElements[1]).not.toHaveClass('is-default');
    expect(paymentMethodElements[1]?.querySelector('button')).toBeEnabled();
  });

  it('Can remove non-default payment methods', async () => {
    const paymentMethods: PaymentMethod[] = [
      {
        brand: 'visa',
        expMonth: '4',
        expYear: '2034',
        isDefault: true,
        last4: '4242',
        paymentMethodId: '1'
      },
      {
        brand: 'mastercard',
        expMonth: '5',
        expYear: '2035',
        isDefault: false,
        last4: '4343',
        paymentMethodId: '2'
      }
    ];

    apiRequestMockServer.resetHandlers(
      http.get(`${__ORCHESTRATOR_URL__}/v1/billing/my/payment-methods`, () => {
        return HttpResponse.json(convertToResponsePayload(paymentMethods));
      }),
      http.delete(`${__ORCHESTRATOR_URL__}/v1/billing/my/payment-methods/2`, () => {
        return new HttpResponse(null, { status: 204 });
      })
    );

    const renderResult = await renderComponent(PaymentMethodListComponent);

    const paymentMethodElements = renderResult.container.querySelectorAll<HTMLElement>(
      '.payment-method-list__payment-method'
    );
    const user = userEvent.setup();
    await user.click(paymentMethodElements[1]!.querySelector('button:nth-of-type(2)')!);

    await delayBy(16);

    expect(screen.getByText(/Are you sure you want to remove/)).toBeInTheDocument();

    await user.click(screen.getByText('Confirm'));

    await delayBy(16);

    const updatedPaymentMethodElements = renderResult.container.querySelectorAll<HTMLElement>(
      '.payment-method-list__payment-method'
    );
    expect(updatedPaymentMethodElements).toHaveLength(1);
    expect(updatedPaymentMethodElements[0]).toHaveClass('is-default');
    expect(screen.getByText('4242')).toBeInTheDocument();
    expect(screen.queryByText('4343')).not.toBeInTheDocument();
  });

  it('Dismiss payment method removal confirmation when cancel is clicked', async () => {
    const paymentMethods: PaymentMethod[] = [
      {
        brand: 'visa',
        expMonth: '4',
        expYear: '2034',
        isDefault: true,
        last4: '4242',
        paymentMethodId: '1'
      },
      {
        brand: 'mastercard',
        expMonth: '5',
        expYear: '2035',
        isDefault: false,
        last4: '4343',
        paymentMethodId: '2'
      }
    ];

    apiRequestMockServer.resetHandlers(
      http.get(`${__ORCHESTRATOR_URL__}/v1/billing/my/payment-methods`, () => {
        return HttpResponse.json(convertToResponsePayload(paymentMethods));
      })
    );

    const renderResult = await renderComponent(PaymentMethodListComponent);

    const paymentMethodElements = renderResult.container.querySelectorAll<HTMLElement>(
      '.payment-method-list__payment-method'
    );
    const user = userEvent.setup();
    await user.click(paymentMethodElements[1]!.querySelector('button:nth-of-type(2)')!);

    await delayBy(16);

    expect(screen.getByText(/Are you sure you want to remove/)).toBeInTheDocument();

    await user.click(screen.getByText('Cancel'));

    expect(HttpClient.prototype.delete).not.toHaveBeenCalled();
  });

  it('Can change default payment method', async () => {
    const paymentMethods: PaymentMethod[] = [
      {
        brand: 'visa',
        expMonth: '4',
        expYear: '2034',
        isDefault: true,
        last4: '4242',
        paymentMethodId: '1'
      },
      {
        brand: 'mastercard',
        expMonth: '5',
        expYear: '2035',
        isDefault: false,
        last4: '4343',
        paymentMethodId: '2'
      }
    ];

    apiRequestMockServer.resetHandlers(
      http.get(`${__ORCHESTRATOR_URL__}/v1/billing/my/payment-methods`, () => {
        return HttpResponse.json(convertToResponsePayload(paymentMethods));
      }),
      http.patch(`${__ORCHESTRATOR_URL__}/v1/billing/my/payment-methods/2/default`, () => {
        return new HttpResponse(null, { status: 204 });
      })
    );

    const renderResult = await renderComponent(PaymentMethodListComponent);

    const paymentMethodElements = renderResult.container.querySelectorAll<HTMLElement>(
      '.payment-method-list__payment-method'
    );
    expect(paymentMethodElements[0]).toHaveClass('is-default');
    expect(paymentMethodElements[0]?.querySelector('.payment-method-list__payment-method__number')).toHaveTextContent(
      '×××××××××××× 4242'
    );

    const user = userEvent.setup();
    await user.click(paymentMethodElements[1]!.querySelector('button:first-of-type')!);

    await delayBy(16);

    expect(screen.getByText(/will be used by default for all future transactions\./)).toBeInTheDocument();

    const updatedPaymentMethodElements = renderResult.container.querySelectorAll<HTMLElement>(
      '.payment-method-list__payment-method'
    );
    expect(updatedPaymentMethodElements).toHaveLength(2);

    expect(updatedPaymentMethodElements[0]).toHaveClass('is-default');
    expect(
      updatedPaymentMethodElements[0]?.querySelector('.payment-method-list__payment-method__number')
    ).toHaveTextContent('×××××××××××× 4343');

    expect(updatedPaymentMethodElements[1]).not.toHaveClass('is-default');
    expect(
      updatedPaymentMethodElements[1]?.querySelector('.payment-method-list__payment-method__number')
    ).toHaveTextContent('×××××××××××× 4242');
  });

  it('Shows notification when changing default payment method fails', async () => {
    const paymentMethods: PaymentMethod[] = [
      {
        brand: 'visa',
        expMonth: '4',
        expYear: '2034',
        isDefault: true,
        last4: '4242',
        paymentMethodId: '1'
      },
      {
        brand: 'mastercard',
        expMonth: '5',
        expYear: '2035',
        isDefault: false,
        last4: '4343',
        paymentMethodId: '2'
      }
    ];

    apiRequestMockServer.resetHandlers(
      http.get(`${__ORCHESTRATOR_URL__}/v1/billing/my/payment-methods`, () => {
        return HttpResponse.json(convertToResponsePayload(paymentMethods));
      }),
      http.patch(`${__ORCHESTRATOR_URL__}/v1/billing/my/payment-methods/2/default`, () => {
        return HttpResponse.json(convertToResponsePayload({ code: ExceptionCode.UNKNOWN }, 'expected'), {
          status: 505
        });
      })
    );

    const renderResult = await renderComponent(PaymentMethodListComponent);

    const paymentMethodElements = renderResult.container.querySelectorAll<HTMLElement>(
      '.payment-method-list__payment-method'
    );

    const user = userEvent.setup();
    await user.click(paymentMethodElements[1]!.querySelector('button:first-of-type')!);

    await delayBy(16);

    expect(
      screen.getByText(/An unknown error has occurred while processing your request\. Please try again later\./)
    ).toBeInTheDocument();

    assertCalledOnceWith(
      Logger.prototype.error,
      'failed to set payment method as default',
      {
        message: 'expected',
        payload: { code: ExceptionCode.UNKNOWN }
      },
      {
        newDefaultPaymentMethod: paymentMethods[1]
      }
    );
  });

  it('Shows notification when removing payment method fails', async () => {
    const paymentMethods: PaymentMethod[] = [
      {
        brand: 'visa',
        expMonth: '4',
        expYear: '2034',
        isDefault: true,
        last4: '4242',
        paymentMethodId: '1'
      },
      {
        brand: 'mastercard',
        expMonth: '5',
        expYear: '2035',
        isDefault: false,
        last4: '4343',
        paymentMethodId: '2'
      }
    ];

    apiRequestMockServer.resetHandlers(
      http.get(`${__ORCHESTRATOR_URL__}/v1/billing/my/payment-methods`, () => {
        return HttpResponse.json(convertToResponsePayload(paymentMethods));
      }),
      http.delete(`${__ORCHESTRATOR_URL__}/v1/billing/my/payment-methods/2`, () => {
        return HttpResponse.json(convertToResponsePayload({ code: ExceptionCode.UNKNOWN }, 'expected'), {
          status: 505
        });
      })
    );

    const renderResult = await renderComponent(PaymentMethodListComponent);

    const paymentMethodElements = renderResult.container.querySelectorAll<HTMLElement>(
      '.payment-method-list__payment-method'
    );

    const user = userEvent.setup();
    await user.click(paymentMethodElements[1]!.querySelector('button:nth-of-type(2)')!);

    await delayBy(16);

    expect(screen.getByText(/Are you sure you want to remove/)).toBeInTheDocument();

    await user.click(screen.getByText('Confirm'));

    await delayBy(16);

    expect(
      screen.getByText(/An unknown error has occurred while processing your request\. Please try again later\./)
    ).toBeInTheDocument();

    assertCalledOnceWith(
      Logger.prototype.error,
      'failed to remove payment method',
      {
        message: 'expected',
        payload: { code: ExceptionCode.UNKNOWN }
      },
      { paymentMethod: paymentMethods[1] }
    );
  });

  it('Opens page to add payment method', async () => {
    apiRequestMockServer.resetHandlers(
      http.get(`${__ORCHESTRATOR_URL__}/v1/billing/my/payment-methods`, () => {
        return HttpResponse.json(convertToResponsePayload([]));
      }),
      http.get(`${__ORCHESTRATOR_URL__}/v1/billing/my/management/page/payment-method`, () => {
        return HttpResponse.json(convertToResponsePayload('https://example.com'));
      })
    );

    await renderComponent(PaymentMethodListComponent);

    expect(window.location.href).not.toEqual('https://example.com');

    const user = userEvent.setup();
    await user.click(screen.getByText('Add payment method'));

    expect(window.location.href).toEqual('https://example.com/');

    expect(Logger.prototype.error).not.toHaveBeenCalledOnce();
  });

  it('Shows notification when adding payment method but no billing info is available', async () => {
    apiRequestMockServer.resetHandlers(
      http.get(`${__ORCHESTRATOR_URL__}/v1/billing/my/payment-methods`, () => {
        return HttpResponse.json(convertToResponsePayload([]));
      }),
      http.get(`${__ORCHESTRATOR_URL__}/v1/billing/my/management/page/payment-method`, () => {
        return HttpResponse.json(
          convertToResponsePayload({ code: ExceptionCode.NOT_FOUND }, 'no billing info exists'),
          {
            status: 400
          }
        );
      })
    );

    await renderComponent(PaymentMethodListComponent);

    const user = userEvent.setup();
    await user.click(screen.getByText('Add payment method'));

    await delayBy(16);

    expect(
      screen.getByText(/Unable to add new payment method because we don't have your billing info on file\./)
    ).toBeInTheDocument();
    expect(screen.getByText(/You can add a new payment method during checkout\./)).toBeInTheDocument();
  });

  it('Shows notification with default message when adding payment method fails with an unhandled error', async () => {
    apiRequestMockServer.resetHandlers(
      http.get(`${__ORCHESTRATOR_URL__}/v1/billing/my/payment-methods`, () => {
        return HttpResponse.json(convertToResponsePayload([]));
      }),
      http.get(`${__ORCHESTRATOR_URL__}/v1/billing/my/management/page/payment-method`, () => {
        return HttpResponse.json(convertToResponsePayload({ code: ExceptionCode.UNKNOWN }, 'expected'), {
          status: 500
        });
      })
    );

    await renderComponent(PaymentMethodListComponent);

    const user = userEvent.setup();
    await user.click(screen.getByText('Add payment method'));

    await delayBy(16);

    expect(
      screen.getByText(/An unknown error has occurred while processing your request\. Please try again later\./)
    ).toBeInTheDocument();

    assertCalledOnceWith(Logger.prototype.error, 'failed to get url to page to add payment method', {
      message: 'expected',
      payload: { code: ExceptionCode.UNKNOWN }
    });
  });
});
