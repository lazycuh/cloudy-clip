import { screen } from '@testing-library/angular';
import { describe, expect, it, vi } from 'vitest';

import { renderComponent } from 'test/utils';

import { NotFoundErrorComponent } from './not-found-error.component';

describe(NotFoundErrorComponent.name, () => {
  it('Renders correctly', async () => {
    vi.spyOn(window.location, 'reload');

    await renderComponent(NotFoundErrorComponent);

    expect(screen.getByAltText('Not found')).toHaveAttribute('src', '/images/404.svg');

    expect(screen.getByText(/Uh-oh,/)).toBeInTheDocument();
    expect(screen.getByText(/nothing to see here\./)).toBeInTheDocument();

    expect(screen.getByText('Home page')).toHaveAttribute('href', '/');
  });
});
