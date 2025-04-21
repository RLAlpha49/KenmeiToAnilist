/**
 * @packageDocumentation
 * @module theme_helpers
 * @description Helper functions and types for managing application theme (dark, light, system) and syncing with local storage and the DOM.
 */

import { ThemeMode } from "@/types/theme-mode";
import { storage } from "../utils/storage";

/**
 * The key used for storing the theme preference in local storage.
 *
 * @internal
 * @source
 */
export const THEME_KEY = "theme";

/**
 * Represents the user's theme preferences.
 *
 * @property system - The current system theme mode.
 * @property local - The locally stored theme mode, or null if not set.
 * @source
 */
export interface ThemePreferences {
  system: ThemeMode;
  local: ThemeMode | null;
}

/**
 * Gets the current theme preferences from the system and local storage.
 *
 * @returns An object containing the system and local theme preferences.
 * @source
 */
export async function getCurrentTheme(): Promise<ThemePreferences> {
  const currentTheme = await window.themeMode.current();
  const localTheme = storage.getItem(THEME_KEY) as ThemeMode | null;

  return {
    system: currentTheme,
    local: localTheme,
  };
}

/**
 * Sets the application theme to the specified mode and updates the DOM and local storage.
 *
 * @param newTheme - The new theme mode to set ("dark", "light", or "system").
 * @returns A promise that resolves to true if dark mode is enabled, false otherwise.
 * @remarks
 * Also dispatches a "themeToggled" event on the document.
 * @source
 */
export async function setTheme(newTheme: ThemeMode) {
  let isDarkMode = false;

  switch (newTheme) {
    case "dark":
      await window.themeMode.dark();
      isDarkMode = true;
      break;
    case "light":
      await window.themeMode.light();
      isDarkMode = false;
      break;
    case "system": {
      isDarkMode = await window.themeMode.system();
      break;
    }
  }

  updateDocumentTheme(isDarkMode);
  storage.setItem(THEME_KEY, newTheme);

  // Notify any listeners that theme has changed
  document.dispatchEvent(new CustomEvent("themeToggled"));

  return isDarkMode;
}

/**
 * Toggles the application theme between dark and light modes.
 *
 * @returns A promise that resolves to true if dark mode is enabled, false otherwise.
 * @source
 */
export async function toggleTheme() {
  const { local } = await getCurrentTheme();
  // If current theme is dark or not set, switch to light, otherwise switch to dark
  const newTheme = local === "dark" ? "light" : "dark";

  const isDarkMode = await setTheme(newTheme);
  return isDarkMode;
}

/**
 * Syncs the application theme with the locally stored preference or system preference.
 *
 * @returns A promise that resolves when the theme has been synced.
 * @throws If syncing fails, falls back to light theme and logs the error.
 * @source
 */
export async function syncThemeWithLocal() {
  try {
    const { local, system } = await getCurrentTheme();

    // If we have a stored preference, use it
    if (local) {
      await setTheme(local);
      return;
    }

    // Otherwise set system as default and save it to local storage
    // This ensures we have a saved preference for next time
    await setTheme(system || "light");
  } catch (error) {
    console.error("Failed to sync theme:", error);
    // Fallback to light theme if there's an error
    await setTheme("light");
  }
}

/**
 * Updates the document's class list to reflect the current theme mode.
 *
 * @param isDarkMode - Whether dark mode should be enabled.
 * @source
 */
export function updateDocumentTheme(isDarkMode: boolean) {
  if (!isDarkMode) {
    document.documentElement.classList.remove("dark");
  } else {
    document.documentElement.classList.add("dark");
  }
}
