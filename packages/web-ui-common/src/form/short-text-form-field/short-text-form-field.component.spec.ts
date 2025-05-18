import { ChangeDetectionStrategy, Component } from '@angular/core';
import { FormControl, Validators } from '@angular/forms';
import { describe, expect, it } from 'vitest';

import { renderComponent } from 'test/utils';

import { ShortTextFormFieldComponent } from './short-text-form-field.component';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ShortTextFormFieldComponent],
  selector: 'lc-test-bed',
  template: `
    <lc-short-text-form-field
      autocomplete="address-line1"
      label="This is a test label"
      type="email"
      [control]="control" />
  `
})
class TestBedComponent {
  control = new FormControl('', Validators.required);
}

describe(ShortTextFormFieldComponent.name, () => {
  it('Render correctly', async () => {
    const renderResult = await renderComponent(TestBedComponent);

    expect(renderResult.getByLabelText('This is a test label')).toBeInTheDocument();

    const inputElement = renderResult.container.querySelector('input');
    expect(inputElement).toHaveAttribute('type', 'email');
    expect(inputElement).toHaveAttribute('autocomplete', 'address-line1');
  });
});
