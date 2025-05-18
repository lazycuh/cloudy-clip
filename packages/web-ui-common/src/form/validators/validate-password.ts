import { AbstractControl } from '@angular/forms';

export function validatePassword(control: AbstractControl) {
  const enteredValue = (control.value ?? '') as string;
  const error = {} as Record<string, string>;

  if (!control.hasError('required') && enteredValue.length === 0) {
    return null;
  }

  if (enteredValue.length < 8 || enteredValue.length > 64) {
    error.length = $localize`Password must be between 8 and 64 characters`;
  }

  // eslint-disable-next-line vitest/no-conditional-tests
  if (!/\d/.test(enteredValue)) {
    error.number = $localize`Password must contain at least one number`;
  }

  if (enteredValue.toLocaleLowerCase() === enteredValue || enteredValue.toLocaleUpperCase() === enteredValue) {
    error.casing = $localize`Password must contain uppercase and lowercase letters`;
  }

  return Object.keys(error).length === 0 ? null : error;
}
