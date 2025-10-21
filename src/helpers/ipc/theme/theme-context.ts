/**
 * @packageDocumentation
 * @module theme_context
 * @description Exposes the Electron theme mode context bridge (current, toggle, dark, light, system) to the renderer process.
 */

import { contextBridge, ipcRenderer } from "electron";
import {
  THEME_MODE_CURRENT_CHANNEL,
  THEME_MODE_DARK_CHANNEL,
  THEME_MODE_LIGHT_CHANNEL,
  THEME_MODE_SYSTEM_CHANNEL,
  THEME_MODE_TOGGLE_CHANNEL,
} from "./theme-channels";

/**
 * Exposes the Electron theme mode context bridge to the renderer process.
 *
 * @source
 */
export function exposeThemeContext() {
  try {
    if (!contextBridge || !ipcRenderer) {
      throw new Error(
        "Failed to load electron modules: contextBridge or ipcRenderer is undefined",
      );
    }

    contextBridge.exposeInMainWorld("themeMode", {
      current: () => ipcRenderer.invoke(THEME_MODE_CURRENT_CHANNEL),
      toggle: () => ipcRenderer.invoke(THEME_MODE_TOGGLE_CHANNEL),
      dark: () => ipcRenderer.invoke(THEME_MODE_DARK_CHANNEL),
      light: () => ipcRenderer.invoke(THEME_MODE_LIGHT_CHANNEL),
      system: () => ipcRenderer.invoke(THEME_MODE_SYSTEM_CHANNEL),
    });

    console.log("[ThemeContext] ✅ Theme context exposed in main world");
  } catch (error) {
    console.error("[ThemeContext] ❌ Error exposing theme context:", error);
  }
}
