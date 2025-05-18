import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { renderComponent } from 'test/utils';

import * as generateRandomStringModule from '../../utils/generate-random-string';
import { ButtonToggleComponent } from '../button-toggle/button-toggle.component';

import { ButtonToggleGroupComponent } from './button-toggle-group.component';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonToggleGroupComponent, ButtonToggleComponent],
  selector: 'lc-test-bed',
  template: `
    <lc-button-toggle-group aria-label="test-aria-label">
      <lc-button-toggle
        [selected]="toggleState() === '1'"
        (activate)="toggleState.set('1')">
        Button 1
      </lc-button-toggle>

      <lc-button-toggle
        [selected]="toggleState() === '2'"
        (activate)="toggleState.set('2')">
        Button 2
      </lc-button-toggle>

      <lc-button-toggle
        [selected]="toggleState() === '3'"
        (activate)="toggleState.set('3')">
        Button 3
      </lc-button-toggle>
    </lc-button-toggle-group>
  `
})
class TestBedComponent {
  toggleState = signal<'1' | '2'>('1');
}

describe(ButtonToggleGroupComponent.name, () => {
  it('Have expected ARIA attributes', async () => {
    vi.spyOn(generateRandomStringModule, 'generateRandomString').mockReturnValue('test-name');

    const renderResult = await renderComponent(TestBedComponent);
    const rootElement = renderResult.container.firstElementChild;

    expect(rootElement).toHaveAttribute('role', 'radiogroup');
    expect(rootElement).toHaveAttribute('name', 'test-name');
    expect(rootElement).toHaveAttribute('aria-label', 'test-aria-label');

    const button1 = screen.getByText('Button 1');
    const button2 = screen.getByText('Button 2');
    const button3 = screen.getByText('Button 3');

    expect(button1).toHaveAttribute('role', 'radio');
    expect(button1).toHaveAttribute('name', 'test-name');
    expect(button2).toHaveAttribute('role', 'radio');
    expect(button2).toHaveAttribute('name', 'test-name');
    expect(button3).toHaveAttribute('role', 'radio');
    expect(button3).toHaveAttribute('name', 'test-name');
  });

  it('Toggle between buttons', async () => {
    await renderComponent(TestBedComponent);

    const button1 = screen.getByText('Button 1');
    const button2 = screen.getByText('Button 2');
    const button3 = screen.getByText('Button 3');

    const user = userEvent.setup();

    await user.click(button2);

    expect(button1).toHaveAttribute('aria-checked', 'false');
    expect(button2).toHaveAttribute('aria-checked', 'true');
    expect(button3).toHaveAttribute('aria-checked', 'false');

    await user.click(button3);

    expect(button1).toHaveAttribute('aria-checked', 'false');
    expect(button2).toHaveAttribute('aria-checked', 'false');
    expect(button3).toHaveAttribute('aria-checked', 'true');

    await user.click(button1);

    expect(button1).toHaveAttribute('aria-checked', 'true');
    expect(button2).toHaveAttribute('aria-checked', 'false');
    expect(button3).toHaveAttribute('aria-checked', 'false');
  });
});
