/* eslint-disable max-len */
import { describe, expect, it } from 'vitest';

import { getSupportEmailLink } from './get-support-email-link';

describe('getSupportEmailLink()', () => {
  it('Should return correct link', () => {
    expect(getSupportEmailLink('Hello', 'World')).toEqual(
      'mailto:heretohelp@cloudyclip.com?subject=%5BTrade%20Timeline%5D%20Hello&body=World'
    );
  });

  it('Should not include body in the returned link when no body is provided', () => {
    expect(getSupportEmailLink('Hello World')).toEqual(
      'mailto:heretohelp@cloudyclip.com?subject=%5BTrade%20Timeline%5D%20Hello%20World'
    );
  });

  it('Should replace all new line characters with %0A in the body', () => {
    expect(getSupportEmailLink('Hello World', 'Section 1:\nSection 2:\n')).toEqual(
      'mailto:heretohelp@cloudyclip.com?subject=%5BTrade%20Timeline%5D%20Hello%20World&body=Section%201:%0ASection%202:%0A'
    );
  });
});
