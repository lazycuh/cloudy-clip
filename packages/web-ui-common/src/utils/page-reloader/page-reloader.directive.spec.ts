import { ChangeDetectionStrategy, Component } from '@angular/core';
import { screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { renderComponent } from 'test/utils';

import { PageReloaderDirective } from './page-reloader.directive';

describe(PageReloaderDirective.name, () => {
  it('Should reload page when host is clicked on', async () => {
    @Component({
      changeDetection: ChangeDetectionStrategy.OnPush,
      imports: [PageReloaderDirective],
      selector: 'lc-test-bed',
      template: `
        <button
          lc-reload-page
          type="button">
          Click me
        </button>
      `
    })
    class TestBedComponent {}

    await renderComponent(TestBedComponent);

    const user = userEvent.setup();
    await user.click(screen.getByText('Click me'));

    expect(window.location.reload).toHaveBeenCalledOnce();
  });
});
