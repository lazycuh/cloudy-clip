import { ChangeDetectionStrategy, Component } from '@angular/core';
import { screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { renderComponent } from 'test/utils';

import { InfoTooltipComponent } from './info-tooltip.component';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [InfoTooltipComponent],
  selector: 'lc-test-bed',
  template: '<lc-info-tooltip>This is an info tooltip</lc-info-tooltip>'
})
class TestBedComponent {}

describe(InfoTooltipComponent.name, () => {
  it('Render content correctly after clicking the tooltip trigger', async () => {
    const renderResult = await renderComponent(TestBedComponent);

    expect(screen.queryByText('This is an info tooltip')).not.toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(renderResult.container.firstElementChild!.querySelector('button')!);

    expect(screen.getByText('This is an info tooltip')).toBeInTheDocument();
  });

  it('Clicking on window will close the tooltip', async () => {
    const renderResult = await renderComponent(TestBedComponent);

    const user = userEvent.setup();
    await user.click(renderResult.container.firstElementChild!.querySelector('button')!);

    expect(screen.getByText('This is an info tooltip')).toBeInTheDocument();

    window.dispatchEvent(new CustomEvent('click', { bubbles: true }));

    // Since we're using no-op angular animation, this is how we can check if the tooltip is hidden
    expect(document.querySelector('.lc-tooltip')).toHaveClass('leave');
  });
});
