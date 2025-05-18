import { ChangeDetectionStrategy, Component } from '@angular/core';
import { FormControl, Validators } from '@angular/forms';
import { screen } from '@testing-library/angular';
import { describe, expect, it, vi } from 'vitest';

import { renderComponent } from 'test/utils';

import { delayBy } from '../../utils/delay-by';
import * as generateRandomStringModule from '../../utils/generate-random-string';

import { FormFieldComponent } from './form-field.component';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormFieldComponent],
  selector: 'lc-test-bed',
  template: `
    <lc-form-field
      label="This is a test label"
      [control]="control">
      <input
        #inputElement
        type="text" />
    </lc-form-field>
  `
})
class TestBedComponent {
  control = new FormControl('', Validators.required);
}

describe(FormFieldComponent.name, () => {
  it('Form field has ID', async () => {
    vi.spyOn(generateRandomStringModule, 'generateRandomString').mockReturnValue('test-id');

    const renderResult = await renderComponent(TestBedComponent);

    expect(renderResult.container.querySelector('input')).toHaveAttribute('id', 'test-id');
    expect(renderResult.container.querySelector('label')).toHaveAttribute('for', 'test-id');
  });

  it('Add correct css class when control is invalid', async () => {
    const renderResult = await renderComponent(TestBedComponent);
    const control = renderResult.fixture.componentInstance.control;

    expect(screen.getByLabelText('This is a test label')).toBeInTheDocument();

    control.setValue('Hello World');
    control.updateValueAndValidity();
    control.markAsDirty();
    control.markAsTouched();

    await delayBy(16);

    control.setValue('');
    control.updateValueAndValidity();

    await delayBy(16);

    expect(renderResult.container.firstElementChild).toHaveClass('invalid-input');
    expect(screen.getByText('This is a test label is required')).toBeInTheDocument();
  });

  it('Add correct css class when control is disabled', async () => {
    const renderResult = await renderComponent(TestBedComponent);
    const control = renderResult.fixture.componentInstance.control;

    expect(screen.getByLabelText('This is a test label')).toBeInTheDocument();

    control.setValue('Hello World');
    control.updateValueAndValidity();
    control.markAsDirty();
    control.markAsTouched();
    control.disable();

    await delayBy(16);

    expect(renderResult.container.firstElementChild).toHaveClass('is-disabled');
  });
});
