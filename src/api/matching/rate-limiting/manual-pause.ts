/**
 * Manual pause functionality for rate limiting.
 *
 * Provides mechanisms to pause matching operations (e.g., during user adjustments)
 * and resume them on demand. Maintains a list of waiters to notify when pause is lifted.
 *
 * @packageDocumentation
 * @source
 */

/**
 * Manual pause state for matching requests.
 * @source
 */
let _manualPauseActive = false;

/**
 * Array of resolve functions waiting for pause to be lifted.
 * @source
 */
let _pauseWaiters: Array<() => void> = [];

/**
 * Check if manual pause is active.
 * @returns True if manual pause is active.
 * @source
 */
export function isManualPauseActive(): boolean {
  return _manualPauseActive;
}

/**
 * Resolve all pause waiters and clear the waiting list.
 * @source
 */
function resolvePauseWaiters(): void {
  const currentWaiters = _pauseWaiters;
  _pauseWaiters = [];
  for (const resolve of currentWaiters) {
    resolve();
  }
}

/**
 * Wait while manual pause is active. Returns immediately if pause is not active.
 * @returns Promise that resolves when pause is lifted.
 * @source
 */
export async function waitWhileManuallyPaused(): Promise<void> {
  while (_manualPauseActive) {
    await new Promise<void>((resolve) => _pauseWaiters.push(resolve));
  }
}

/**
 * Set manual matching pause state and notify all waiters if resuming.
 * Dispatches a custom event for UI updates.
 * @param paused - Whether to pause or resume matching.
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
 * @returns True if manual matching is paused.
 * @source
 */
export function isManualMatchingPaused(): boolean {
  return _manualPauseActive;
}
