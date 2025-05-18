import { describe, expect, it } from 'vitest';

import { AbstractStateStore } from './abstract-state-store';

describe(AbstractStateStore.name, () => {
  class TestStateStore extends AbstractStateStore<{ message: string }> {
    override getInitialState(): { message: string } {
      return {
        message: 'hello'
      };
    }
  }

  it('Can update state', () => {
    const store = new TestStateStore();
    store.update({ message: 'world' });

    expect(store.valueOf('message')).toEqual('world');
  });
});
