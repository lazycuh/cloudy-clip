import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Debounced } from './debounced';

describe('@Debounced()', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('Should debounce method calls', () => {
    const spy = vi.fn();

    class Test {
      @Debounced(100)
      public testMethod() {
        spy();
      }
    }

    const test = new Test();

    test.testMethod();
    test.testMethod();
    test.testMethod();

    expect(spy).not.toHaveBeenCalled();

    vi.advanceTimersByTime(100);

    expect(spy).toHaveBeenCalledOnce();
  });

  it('Uses 250ms by default', () => {
    const spy = vi.fn();

    class Test {
      @Debounced()
      public testMethod() {
        spy();
      }
    }

    const test = new Test();

    test.testMethod();
    test.testMethod();
    test.testMethod();

    expect(spy).not.toHaveBeenCalled();

    vi.advanceTimersByTime(250);

    expect(spy).toHaveBeenCalledOnce();
  });
});
