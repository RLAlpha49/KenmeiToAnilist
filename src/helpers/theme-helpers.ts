/**
 * @packageDocumentation
 * @module theme-helpers
 * @description Helper functions and types for managing application theme (dark, light, system) and syncing with local storage and the DOM.
 */

import { ThemeMode } from "@/types/theme-mode";
import { storage } from "../utils/storage";

/** Local storage key for theme preference. @source */
export const THEME_KEY = "theme";

/**
 * User's theme preferences combining system and local settings.
 * @property system - Current system theme mode.
 * @property local - Locally stored preference, or null if not set.
 * @source
 */
export interface ThemePreferences {
  system: ThemeMode;
  local: ThemeMode | null;
}

/**
 * Gets current theme preferences from system and local storage.
 * @returns Object with system theme mode and locally stored preference.
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
 * Sets application theme mode and updates DOM and storage.
 * @param newTheme - The theme mode to set ("dark", "light", or "system").
 * @returns True if dark mode is enabled, false otherwise.
 * @remarks Dispatches "themeToggled" event on document.
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
 * Enables dark mode and persists preference.
 * @returns True when dark mode is active.
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
 * Enables light mode and persists preference.
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
 * Applies system theme preference and updates DOM and storage.
 * @returns True if system theme is dark.
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
 * Toggles theme between dark and light modes.
 * @returns True if dark mode is enabled, false otherwise.
 * @source
 */
export async function toggleTheme() {
  const { local } = await getCurrentTheme();
  // If current theme is dark or not set, switch to light, otherwise switch to dark
  const newTheme = local === "dark" ? "light" : "dark";
  return setTheme(newTheme);
}

/**
 * Syncs application theme with stored preference or system preference.
 * Falls back to light theme if sync fails.
 * @throws Logs error and falls back to light theme if sync fails.
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
 * Updates DOM class list to reflect current theme mode.
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
