/**
 * @packageDocumentation
 * @module window_helpers
 * @description Helper functions for controlling the Electron window (minimize, maximize, close).
 */

/**
 * Minimizes the current Electron window.
 *
 * @returns A promise that resolves when the window is minimized.
 * @source
 */
export async function minimizeWindow() {
  await window.electronWindow.minimize();
}

/**
 * Maximizes the current Electron window.
 *
 * @returns A promise that resolves when the window is maximized.
 * @source
 */
export async function maximizeWindow() {
  await window.electronWindow.maximize();
}

/**
 * Closes the current Electron window.
 *
 * @returns A promise that resolves when the window is closed.
 * @source
 */
export async function closeWindow() {
  await window.electronWindow.close();
}
