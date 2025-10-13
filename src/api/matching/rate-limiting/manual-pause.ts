/**
 * Manual pause functionality for rate limiting
 * @module rate-limiting/manual-pause
 */

/**
 * Manual pause state for matching requests
 */
let _manualPauseActive = false;

/**
 * Array of resolve functions waiting for pause to be lifted
 */
let _pauseWaiters: Array<() => void> = [];

/**
 * Check if manual pause is active
 * @returns True if manual pause is active
 */
export function isManualPauseActive(): boolean {
  return _manualPauseActive;
}

/**
 * Resolve all pause waiters
 */
function resolvePauseWaiters(): void {
  const currentWaiters = _pauseWaiters;
  _pauseWaiters = [];
  for (const resolve of currentWaiters) {
    resolve();
  }
}

/**
 * Wait while manual pause is active
 * @returns Promise that resolves when pause is lifted
 */
export async function waitWhileManuallyPaused(): Promise<void> {
  while (_manualPauseActive) {
    await new Promise<void>((resolve) => _pauseWaiters.push(resolve));
  }
}

/**
 * Set manual matching pause state
 * @param paused - Whether to pause or resume matching
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
 * Check if manual matching is paused (alias for isManualPauseActive)
 * @returns True if manual matching is paused
 */
export function isManualMatchingPaused(): boolean {
  return _manualPauseActive;
}
