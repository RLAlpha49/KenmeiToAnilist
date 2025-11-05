/**
 * Manual pause functionality for rate limiting.
 *
 * Allows pausing and resuming matching operations (e.g., during user adjustments).
 * Maintains a queue of waiters that are notified when pause is lifted.
 *
 * @packageDocumentation
 * @source
 */

/**
 * Current manual pause state for matching requests.
 * @source
 */
let _manualPauseActive = false;

/**
 * Queue of resolve functions waiting for pause to be lifted.
 * @source
 */
let _pauseWaiters: Array<() => void> = [];

/**
 * Check if manual pause is currently active.
 * @returns True if matching is manually paused.
 * @source
 */
export function isManualPauseActive(): boolean {
  return _manualPauseActive;
}

/**
 * Resolve all pending pause waiters and clear the queue.
 * @source
 */
function resolvePauseWaiters(): void {
  // Capture current waiters before clearing to avoid issues if new waiters are added during resolution
  const currentWaiters = _pauseWaiters;
  _pauseWaiters = [];
  for (const resolve of currentWaiters) {
    resolve();
  }
}

/**
 * Wait until manual pause is lifted. Returns immediately if not paused.
 * @returns Promise that resolves when pause is lifted or immediately if not paused.
 * @source
 */
export async function waitWhileManuallyPaused(): Promise<void> {
  while (_manualPauseActive) {
    await new Promise<void>((resolve) => _pauseWaiters.push(resolve));
  }
}

/**
 * Set manual matching pause state and notify waiters when resuming.
 * Dispatches a custom event for UI synchronization.
 * @param paused - Whether to pause (true) or resume (false) matching.
 * @source
 */
export function setManualMatchingPause(paused: boolean): void {
  if (paused) {
    _manualPauseActive = true;
  } else if (_manualPauseActive) {
    _manualPauseActive = false;
    resolvePauseWaiters();
  }

  try {
    globalThis.dispatchEvent?.(
      new CustomEvent("matching:manual-pause", {
        detail: { paused },
      }),
    );
  } catch (error) {
    console.error(
      "[MangaSearchService] Error dispatching manual pause event:",
      error,
    );
  }
}

/**
 * Check if manual matching is paused (alias for isManualPauseActive).
 * @returns True if matching is manually paused.
 * @source
 */
export function isManualMatchingPaused(): boolean {
  return _manualPauseActive;
}
