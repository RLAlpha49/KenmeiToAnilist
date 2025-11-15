/**
 * @packageDocumentation
 * @module theme-channels
 * @description IPC channel names for theme mode actions (current, toggle, dark, light, system) in the Electron app.
 */

/** IPC channel for retrieving current theme mode. @source */
export const THEME_MODE_CURRENT_CHANNEL = "theme-mode:current";

/** IPC channel for toggling theme mode. @source */
export const THEME_MODE_TOGGLE_CHANNEL = "theme-mode:toggle";

/** IPC channel for setting dark theme mode. @source */
export const THEME_MODE_DARK_CHANNEL = "theme-mode:dark";

/** IPC channel for setting light theme mode. @source */
export const THEME_MODE_LIGHT_CHANNEL = "theme-mode:light";

/** IPC channel for setting system theme mode. @source */
export const THEME_MODE_SYSTEM_CHANNEL = "theme-mode:system";
