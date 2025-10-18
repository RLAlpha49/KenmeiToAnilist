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
  const currentTheme = await globalThis.themeMode.current();
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
  // Delegate to the explicit mode methods for clarity and single-responsibility
  switch (newTheme) {
    case "dark":
      return enableDarkMode();
    case "light":
      return enableLightMode();
    case "system":
    default:
      return applySystemTheme();
  }
}

/**
 * Enable dark mode: update system, DOM, and persist preference.
 *
 * @returns True when dark mode is enabled.
 * @source
 */
export async function enableDarkMode(): Promise<boolean> {
  await globalThis.themeMode.dark();
  updateDocumentTheme("dark");
  storage.setItem(THEME_KEY, "dark");
  document.dispatchEvent(new CustomEvent("themeToggled"));
  return true;
}

/**
 * Enable light mode: update system, DOM, and persist preference.
 *
 * @returns False when dark mode is disabled.
 * @source
 */
export async function enableLightMode(): Promise<boolean> {
  await globalThis.themeMode.light();
  updateDocumentTheme("light");
  storage.setItem(THEME_KEY, "light");
  document.dispatchEvent(new CustomEvent("themeToggled"));
  return false;
}

/**
 * Apply the system theme: query system, update DOM, and persist preference.
 *
 * @returns True if the system theme is dark.
 * @source
 */
export async function applySystemTheme(): Promise<boolean> {
  const isDarkMode = await globalThis.themeMode.system();
  updateDocumentTheme(isDarkMode ? "dark" : "light");
  storage.setItem(THEME_KEY, "system");
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
  return setTheme(newTheme);
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
 * @param mode - The theme mode ("dark" or "light").
 * @source
 */
export function updateDocumentTheme(mode: "dark" | "light") {
  if (mode === "dark") {
    document.documentElement.classList.add("dark");
  } else {
    document.documentElement.classList.remove("dark");
  }
}
