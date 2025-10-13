/**
 * @packageDocumentation
 * @module utils/debounce
 * @description Utility functions for debouncing and throttling function calls
 */

/**
 * Creates a debounced version of a function that delays invoking func until after
 * wait milliseconds have elapsed since the last time the debounced function was invoked.
 *
 * @template T - The function type to debounce
 * @param func - The function to debounce
 * @param wait - The number of milliseconds to delay
 * @returns The debounced function
 *
 * @example
 * ```typescript
 * const debouncedSave = debounce(() => {
 *   saveToStorage();
 * }, 1000);
 *
 * // Will only call saveToStorage once after 1 second of inactivity
 * debouncedSave();
 * debouncedSave();
 * debouncedSave();
 * ```
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  func: T,
  wait: number,
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  return function debounced(...args: Parameters<T>): void {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }

    timeoutId = setTimeout(() => {
      func(...args);
      timeoutId = null;
    }, wait);
  };
}

/**
 * Creates a throttled version of a function that only invokes func at most once per
 * every wait milliseconds.
 *
 * @template T - The function type to throttle
 * @param func - The function to throttle
 * @param wait - The number of milliseconds to throttle invocations to
 * @returns The throttled function
 *
 * @example
 * ```typescript
 * const throttledUpdate = throttle(() => {
 *   updateUI();
 * }, 100);
 *
 * // Will call updateUI at most once every 100ms
 * throttledUpdate();
 * throttledUpdate();
 * throttledUpdate();
 * ```
 */
export function throttle<T extends (...args: unknown[]) => unknown>(
  func: T,
  wait: number,
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let lastArgs: Parameters<T> | null = null;

  return function throttled(...args: Parameters<T>): void {
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
  };
}

/**
 * Creates a debounced function that also flushes immediately on the leading edge.
 * Useful for operations that should happen immediately but also batch subsequent calls.
 *
 * @template T - The function type to debounce
 * @param func - The function to debounce
 * @param wait - The number of milliseconds to delay
 * @returns The debounced function with immediate first call
 *
 * @example
 * ```typescript
 * const debouncedSave = debounceImmediate(() => {
 *   saveToStorage();
 * }, 1000);
 *
 * // First call executes immediately, subsequent calls are debounced
 * debouncedSave(); // Executes immediately
 * debouncedSave(); // Debounced
 * debouncedSave(); // Debounced
 * ```
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
