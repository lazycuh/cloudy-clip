import { screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { renderComponent } from 'test/utils';

import { delayBy } from '../utils/delay-by';

import { NumberInputComponent } from './number-input.component';

describe(NumberInputComponent.name, () => {
  it('Display provided value', async () => {
    await renderComponent(NumberInputComponent, {
      inputs: {
        value: 5
      }
    });

    expect(screen.getByDisplayValue('5')).toBeTruthy();
  });

  it('Constraint input value to 0 by default if no minimum value is provided', async () => {
    await renderComponent(NumberInputComponent, {
      inputs: {
        value: 5
      }
    });

    const inputElement = screen.getByDisplayValue('5');

    expect(inputElement).toBeInTheDocument();

    const user = userEvent.setup();
    await user.clear(inputElement);
    await user.type(inputElement, '-10');
    await delayBy(500);

    await user.tab();
    expect(screen.queryByDisplayValue('5')).not.toBeInTheDocument();
    expect(screen.queryByDisplayValue('-10')).not.toBeInTheDocument();
    expect(screen.getByDisplayValue('0')).toBeInTheDocument();
  });

  it('Constraint input value to the provided minimum value', async () => {
    await renderComponent(NumberInputComponent, {
      inputs: {
        min: -20,
        value: 5
      }
    });

    const inputElement = screen.getByDisplayValue('5');

    expect(inputElement).toBeInTheDocument();

    const user = userEvent.setup();
    await user.clear(inputElement);
    await user.type(inputElement, '-50');
    await delayBy(500);

    await user.tab();
    expect(screen.queryByDisplayValue('5')).not.toBeInTheDocument();
    expect(screen.queryByDisplayValue('-50')).not.toBeInTheDocument();
    expect(screen.getByDisplayValue('-20')).toBeInTheDocument();
  });

  it('Increment by 1 when increment button is clicked', async () => {
    const renderResult = await renderComponent(NumberInputComponent, {
      inputs: {
        value: 5
      }
    });

    const user = userEvent.setup();
    await user.click(renderResult.container.querySelector('[aria-label="Increment by one"]')!);

    expect(screen.queryByDisplayValue('5')).not.toBeInTheDocument();
    expect(screen.getByDisplayValue('6')).toBeInTheDocument();
  });

  it('Increment by 1 when arrow up button is pressed', async () => {
    await renderComponent(NumberInputComponent, {
      inputs: {
        value: 5
      }
    });

    const user = userEvent.setup();
    await user.click(screen.getByDisplayValue('5'));
    await user.keyboard('{ArrowUp}');

    expect(screen.queryByDisplayValue('5')).not.toBeInTheDocument();
    expect(screen.getByDisplayValue('6')).toBeInTheDocument();
  });

  it('Decrement by 1 when decrement button is clicked', async () => {
    const renderResult = await renderComponent(NumberInputComponent, {
      inputs: {
        value: 5
      }
    });

    const user = userEvent.setup();
    await user.click(renderResult.container.querySelector('[aria-label="Decrement by one"]')!);

    expect(screen.queryByDisplayValue('5')).not.toBeInTheDocument();
    expect(screen.getByDisplayValue('4')).toBeInTheDocument();
  });

  it('Decrement by 1 when arrow down button is pressed', async () => {
    await renderComponent(NumberInputComponent, {
      inputs: {
        value: 5
      }
    });

    const user = userEvent.setup();
    await user.click(screen.getByDisplayValue('5'));
    await user.keyboard('{ArrowDown}');

    expect(screen.queryByDisplayValue('5')).not.toBeInTheDocument();
    expect(screen.getByDisplayValue('4')).toBeInTheDocument();
  });
});
