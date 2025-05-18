import { ActivatedRoute } from '@angular/router';
import { screen } from '@testing-library/angular';
import { describe, expect, it } from 'vitest';

import { renderComponent } from 'test/utils';

import { UserDashboardComponent } from './user-dashboard.component';

describe(UserDashboardComponent.name, () => {
  it('Renders correctly', async () => {
    await renderComponent(UserDashboardComponent, {
      providers: [
        {
          provide: ActivatedRoute,
          useValue: {}
        }
      ]
    });

    expect(screen.getByText('Account')).toHaveAttribute('href', '/my/account');
    expect(screen.getByText('Subscription')).toHaveAttribute('href', '/my/subscription');
    expect(screen.getByText('Billing history')).toHaveAttribute('href', '/my/billing');
    expect(screen.getByText('Payment methods')).toHaveAttribute('href', '/my/payment-methods');
  });
});
