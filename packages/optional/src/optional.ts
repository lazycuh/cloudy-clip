import { MissingValueError } from './missing-value.error';

/**
 * Inspired by Java's
 * {@link https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/util/Optional.html Optional} class.
 *
 */
export class Optional<T> {
  private constructor(private readonly _value: T | null | undefined) {}

  static of<T2>(value: T2 | null | undefined) {
    return new Optional(value);
  }

  static empty<T2>() {
    return Optional.of<T2>(null);
  }

  map<T2>(mapper: (value: NonNullable<T>) => T2): Optional<NonNullable<T2>> {
    if (this.isPresent()) {
      return Optional.of(mapper(this._value as NonNullable<T>) as NonNullable<T2>);
    }

    return Optional.empty();
  }

  filter(predicate: (value: NonNullable<T>) => boolean): Optional<NonNullable<T>> {
    if (!this.isPresent() || !predicate(this._value!)) {
      return Optional.empty();
    }

    return Optional.of(this._value as NonNullable<T>);
  }

  isPresent() {
    return this._value !== null && this._value !== undefined;
  }

  isEmpty() {
    return !this.isPresent();
  }

  ifPresent(consumer: (value: NonNullable<T>) => void) {
    if (this.isPresent()) {
      consumer(this._value as NonNullable<T>);
    }
  }

  orElseThrow(exceptionGenerator?: () => Error) {
    if (this.isPresent()) {
      return this._value as T;
    }

    if (!exceptionGenerator) {
      throw new MissingValueError();
    }

    throw exceptionGenerator();
  }

  orElse(defaultValue: undefined): T | undefined;
  orElse(defaultValue: null): T | null;
  orElse(defaultValue: T): T;
  orElse(defaultValue?: T | null) {
    if (this.isPresent()) {
      return this._value as T;
    }

    return defaultValue;
  }
}
