/**
 * @packageDocumentation
 * @module theme_channels
 * @description IPC channel names for theme mode actions (current, toggle, dark, light, system) in the Electron app.
 */

/**
 * IPC channel name for getting the current theme mode.
 *
 * @source
 */
export const THEME_MODE_CURRENT_CHANNEL = "theme-mode:current";

/**
 * IPC channel name for toggling the theme mode.
 *
 * @source
 */
export const THEME_MODE_TOGGLE_CHANNEL = "theme-mode:toggle";

/**
 * IPC channel name for setting dark mode.
 *
 * @source
 */
export const THEME_MODE_DARK_CHANNEL = "theme-mode:dark";

/**
 * IPC channel name for setting light mode.
 *
 * @source
 */
export const THEME_MODE_LIGHT_CHANNEL = "theme-mode:light";

/**
 * IPC channel name for setting system theme mode.
 *
 * @source
 */
export const THEME_MODE_SYSTEM_CHANNEL = "theme-mode:system";
