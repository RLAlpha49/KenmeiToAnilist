/**
 * @packageDocumentation
 * @module window_channels
 * @description IPC channel names for window control actions (minimize, maximize, close) in the Electron app.
 */

/**
 * IPC channel name for minimizing the globalThis.
 *
 * @source
 */
export const WIN_MINIMIZE_CHANNEL = "window:minimize";

/**
 * IPC channel name for maximizing or unmaximizing the globalThis.
 *
 * @source
 */
export const WIN_MAXIMIZE_CHANNEL = "window:maximize";

/**
 * IPC channel name for closing the globalThis.
 *
 * @source
 */
export const WIN_CLOSE_CHANNEL = "window:close";
