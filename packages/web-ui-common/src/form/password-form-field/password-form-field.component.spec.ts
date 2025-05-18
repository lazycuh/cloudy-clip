import { ChangeDetectionStrategy, Component } from '@angular/core';
import { FormControl } from '@angular/forms';
import { screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { renderComponent } from 'test/utils';

import { validatePassword } from '../validators';

import { PasswordFormFieldComponent } from './password-form-field.component';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PasswordFormFieldComponent],
  selector: 'lc-test-bed',
  template: `
    <lc-password-form-field
      autocomplete="one-time-code"
      label="New password"
      [control]="control"
      [showPasswordRules]="true" />
  `
})
class TestBedComponent {
  control = new FormControl('', validatePassword);
}

describe(PasswordFormFieldComponent.name, () => {
  it('Show password rules', async () => {
    const renderResult = await renderComponent(TestBedComponent);

    expect(screen.getByText('New password')).toBeInTheDocument();

    expect(renderResult.container.querySelector('.password-form-field__rule-list')?.children).toHaveLength(3);

    expect(screen.getByText('Must be between 8 and 64 characters')).toBeInTheDocument();
    expect(screen.getByText('Must contain at least one number')).toBeInTheDocument();
    expect(screen.getByText('Must contain lowercase and uppercase letters')).toBeInTheDocument();
  });

  it('Do not show password rules', async () => {
    @Component({
      changeDetection: ChangeDetectionStrategy.OnPush,
      imports: [PasswordFormFieldComponent],
      selector: 'lc-test-bed',
      template: `
        <lc-password-form-field
          autocomplete="one-time-code"
          label="New password"
          [control]="control"
          [showPasswordRules]="false" />
      `
    })
    // eslint-disable-next-line @angular-eslint/component-class-suffix
    class TestBedComponent2 {
      control = new FormControl('', validatePassword);
    }

    await renderComponent(TestBedComponent2);
    expect(screen.getByText('New password')).toBeInTheDocument();
    expect(screen.queryByText('Must be between 8 and 64 characters')).not.toBeInTheDocument();
    expect(screen.queryByText('Must contain at least one number')).not.toBeInTheDocument();
    expect(screen.queryByText('Must contain lowercase and uppercase letters')).not.toBeInTheDocument();
  });

  it('Highlight violated rules', async () => {
    const renderResult = await renderComponent(TestBedComponent);

    const user = userEvent.setup();

    const passwordField = screen.getByLabelText('New password');

    await user.type(passwordField, 'Hi');
    await user.tab();

    const firstRule = renderResult.container.querySelector('.password-form-field__rule-list li:nth-child(1)');
    const secondRule = renderResult.container.querySelector('.password-form-field__rule-list li:nth-child(2)');
    const thirdRule = renderResult.container.querySelector('.password-form-field__rule-list li:nth-child(3)');

    expect(firstRule).toHaveClass('has-error');
    expect(secondRule).toHaveClass('has-error');
    expect(thirdRule).not.toHaveClass('has-error');

    await user.clear(passwordField);
    await user.type(passwordField, 'helloworld2024');
    await user.tab();

    expect(firstRule).not.toHaveClass('has-error');
    expect(secondRule).not.toHaveClass('has-error');
    expect(thirdRule).toHaveClass('has-error');

    await user.clear(passwordField);
    await user.type(passwordField, 'Helloworld2024');
    await user.tab();

    expect(firstRule).not.toHaveClass('has-error');
    expect(secondRule).not.toHaveClass('has-error');
    expect(thirdRule).not.toHaveClass('has-error');
  });

  it('Toggle password value visibility', async () => {
    const renderResult = await renderComponent(TestBedComponent);
    const user = userEvent.setup();
    const passwordField = screen.getByLabelText('New password');
    const passwordVisibilityToggle = renderResult.container.querySelector('.form-field__toggle-visibility')!;
    const inputElement = renderResult.container.querySelector('input')!;

    await user.type(passwordField, 'HelloWorld2024');
    await user.tab();

    expect(inputElement).toHaveAttribute('type', 'password');
    expect(passwordVisibilityToggle).toHaveAttribute('aria-label', 'Make password visible');

    await user.click(passwordVisibilityToggle);

    expect(inputElement).toHaveAttribute('type', 'text');
    expect(passwordVisibilityToggle).toHaveAttribute('aria-label', 'Hide password');
  });
});
