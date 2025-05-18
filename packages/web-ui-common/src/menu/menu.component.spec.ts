import { FormControl } from '@angular/forms';
import { screen } from '@testing-library/angular';
import userEvent, { UserEvent } from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { renderComponent } from 'test/utils';

import { delayBy } from '../utils/delay-by';

import { MenuComponent } from './menu.component';
import { MenuOption } from './menu-option';

describe(MenuComponent.name, () => {
  const options = ['One', 'Two', 'Three'].map(e => new MenuOption(e, e));

  async function selectOption(user: UserEvent, currentOptionText: string, newOptionText: string) {
    await user.click(screen.getByText(currentOptionText));
    await user.click(screen.getByText(newOptionText));

    await delayBy(16);

    expect(screen.getByText(newOptionText)).toBeInTheDocument();
    expect(screen.queryByText(currentOptionText)).not.toBeInTheDocument();
  }

  it('Shows "Select one" when no default selected option index is specified', async () => {
    const control = new FormControl<string | null>(null);

    await renderComponent(MenuComponent, { inputs: { control, options } });

    expect(screen.getByText('Select one')).toBeInTheDocument();
  });

  it('Shows option selected by default', async () => {
    const control = new FormControl<string | null>(null);

    await renderComponent(MenuComponent, { inputs: { control, options, selectedOptionIndex: 1 } });

    expect(screen.getByText('Two')).toBeInTheDocument();
    expect(screen.queryByText('Select one')).not.toBeInTheDocument();
  });

  it('Can select different options', async () => {
    const control = new FormControl<string | null>(null);

    await renderComponent(MenuComponent, { inputs: { control, options } });

    const user = userEvent.setup();

    expect(control.value).toEqual(null);

    await selectOption(user, 'Select one', 'Two');
    expect(control.value).toEqual('Two');

    await selectOption(user, 'Two', 'One');
    expect(control.value).toEqual('One');

    await selectOption(user, 'One', 'Three');
    expect(control.value).toEqual('Three');
  });

  it('Shows label when selected', async () => {
    const menuOptions = ['One', 'Two', 'Three'].map((e, i) => new MenuOption(e, e, String(i + 1)));

    const control = new FormControl<string | null>(null);

    await renderComponent(MenuComponent, { inputs: { control, options: menuOptions } });

    const user = userEvent.setup();

    await user.click(screen.getByText('Select one'));
    await user.click(screen.getByText('One'));

    await delayBy(16);

    expect(control.value).toEqual('One');
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.queryByText('Select one')).not.toBeInTheDocument();
    expect(screen.queryByText('One')).not.toBeInTheDocument();

    await user.click(screen.getByText('1'));
    await user.click(screen.getByText('Two'));

    await delayBy(16);

    expect(control.value).toEqual('Two');
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.queryByText('Two')).not.toBeInTheDocument();
    expect(screen.queryByText('1')).not.toBeInTheDocument();

    await user.click(screen.getByText('2'));
    await user.click(screen.getByText('Three'));

    await delayBy(16);

    expect(control.value).toEqual('Three');
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.queryByText('Three')).not.toBeInTheDocument();
    expect(screen.queryByText('2')).not.toBeInTheDocument();
  });

  it('Closes menu', async () => {
    const control = new FormControl<string | null>(null);

    await renderComponent(MenuComponent, { inputs: { control, options } });

    const user = userEvent.setup();
    await user.click(screen.getByText('Select one'));

    await delayBy(16);

    expect(screen.getByText('One')).toBeInTheDocument();

    await user.click(screen.getByText('Select one'));

    await delayBy(16);

    expect(screen.getByText('Select one')).toBeInTheDocument();
    expect(screen.queryByText('One')).not.toBeInTheDocument();
  });
});
