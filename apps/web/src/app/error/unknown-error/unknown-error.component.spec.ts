/* eslint-disable max-len */
import { Router } from '@angular/router';
import { screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { renderComponent } from 'test/utils';

import { UnknownErrorComponent } from './unknown-error.component';

describe(UnknownErrorComponent.name, () => {
  it('Renders correctly', async () => {
    vi.spyOn(window.location, 'reload');

    await renderComponent(UnknownErrorComponent);

    expect(
      screen.getByText(
        'Our apologies for the inconvenience. Our system is currently experiencing a case of the Mondays.'
      )
    ).toBeInTheDocument();

    expect(screen.getByText('Please try again later, or contact our support team for assistance.')).toBeInTheDocument();
    expect(screen.getByText('Contact us')).toHaveAttribute('target', '_blank');
    expect(screen.getByText('Contact us')).toHaveAttribute(
      'href',
      'mailto:heretohelp@cloudyclip.com?subject=%5BTrade%20Timeline%5D%20Unknown%20error&body=Account%20email:%20%0AError%20description:'
    );
    expect(screen.queryByText('Request ID:')).not.toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(screen.getByText('Reload page'));

    expect(window.location.reload).toHaveBeenCalledTimes(1);
  });

  it('Renders request ID if it is present in the router state', async () => {
    await renderComponent(UnknownErrorComponent, {
      providers: [
        {
          provide: Router,
          useValue: {
            getCurrentNavigation: () => ({ extras: { state: { requestId: 'hello-world' } } }),
            navigateByUrl: vi.fn().mockResolvedValue(true)
          }
        }
      ]
    });

    expect(screen.getByText('Request ID: hello-world')).toBeInTheDocument();
  });
});
