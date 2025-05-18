import { FormControl } from '@angular/forms';
import { describe, expect, it } from 'vitest';

import { validatePasswordRepeat } from './validate-password-repeat';

describe('validatePasswordRepeat()', () => {
  it('Returns null if source control is null', () => {
    expect(validatePasswordRepeat(null)(new FormControl())).toBeNull();
  });

  it('Returns error if password repeat is empty while source control has non-empty value', () => {
    const sourceControl = new FormControl('Hi1');

    expect(validatePasswordRepeat(sourceControl)(new FormControl(''))).toEqual({
      passwordRepeatEmpty: 'Please re-enter your password'
    });
  });

  it('Returns error if passwords do not match', () => {
    const sourceControl = new FormControl('HelloWorld2024');

    expect(validatePasswordRepeat(sourceControl)(new FormControl('HelloWorld2024@@'))).toEqual({
      passwordRepeatNotMatching: 'Passwords do not match'
    });
  });

  it('Returns null if passwords match', () => {
    const sourceControl = new FormControl('HelloWorld2024');

    expect(validatePasswordRepeat(sourceControl)(new FormControl('HelloWorld2024'))).toBeNull();
  });
});
