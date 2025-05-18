/**
 * Interpolate the range [0, 1] using the provided duration, in other words,
 * this function will produce however many values necessary to interpolate
 * between 0 and 1 within the given duration.
 *
 * @param durationInMs Duration in milliseconds.
 * @param consumer The function that is called for every new interpolated value.
 *
 * @returns A function that can be called to cancel the interpolation.
 */
/* istanbul ignore next -- @preserve */
export function interpolate(durationInMs: number, consumer: (t: number) => void) {
  let start: DOMHighResTimeStamp | undefined;
  let animationFrameHandle: number;
  let isRunning = true;

  function step(timestamp: DOMHighResTimeStamp) {
    if (start === undefined) {
      start = timestamp;
      animationFrameHandle = window.requestAnimationFrame(step);
    } else if (isRunning) {
      const t = Math.min(1, (timestamp - start) / durationInMs);

      consumer(t);

      if (t < 1) {
        animationFrameHandle = window.requestAnimationFrame(step);
      } else {
        window.cancelAnimationFrame(animationFrameHandle);
      }
    } else {
      window.cancelAnimationFrame(animationFrameHandle);
    }
  }

  animationFrameHandle = window.requestAnimationFrame(step);

  return () => {
    start = undefined;
    isRunning = false;
  };
}
