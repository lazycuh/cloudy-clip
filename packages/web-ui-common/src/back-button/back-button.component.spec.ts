import { Location } from '@angular/common';
import { ConfirmationCaptureService } from '@lazycuh/angular-confirmation-capture';
import { screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { renderComponent } from 'test/utils';

import { delayBy } from '../utils/delay-by';

import { BackButtonComponent } from './back-button.component';

describe(BackButtonComponent.name, () => {
  const locationMock = {
    back: vi.fn(),
    getState: vi.fn().mockReturnValue({}),
    isCurrentPathEqualTo: vi.fn().mockReturnValue(true),
    path: vi.fn(),
    replaceState: vi.fn(),
    subscribe: vi.fn()
  };

  it('Go back to previous history entry', async () => {
    await renderComponent(BackButtonComponent, {
      providers: [{ provide: Location, useValue: locationMock }, ConfirmationCaptureService]
    });
    const user = userEvent.setup();

    await user.click(screen.getByRole('button'));

    expect(locationMock.back).toHaveBeenCalledOnce();
  });

  it('Show a confirmation before going back', async () => {
    await renderComponent(BackButtonComponent, {
      inputs: { shouldShowConfirmation: true },
      providers: [{ provide: Location, useValue: locationMock }, ConfirmationCaptureService]
    });

    const user = userEvent.setup();

    await user.click(screen.getByRole('button'));

    expect(screen.getByText('Are you sure you want to go back to previous page?')).toBeInTheDocument();

    expect(locationMock.back).not.toHaveBeenCalled();
  });

  it('Go back to previous history entry after showing confirmation and "Confirm" button is clicked', async () => {
    await renderComponent(BackButtonComponent, {
      inputs: { shouldShowConfirmation: true },
      providers: [{ provide: Location, useValue: locationMock }, ConfirmationCaptureService]
    });

    const user = userEvent.setup();

    await user.click(screen.getByRole('button'));

    await delayBy(250);

    await user.click(screen.getByText('Confirm'));

    expect(locationMock.back).toHaveBeenCalledOnce();
  });

  it('Do not go back to previous history entry after showing confirmation and "Cancel" button is clicked', async () => {
    await renderComponent(BackButtonComponent, {
      inputs: { shouldShowConfirmation: true },
      providers: [{ provide: Location, useValue: locationMock }, ConfirmationCaptureService]
    });

    const user = userEvent.setup();

    await user.click(screen.getByRole('button'));

    await delayBy(250);

    await user.click(screen.getByText('Cancel'));

    expect(locationMock.back).not.toHaveBeenCalled();
  });
});
