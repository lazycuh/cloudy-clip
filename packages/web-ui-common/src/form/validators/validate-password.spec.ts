import { FormControl } from '@angular/forms';
import { describe, expect, it } from 'vitest';

import { validatePassword } from './validate-password';

describe('validatePassword()', () => {
  it('should return null if control is not required and value is empty', () => {
    const control = new FormControl('');
    const result = validatePassword(control);

    expect(result).toBeNull();
  });

  it('should return error if password length is less than 8 characters', () => {
    const control = new FormControl('Hi1');
    const result = validatePassword(control);

    expect(result).toEqual({ length: 'Password must be between 8 and 64 characters' });
  });

  it('should return error if password length is more than 64 characters', () => {
    const control = new FormControl('Hi1'.repeat(64));
    const result = validatePassword(control);

    expect(result).toEqual({ length: 'Password must be between 8 and 64 characters' });
  });

  it('should return error if password does not contain a number', () => {
    const control = new FormControl('HelloWorld');
    const result = validatePassword(control);

    expect(result).toEqual({ number: 'Password must contain at least one number' });
  });

  it('should return error if password does not contain uppercase and lowercase letters', () => {
    const control = new FormControl('helloworld2024');
    const result = validatePassword(control);

    expect(result).toEqual({ casing: 'Password must contain uppercase and lowercase letters' });
  });
});
