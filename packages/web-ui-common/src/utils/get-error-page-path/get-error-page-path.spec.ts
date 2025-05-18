import { describe, expect, it } from 'vitest';

import { getErrorPagePath } from './get-error-page-path';

describe('getErrorPagePath()', () => {
  it('Should return correct path', () => {
    expect(getErrorPagePath('unknown')).toEqual('/errors/unknown');
    expect(getErrorPagePath('not-found')).toEqual('/errors/not-found');
  });
});
