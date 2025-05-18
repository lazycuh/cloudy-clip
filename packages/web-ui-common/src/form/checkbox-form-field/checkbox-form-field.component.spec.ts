import { ChangeDetectionStrategy, Component } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl } from '@angular/forms';
import { screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { map } from 'rxjs';
import { describe, expect, it } from 'vitest';

import { renderComponent } from 'test/utils';

import { CheckboxFormFieldComponent } from './checkbox-form-field.component';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CheckboxFormFieldComponent],
  selector: 'lc-test-bed',
  template: `
    <lc-checkbox-form-field [control]="control">This is a test</lc-checkbox-form-field>
    <button
      type="button"
      [disabled]="shouldDisableButton()">
      Click me
    </button>
  `
})
class TestBedComponent {
  control = new FormControl(false);
  shouldDisableButton = toSignal(this.control.valueChanges.pipe(map(value => !value)), { initialValue: true });
}

describe(CheckboxFormFieldComponent.name, () => {
  it('Toggle on and off', async () => {
    await renderComponent(TestBedComponent);

    const checkbox = screen.getByText('This is a test');
    expect(checkbox).toBeInTheDocument();

    const button = screen.getByText('Click me');
    expect(button).toBeInTheDocument();
    expect(button).toBeDisabled();

    const user = userEvent.setup();

    await user.click(checkbox);

    expect(button).toBeEnabled();

    await user.click(checkbox);

    expect(button).toBeDisabled();
  });
});
