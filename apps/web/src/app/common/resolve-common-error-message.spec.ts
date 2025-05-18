/* eslint-disable max-len */
import { describe, expect, it } from 'vitest';

import { resolveCommonErrorMessage } from './resolve-common-error-message';

describe('resolveCommonErrorMessage()', () => {
  it('Returns correct message for error "email is not valid"', () => {
    expect(resolveCommonErrorMessage('email is not valid')).toBe('Email is not valid.');
  });

  it('Returns correct message for error "failed to verify jwt"', () => {
    expect(resolveCommonErrorMessage('failed to verify jwt')).toBe(
      'Your session has ended. Please go to <a href="/login">login page</a> to log in again.'
    );
  });

  it('Returns correct message for error "failed to verify turnstile token"', () => {
    expect(resolveCommonErrorMessage('failed to verify turnstile token')).toBe(
      'We were not able to verify that you are human. Please try refreshing your browser.'
    );
  });

  it('Returns correct message for error "jwt is missing or empty"', () => {
    expect(resolveCommonErrorMessage('jwt is missing or empty')).toBe(
      'Your session has ended. Please go to <a href="/login">login page</a> to log in again.'
    );
  });

  it('Returns correct message for error "user is blocked"', () => {
    expect(resolveCommonErrorMessage('user is blocked')).toBe(
      'Your account has been blocked. Please contact site admin for assistance.'
    );
  });

  it('Returns correct message for error "you have been blocked from making further requests"', () => {
    expect(resolveCommonErrorMessage('you have been blocked from making further requests')).toBe(
      'You have been blocked from making further requests.'
    );
  });

  it('Returns default message for unknown error', () => {
    expect(resolveCommonErrorMessage('unknown error')).toBe(
      'An unknown error has occurred while processing your request. Please try again later.<br/><br/>If you continue having issues, please contact us.'
    );
  });

  it('Returns default message for unhandled error message when default message is provided', () => {
    expect(resolveCommonErrorMessage('unknown error', 'Custom default message')).toBe('Custom default message');
  });
});
