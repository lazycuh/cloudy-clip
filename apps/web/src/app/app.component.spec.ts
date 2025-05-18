import { AnchoredFloatingBox } from '@lazycuh/angular-anchored-floating-box';
import { ConfirmationCaptureService } from '@lazycuh/angular-confirmation-capture';
import { NotificationService } from '@lazycuh/angular-notification';
import { Logger } from '@lazycuh/logging';
import * as stripe from '@stripe/stripe-js';
import { describe, expect, it, vi } from 'vitest';

import { assertCalledOnceWith, renderComponent } from 'test/utils';

import { AppComponent } from './app.component';

vi.mock('@stripe/stripe-js', () => {
  return {
    loadStripe: vi.fn().mockResolvedValue({} as stripe.Stripe)
  };
});

describe(AppComponent.name, () => {
  it('Has app title', async () => {
    const renderResult = await renderComponent(AppComponent);
    expect(renderResult.getAllByText('Cloudy Clip')).toHaveLength(2);
  });

  it('Performs setup', async () => {
    vi.spyOn(AnchoredFloatingBox, 'setDefaultTheme');
    vi.spyOn(ConfirmationCaptureService, 'setDefaultCancelButtonLabel');
    vi.spyOn(ConfirmationCaptureService, 'setDefaultConfirmButtonLabel');
    vi.spyOn(NotificationService, 'setDefaultCloseButtonLabel');
    vi.spyOn(stripe, 'loadStripe').mockResolvedValue({} as stripe.Stripe);

    await renderComponent(AppComponent);

    assertCalledOnceWith(AnchoredFloatingBox.setDefaultTheme, 'dark');
    assertCalledOnceWith(ConfirmationCaptureService.setDefaultCancelButtonLabel, 'Cancel');
    assertCalledOnceWith(ConfirmationCaptureService.setDefaultConfirmButtonLabel, 'Confirm');
    assertCalledOnceWith(NotificationService.setDefaultCloseButtonLabel, 'Close');
    assertCalledOnceWith(stripe.loadStripe, __STRIPE_API_KEY__);
  });

  it('Logs error when initializing stripe fails', async () => {
    vi.spyOn(stripe, 'loadStripe').mockRejectedValue(new Error('expected'));

    await renderComponent(AppComponent);

    assertCalledOnceWith(Logger.prototype.error, 'failed to initialize stripe', new Error('expected'));
  });
});
