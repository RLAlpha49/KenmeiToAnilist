/**
 * @packageDocumentation
 * @module window_helpers
 * @description Helper functions for controlling the Electron window (minimize, maximize, close).
 */

/**
 * Minimizes the current Electron globalThis.
 *
 * @returns A promise that resolves when the window is minimized.
 * @source
 */
export async function minimizeWindow() {
  await globalThis.electronWindow.minimize();
}

/**
 * Maximizes the current Electron globalThis.
 *
 * @returns A promise that resolves when the window is maximized.
 * @source
 */
export async function maximizeWindow() {
  await globalThis.electronWindow.maximize();
}

/**
 * Closes the current Electron globalThis.
 *
 * @returns A promise that resolves when the window is closed.
 * @source
 */
export async function closeWindow() {
  await globalThis.electronWindow.close();
}
