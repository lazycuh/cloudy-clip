import { describe, expect, it } from 'vitest';

import { delayBy } from '../delay-by';

import { scrollToTop } from './scroller';

describe('scrollToTop()', () => {
  it('Should scroll to the top of the page', async () => {
    Object.defineProperty(document.body, 'scrollTop', {
      value: 100,
      writable: true
    });

    expect(document.body.scrollTop).toEqual(100);

    scrollToTop();

    await delayBy(1100);

    expect(document.body.scrollTop).toEqual(0);
  });
});
