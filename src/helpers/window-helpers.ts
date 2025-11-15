/**
 * @packageDocumentation
 * @module window-helpers
 * @description Helper functions for controlling the Electron window (minimize, maximize, close).
 */

/**
 * Minimizes the main Electron window.
 * @returns Promise resolving when window is minimized.
 * @source
 */
export async function minimizeWindow() {
  await globalThis.electronWindow.minimize();
}

/**
 * Maximizes the main Electron window.
 * @returns Promise resolving when window is maximized.
 * @source
 */
export async function maximizeWindow() {
  await globalThis.electronWindow.maximize();
}

/**
 * Closes the main Electron window.
 * @returns Promise resolving when window is closed.
 * @source
 */
export async function closeWindow() {
  await globalThis.electronWindow.close();
}
