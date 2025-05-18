import { AbstractControl } from '@angular/forms';

export function validatePasswordRepeat(sourceControl: AbstractControl | null) {
  return (control: AbstractControl) => {
    if (!sourceControl) {
      return null;
    }

    if (
      typeof control.value === 'string' &&
      control.value.length === 0 &&
      typeof sourceControl.value === 'string' &&
      sourceControl.value.length > 0
    ) {
      return {
        passwordRepeatEmpty: $localize`Please re-enter your password`
      };
    }

    if (sourceControl.value !== control.value) {
      return {
        passwordRepeatNotMatching: $localize`Passwords do not match`
      };
    }

    return null;
  };
}
