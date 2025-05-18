import { Router } from '@angular/router';
import { UserService } from '@lazycuh/web-ui-common/auth';
import { screen } from '@testing-library/angular';
import { describe, expect, it, vi } from 'vitest';

import { renderComponent } from 'test/utils';

import { LoginPageComponent } from './login-page.component';

describe(LoginPageComponent.name, () => {
  it('Redirect to /my/account when user is already authenticated', async () => {
    vi.spyOn(UserService.prototype, 'isUserAlreadyLoggedIn').mockResolvedValue(true);

    await renderComponent(LoginPageComponent);

    expect(Router.prototype.navigateByUrl).toHaveBeenCalledWith('/my/account');
  });

  it('Has consent display', async () => {
    await renderComponent(LoginPageComponent);

    expect(screen.getByText('By logging in, you agree to')).toBeInTheDocument();
  });
});
