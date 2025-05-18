import { describe, expect, it, vi } from 'vitest';

import { MissingValueError } from './missing-value.error';
import { Optional } from './optional';

describe('Optional', () => {
  it('Optional.empty() should return an empty optional', () => {
    expect(() => Optional.empty().orElseThrow()).toThrow(new MissingValueError());
    expect(() => Optional.empty().orElseThrow(() => new Error('expected'))).toThrow(new Error('expected'));
  });

  it('Optional.of() should return an optional that resolves to the provided value', () => {
    expect(Optional.of(1).orElseThrow()).toEqual(1);
  });

  it('#map() should return the mapped value when optional value is present', () => {
    const mapper = vi.fn().mockImplementation((number: number) => number + 1);

    expect(Optional.of(1).map(mapper).orElseThrow()).toEqual(2);
    expect(mapper).toHaveBeenCalledOnce();
    expect(mapper).toHaveBeenCalledWith(1);
  });

  it('#map() should not run when the optional is empty', () => {
    const mapper = vi.fn();

    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    expect(() => Optional.empty<number>().map(mapper).orElseThrow()).toThrow(new MissingValueError());
    expect(mapper).not.toHaveBeenCalled();
  });

  it('#ifPresent() should not run when the optional is empty', () => {
    const ifPresentFn = vi.fn();

    Optional.empty().ifPresent(ifPresentFn);

    expect(ifPresentFn).not.toHaveBeenCalled();
  });

  it('#ifPresent() should be called with the value in the optional', () => {
    const ifPresentFn = vi.fn();

    Optional.of(1).ifPresent(ifPresentFn);

    expect(ifPresentFn).toHaveBeenCalledOnce();
    expect(ifPresentFn).toHaveBeenCalledWith(1);
  });

  it('#isPresent() should return false for an empty optional, true otherwise', () => {
    expect(Optional.empty().isPresent()).toEqual(false);
    expect(Optional.of(1).isPresent()).toEqual(true);
  });

  it('#isEmpty() should return true for an empty optional, false otherwise', () => {
    expect(Optional.empty().isEmpty()).toEqual(true);
    expect(Optional.of(1).isEmpty()).toEqual(false);
  });

  it('#orElse() should return the value if it is not empty', () => {
    expect(Optional.of(1).orElse(10)).toEqual(1);
  });

  it('#orElse() should return the default value if it is empty', () => {
    expect(Optional.of<number>(null).orElse(10)).toEqual(10);
  });
});
