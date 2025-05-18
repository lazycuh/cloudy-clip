import { FormControl } from '@angular/forms';
import { screen } from '@testing-library/angular';
import { describe, expect, it } from 'vitest';

import { renderComponent } from 'test/utils';

import { delayBy } from '../../utils/delay-by';

import { ErrorIndicatorComponent } from './error-indicator.component';

describe(ErrorIndicatorComponent.name, () => {
  async function render(errors: Record<string, unknown> | null = null, label?: string) {
    const control = new FormControl('');
    control.setErrors(errors);

    const inputs: Record<string, unknown> = {
      control
    };

    if (label) {
      inputs.label = label;
    }

    const renderResult = await renderComponent(ErrorIndicatorComponent, {
      inputs
    });

    control.markAsTouched();
    control.markAsDirty();

    await delayBy(32);

    return renderResult;
  }

  it('Should always show "required" error first', async () => {
    await render({
      custom: true,
      email: true,
      max: true,
      maxlength: true,
      min: true,
      minlength: true,
      required: true
    });

    expect(screen.getByText('This field is required')).toBeInTheDocument();
  });

  it('Renders correctly for "email" error', async () => {
    await render(
      {
        email: true
      },
      'Email'
    );

    expect(screen.getByText('Email is not valid')).toBeInTheDocument();
  });

  it('Renders correctly for "min" error', async () => {
    await render(
      {
        min: {
          min: 10
        }
      },
      'Age'
    );

    expect(screen.getByText('Age must be greater than or equal to 10')).toBeInTheDocument();
  });

  it('Renders correctly for "minlength" error', async () => {
    await render(
      {
        minlength: {
          requiredLength: 10
        }
      },
      'Display name'
    );

    expect(screen.getByText('Display name must contain at least 10 characters')).toBeInTheDocument();
  });

  it('Renders correctly for "max" error', async () => {
    await render(
      {
        max: {
          max: 100
        }
      },
      'Age'
    );

    expect(screen.getByText('Age must be less than or equal to 100')).toBeInTheDocument();
  });

  it('Renders correctly for "maxlength" error', async () => {
    await render(
      {
        maxlength: {
          requiredLength: 100
        }
      },
      'Display name'
    );

    expect(screen.getByText('Display name must contain at most 100 characters')).toBeInTheDocument();
  });

  it('Render message associated with custom error', async () => {
    await render(
      {
        passwordsDoNotMath: 'Passwords do not match'
      },
      'Confirm password'
    );

    expect(screen.getByText('Passwords do not match')).toBeInTheDocument();
  });
});
