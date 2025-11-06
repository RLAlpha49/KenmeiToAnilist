/**
 * @packageDocumentation
 * @module utils/debounce
 * @description Debounce and throttle utilities for controlling function invocation rate.
 */

/**
 * Debounced function with a cancel method to clear pending invocations.
 * @source
 */
interface DebouncedFunction<T extends (...args: unknown[]) => unknown> {
  (...args: Parameters<T>): void;
  cancel(): void;
}

/**
 * Creates a debounced function that delays invocation until after wait milliseconds have elapsed since the last call.
 * @template T - The function type to debounce.
 * @param func - The function to debounce.
 * @param wait - Milliseconds to delay invocation.
 * @returns Debounced function with cancel method.
 * @source
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  func: T,
  wait: number,
): DebouncedFunction<T> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  function debounced(...args: Parameters<T>): void {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }

    timeoutId = setTimeout(() => {
      func(...args);
      timeoutId = null;
    }, wait);
  }

  debounced.cancel = (): void => {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  };

  return debounced;
}

/**
 * Creates a throttled function that invokes func at most once per wait milliseconds.
 * @template T - The function type to throttle.
 * @param func - The function to throttle.
 * @param wait - Milliseconds to throttle invocations to.
 * @returns Throttled function with optional cancel method.
 * @source
 */
export function throttle<T extends (...args: unknown[]) => unknown>(
  func: T,
  wait: number,
): DebouncedFunction<T> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let lastArgs: Parameters<T> | null = null;

  function throttled(...args: Parameters<T>): void {
    lastArgs = args;

    if (timeoutId === null) {
      func(...args);
      timeoutId = setTimeout(() => {
        if (lastArgs !== null) {
          func(...lastArgs);
        }
        timeoutId = null;
        lastArgs = null;
      }, wait);
    }
  }

  throttled.cancel = (): void => {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
      timeoutId = null;
      lastArgs = null;
    }
  };

  return throttled;
}

/**
 * Creates a debounced function that immediately invokes on the leading edge and delays subsequent calls.
 * Useful for operations that should happen immediately but also batch follow-up calls.
 * @template T - The function type to debounce.
 * @param func - The function to debounce.
 * @param wait - Milliseconds to delay subsequent invocations.
 * @returns Debounced function with immediate leading call.
 * @source
 */
export function debounceImmediate<T extends (...args: unknown[]) => unknown>(
  func: T,
  wait: number,
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let isFirstCall = true;

  return function debouncedImmediate(...args: Parameters<T>): void {
    if (isFirstCall) {
      func(...args);
      isFirstCall = false;
    }

    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }

    timeoutId = setTimeout(() => {
      func(...args);
      timeoutId = null;
      isFirstCall = true;
    }, wait);
  };
}
