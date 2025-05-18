import { ChangeDetectionStrategy, Component } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { assertCalledOnceWith, renderComponent } from 'test/utils';

import * as generateRandomStringModule from '../../utils/generate-random-string';
import { CheckboxFormFieldComponent } from '../checkbox-form-field';

import { FormComponent } from './form.component';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormComponent, CheckboxFormFieldComponent],
  selector: 'lc-test-bed',
  template: `
    <lc-form
      formTitle="This is a form title"
      [form]="form"
      (submitForm)="submitForm($event)">
      <lc-checkbox-form-field [control]="form.get('checkbox')">This is a test checkbox</lc-checkbox-form-field>
      <button type="submit">Click me</button>
    </lc-form>
  `
})
class TestBedComponent {
  form = new FormGroup({
    checkbox: new FormControl(false, Validators.requiredTrue)
  });

  submitForm = vi.fn();
}

describe(FormComponent.name, () => {
  it('Submit form by clicking submit button', async () => {
    const renderResult = await renderComponent(TestBedComponent);

    expect(screen.getByText('This is a form title')).toBeInTheDocument();

    const user = userEvent.setup();

    await user.click(screen.getByText('This is a test checkbox'));
    await user.click(screen.getByText('Click me'));

    assertCalledOnceWith(renderResult.fixture.componentInstance.submitForm, { checkbox: true });
  });

  it('Submit form by pressing enter key', async () => {
    const renderResult = await renderComponent(TestBedComponent);

    expect(screen.getByText('This is a form title')).toBeInTheDocument();

    const user = userEvent.setup();

    await user.click(screen.getByText('This is a test checkbox'));
    await user.keyboard('{enter}');

    assertCalledOnceWith(renderResult.fixture.componentInstance.submitForm, { checkbox: true });
  });

  it('Do not submit when form is pristine', async () => {
    const renderResult = await renderComponent(TestBedComponent);

    expect(screen.getByText('This is a form title')).toBeInTheDocument();

    const user = userEvent.setup();

    await user.click(screen.getByText('This is a test checkbox'));

    renderResult.fixture.componentInstance.form.markAsPristine();

    await user.keyboard('{enter}');

    expect(renderResult.fixture.componentInstance.submitForm).not.toHaveBeenCalled();
  });

  it('Do not submit when form is invalid', async () => {
    const renderResult = await renderComponent(TestBedComponent);

    expect(screen.getByText('This is a form title')).toBeInTheDocument();

    const user = userEvent.setup();

    await user.click(screen.getByText('This is a test checkbox'));
    await user.click(screen.getByText('This is a test checkbox'));

    await user.keyboard('{enter}');

    expect(renderResult.fixture.componentInstance.submitForm).not.toHaveBeenCalled();
  });

  it('Form has ID', async () => {
    vi.spyOn(generateRandomStringModule, 'generateRandomString').mockReturnValue('test-id');

    const renderResult = await renderComponent(TestBedComponent);

    expect(renderResult.container.querySelector('form')).toHaveAttribute('id', 'test-id');
  });
});
