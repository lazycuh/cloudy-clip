/* eslint-disable max-len */
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { FormControl, Validators } from '@angular/forms';
import { screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { renderComponent } from 'test/utils';

import { delayBy } from '../../utils/delay-by';

import { SelectFormFieldComponent } from './select-form-field.component';
import { SelectOption } from './select-option';

function getTestBedComponent(defaultValue = 'Value: One') {
  @Component({
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [SelectFormFieldComponent],
    selector: 'lc-test-bed',
    template: `
      <lc-select-form-field
        label="This is a test label"
        [control]="control"
        [options]="options" />
    `
  })
  class TestBedComponent {
    options = ['One', 'Two', 'Three'].map(e => new SelectOption(e, `Value: ${e}`));
    control = new FormControl(defaultValue, Validators.required);
  }

  return TestBedComponent;
}

describe(SelectFormFieldComponent.name, () => {
  it('Selects any of the available options', async () => {
    const renderResult = await renderComponent(getTestBedComponent());

    expect(screen.getByText('This is a test label')).toBeInTheDocument();
    expect(screen.queryByText('One')).not.toBeInTheDocument();
    expect(screen.queryByText('Two')).not.toBeInTheDocument();
    expect(screen.queryByText('Three')).not.toBeInTheDocument();

    const inputElement = renderResult.container.querySelector('input')!;
    const user = userEvent.setup();

    await user.clear(inputElement);

    expect(screen.getByText('One')).toBeInTheDocument();
    expect(screen.getByText('Two')).toBeInTheDocument();
    expect(screen.getByText('Three')).toBeInTheDocument();

    await user.click(screen.getByText('Two'));

    expect(screen.queryByText('One')).not.toBeInTheDocument();
    expect(screen.getByDisplayValue('Two')).toBeInTheDocument();
    expect(screen.queryByText('Three')).not.toBeInTheDocument();

    await user.clear(inputElement);

    expect(screen.getByText('One')).toBeInTheDocument();
    expect(screen.getByText('Two')).toBeInTheDocument();
    expect(screen.getByText('Three')).toBeInTheDocument();

    await user.click(screen.getByText('Three'));

    expect(screen.queryByText('One')).not.toBeInTheDocument();
    expect(screen.queryByText('Two')).not.toBeInTheDocument();
    expect(screen.getByDisplayValue('Three')).toBeInTheDocument();
  });

  it('Auto-selects when there is only one option after typing', async () => {
    const renderResult = await renderComponent(getTestBedComponent());

    expect(screen.getByText('This is a test label')).toBeInTheDocument();
    expect(screen.queryByText('One')).not.toBeInTheDocument();
    expect(screen.queryByText('Two')).not.toBeInTheDocument();
    expect(screen.queryByText('Three')).not.toBeInTheDocument();

    const inputElement = renderResult.container.querySelector('input')!;
    const user = userEvent.setup();

    await user.clear(inputElement);
    await user.type(inputElement, 'Tw');

    expect(screen.queryByText('One')).not.toBeInTheDocument();
    expect(screen.getByText('Two')).toBeInTheDocument();
    expect(screen.queryByText('Three')).not.toBeInTheDocument();

    inputElement.blur();

    await delayBy(300);

    expect(screen.getByDisplayValue('Two')).toBeInTheDocument();
  });

  it('Does not auto-select when there are more than one option after typing', async () => {
    const renderResult = await renderComponent(getTestBedComponent());

    expect(screen.getByText('This is a test label')).toBeInTheDocument();
    expect(screen.queryByText('One')).not.toBeInTheDocument();
    expect(screen.queryByText('Two')).not.toBeInTheDocument();
    expect(screen.queryByText('Three')).not.toBeInTheDocument();

    const inputElement = renderResult.container.querySelector('input')!;
    const user = userEvent.setup();

    await user.clear(inputElement);
    await user.type(inputElement, 'o');

    expect(screen.getByDisplayValue('o')).toBeInTheDocument();

    expect(screen.getByText('One')).toBeInTheDocument();
    expect(screen.getByText('Two')).toBeInTheDocument();
    expect(screen.queryByText('Three')).not.toBeInTheDocument();
  });

  it('Reverts back to previously selected value when input element loses focus but nothing is selected and there are more than one matched options', async () => {
    const renderResult = await renderComponent(getTestBedComponent());

    expect(screen.getByText('This is a test label')).toBeInTheDocument();
    expect(screen.queryByText('One')).not.toBeInTheDocument();
    expect(screen.queryByText('Two')).not.toBeInTheDocument();
    expect(screen.queryByText('Three')).not.toBeInTheDocument();

    const inputElement = renderResult.container.querySelector('input')!;
    const user = userEvent.setup();

    await user.clear(inputElement);
    await user.type(inputElement, 'thr');

    await user.click(screen.getByText('Three'));

    await user.clear(inputElement);
    await user.type(inputElement, 'o');

    expect(screen.getByDisplayValue('o')).toBeInTheDocument();

    expect(screen.getByText('One')).toBeInTheDocument();
    expect(screen.getByText('Two')).toBeInTheDocument();
    expect(screen.queryByText('Three')).not.toBeInTheDocument();

    inputElement.blur();

    await delayBy(300);

    expect(screen.queryByText('One')).not.toBeInTheDocument();
    expect(screen.queryByText('Two')).not.toBeInTheDocument();
    expect(screen.queryAllByText('Three')).toHaveLength(1);

    expect(screen.getByDisplayValue('Three')).toBeInTheDocument();
  });

  it('Does not render default selected value if default value does not match any of the existing options', async () => {
    const renderResult = await renderComponent(getTestBedComponent('Non-existing value'));

    expect(screen.getByText('This is a test label')).toBeInTheDocument();
    expect(screen.queryByText('One')).not.toBeInTheDocument();
    expect(screen.queryByText('Two')).not.toBeInTheDocument();
    expect(screen.queryByText('Three')).not.toBeInTheDocument();

    const inputElement = renderResult.container.querySelector('input')!;
    expect(inputElement.value).toEqual('');

    const user = userEvent.setup();
    await user.clear(inputElement);
    await user.click(inputElement);

    inputElement.blur();
    await delayBy(300);
    expect(inputElement.value).toEqual('');
  });
});
