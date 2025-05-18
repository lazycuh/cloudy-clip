/* eslint-disable max-len */
import { screen } from '@testing-library/angular';
import { describe, expect, it } from 'vitest';

import { mockAuthenticatedUser, renderComponent } from 'test/utils';

import { SubscriptionNotFoundIndicatorComponent } from './subscription-not-found-indicator.component';

describe(SubscriptionNotFoundIndicatorComponent.name, () => {
  it('Should render correct mailto href when user is logged in', async () => {
    mockAuthenticatedUser();

    await renderComponent(SubscriptionNotFoundIndicatorComponent);

    expect(screen.getByText('Contact us')).toHaveAttribute(
      'href',
      'mailto:heretohelp@cloudyclip.com?subject=%5BTrade%20Timeline%5D%20Active%20subscription%20not%20found&body=My%20subscription%20is%20not%20available.%20My%20email%20address%20is%20helloworld@gmail.com.'
    );
  });

  it('Should render correct mailto href when user is not logged in', async () => {
    await renderComponent(SubscriptionNotFoundIndicatorComponent);

    expect(screen.getByText('Contact us')).toHaveAttribute(
      'href',
      'mailto:heretohelp@cloudyclip.com?subject=%5BTrade%20Timeline%5D%20Active%20subscription%20not%20found'
    );
  });
});
