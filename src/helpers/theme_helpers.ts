import { ThemeMode } from "@/types/theme-mode";
import { storage } from "../utils/storage";

const THEME_KEY = "theme";

export interface ThemePreferences {
  system: ThemeMode;
  local: ThemeMode | null;
}

export async function getCurrentTheme(): Promise<ThemePreferences> {
  const currentTheme = await window.themeMode.current();
  const localTheme = storage.getItem(THEME_KEY) as ThemeMode | null;

  return {
    system: currentTheme,
    local: localTheme,
  };
}

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

export async function toggleTheme() {
  const { local } = await getCurrentTheme();
  // If current theme is dark or not set, switch to light, otherwise switch to dark
  const newTheme = local === "dark" ? "light" : "dark";

  const isDarkMode = await setTheme(newTheme);
  return isDarkMode;
}

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

export function updateDocumentTheme(isDarkMode: boolean) {
  if (!isDarkMode) {
    document.documentElement.classList.remove("dark");
  } else {
    document.documentElement.classList.add("dark");
  }
}
