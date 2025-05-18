import { AnchoredFloatingBox } from '@lazycuh/angular-anchored-floating-box';
import { ConfirmationCaptureService } from '@lazycuh/angular-confirmation-capture';
import { NotificationService } from '@lazycuh/angular-notification';
import { describe, expect, it, vi } from 'vitest';

import { assertCalledOnceWith, renderComponent } from 'test/utils';

import { AppComponent } from './app.component';

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

    await renderComponent(AppComponent);

    assertCalledOnceWith(AnchoredFloatingBox.setDefaultTheme, 'dark');
    assertCalledOnceWith(ConfirmationCaptureService.setDefaultCancelButtonLabel, 'Cancel');
    assertCalledOnceWith(ConfirmationCaptureService.setDefaultConfirmButtonLabel, 'Confirm');
    assertCalledOnceWith(NotificationService.setDefaultCloseButtonLabel, 'Close');
  });
});
