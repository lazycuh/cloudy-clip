import { Router } from '@angular/router';
import { screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { BehaviorSubject } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';

import { assertCalledOnceWith, renderComponent } from 'test/utils';

import { UserService } from '../auth';

import { GlobalAppBarComponent } from './global-app-bar.component';

describe(GlobalAppBarComponent.name, () => {
  it('Render correctly with default actions when user is not logged in', async () => {
    const renderResult = await renderComponent(GlobalAppBarComponent);

    expect(screen.getByText('Cloudy Clip')).toBeInTheDocument();
    expect(screen.getByAltText('Cloudy Clip App Logo')).toBeInTheDocument();

    expect(renderResult.container.querySelector('.view-pricing-action')).toHaveAttribute('href', '/pricing');
    expect(screen.getByText('Pricing')).toBeInTheDocument();

    expect(renderResult.container.querySelector('.log-in-action')).toHaveAttribute('href', '/login');
    expect(screen.getByText('Log in')).toBeInTheDocument();

    expect(screen.queryByText('Log out')).not.toBeInTheDocument();
  });

  it('Render correctly with default actions when user is logged in', async () => {
    vi.spyOn(UserService.prototype, 'loginStatusChanges').mockReturnValue(new BehaviorSubject(true));

    const renderResult = await renderComponent(GlobalAppBarComponent);

    expect(screen.getByText('Cloudy Clip')).toBeInTheDocument();
    expect(screen.getByAltText('Cloudy Clip App Logo')).toBeInTheDocument();

    expect(renderResult.container.querySelector('.view-pricing-action')).toHaveAttribute('href', '/pricing');
    expect(screen.getByText('Pricing')).toBeInTheDocument();

    expect(renderResult.container.querySelector('.go-to-dashboard-action')).toHaveAttribute('href', '/my/account');
    expect(screen.getByText('Dashboard')).toBeInTheDocument();

    expect(screen.getByText('Log out')).toBeInTheDocument();

    expect(screen.queryByText('Log in')).not.toBeInTheDocument();
  });

  it('Navigate to login page after logout', async () => {
    vi.spyOn(UserService.prototype, 'loginStatusChanges').mockReturnValue(new BehaviorSubject(true));

    await renderComponent(GlobalAppBarComponent);

    const logoutMethodSpy = vi.spyOn(UserService.prototype, 'signOut').mockResolvedValue(undefined);

    const user = userEvent.setup();
    await user.click(screen.getByText('Log out'));

    assertCalledOnceWith(Router.prototype.navigateByUrl, '/login');

    expect(logoutMethodSpy).toHaveBeenCalledOnce();
  });
});
