/**
 * @packageDocumentation
 * @module window_channels
 * @description IPC channels for window control operations (minimize, maximize, close) in Electron.
 */

/** IPC channel for minimizing the main window. @source */
export const WIN_MINIMIZE_CHANNEL = "window:minimize";

/** IPC channel for toggling maximize state of the main window. @source */
export const WIN_MAXIMIZE_CHANNEL = "window:maximize";

/** IPC channel for closing the main window. @source */
export const WIN_CLOSE_CHANNEL = "window:close";
