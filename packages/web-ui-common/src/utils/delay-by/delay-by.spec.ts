import { describe, expect, it } from 'vitest';

import { delayBy } from './delay-by';

describe('delayBy()', () => {
  it('Should delay by given amount of time', async () => {
    const start = Date.now();

    await delayBy(100);

    const end = Date.now();

    expect(end - start).toBeGreaterThanOrEqual(100);
  });
});
