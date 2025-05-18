/* eslint-disable max-len */
import { Optional } from '@lazycuh/optional';
import { UserService } from '@lazycuh/web-ui-common/auth';
import { screen } from '@testing-library/angular';
import { describe, expect, it, vi } from 'vitest';

import { deepCloneObject, renderComponent } from 'test/utils';
import { generateAuthenticatedUser } from 'test/utils/generate-authenticated-user';

import { SubscriptionService } from '../services';
import { SubscriptionComponent } from '../subscription.component';

import { StatusNoSubscriptionComponent } from './status-no-subscription.component';

describe(StatusNoSubscriptionComponent.name, () => {
  const render = async () => {
    const user = deepCloneObject(generateAuthenticatedUser());

    vi.spyOn(UserService.prototype, 'getAuthenticatedUser').mockReturnValue(user);
    vi.spyOn(UserService.prototype, 'findAuthenticatedUser').mockReturnValue(Optional.of(user));

    return renderComponent(SubscriptionComponent, { providers: [SubscriptionService] });
  };

  it('Renders correctly', async () => {
    await render();

    expect(screen.getByText('Subscription')).toBeInTheDocument();
    expect(screen.getByText('You do not have an active subscription')).toBeInTheDocument();
    expect(screen.getByText('If it is a mistake, please let us know.')).toBeInTheDocument();
    expect(screen.getByText('Explore plans')).toHaveAttribute('href', '/pricing');
    expect(screen.getByText('Contact us')).toHaveAttribute('target', '_blank');
    expect(screen.getByText('Contact us')).toHaveAttribute(
      'href',
      'mailto:heretohelp@cloudyclip.com?subject=%5BTrade%20Timeline%5D%20Active%20subscription%20not%20found&body=My%20subscription%20is%20not%20available.%20My%20email%20address%20is%20helloworld@gmail.com.'
    );
  });
});
