export function Debounced(debounceTimeMs = 250) {
  return (
    __target__: object,
    __propertyKey__: string | symbol,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    descriptor: TypedPropertyDescriptor<(...args: any[]) => void>
  ) => {
    const original = descriptor.value!;

    let timeoutId = -1;

    descriptor.value = function interceptor(...args: unknown[]) {
      clearTimeout(timeoutId);

      timeoutId = window.setTimeout(() => {
        original.apply(this, args);
      }, debounceTimeMs);
    };

    return descriptor;
  };
}
