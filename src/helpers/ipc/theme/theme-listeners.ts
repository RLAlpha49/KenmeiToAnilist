/**
 * @packageDocumentation
 * @module theme_listeners
 * @description Registers IPC event listeners for theme mode actions (current, toggle, dark, light, system) in the Electron main process.
 */

import { nativeTheme, BrowserWindow } from "electron";
import { secureHandle } from "../listeners-register";
import {
  THEME_MODE_CURRENT_CHANNEL,
  THEME_MODE_DARK_CHANNEL,
  THEME_MODE_LIGHT_CHANNEL,
  THEME_MODE_SYSTEM_CHANNEL,
  THEME_MODE_TOGGLE_CHANNEL,
} from "./theme-channels";

/**
 * Registers IPC event listeners for theme mode actions (current, toggle, dark, light, system).
 *
 * @param mainWindow - The main application window for security validation
 * @source
 */
export function addThemeEventListeners(mainWindow: BrowserWindow) {
  secureHandle(
    THEME_MODE_CURRENT_CHANNEL,
    () => nativeTheme.themeSource,
    mainWindow,
  );

  secureHandle(
    THEME_MODE_TOGGLE_CHANNEL,
    () => {
      if (nativeTheme.shouldUseDarkColors) {
        nativeTheme.themeSource = "light";
      } else {
        nativeTheme.themeSource = "dark";
      }
      return nativeTheme.shouldUseDarkColors;
    },
    mainWindow,
  );

  secureHandle(
    THEME_MODE_DARK_CHANNEL,
    () => (nativeTheme.themeSource = "dark"),
    mainWindow,
  );

  secureHandle(
    THEME_MODE_LIGHT_CHANNEL,
    () => (nativeTheme.themeSource = "light"),
    mainWindow,
  );

  secureHandle(
    THEME_MODE_SYSTEM_CHANNEL,
    () => {
      nativeTheme.themeSource = "system";
      return nativeTheme.shouldUseDarkColors;
    },
    mainWindow,
  );
}
