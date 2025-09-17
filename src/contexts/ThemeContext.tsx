/**
 * @packageDocumentation
 * @module ThemeContext
 * @description React context and provider for managing and accessing theme preferences (dark, light, system) throughout the application.
 */

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import { ThemeMode } from "@/types/theme-mode";
import {
  getCurrentTheme,
  setTheme as setThemeHelper,
  ThemePreferences,
  updateDocumentTheme,
} from "@/helpers/theme_helpers";

/**
 * The shape of the theme context value provided to consumers.
 *
 * @property theme - The current theme preferences (system and local).
 * @property isDarkMode - Whether dark mode is currently enabled.
 * @property setThemeMode - Function to set the theme mode.
 * @property toggleTheme - Function to toggle between dark and light modes.
 * @source
 */
interface ThemeContextType {
  theme: ThemePreferences;
  isDarkMode: boolean;
  setThemeMode: (mode: ThemeMode) => Promise<boolean>;
  toggleTheme: () => Promise<boolean>;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

/**
 * Provides theme context to its children, managing theme state and updates.
 *
 * @param children - The React children to be wrapped by the provider.
 * @returns The theme context provider with value for consumers.
 * @source
 */
export function ThemeProvider({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const [theme, setTheme] = useState<ThemePreferences>({
    system: "light",
    local: null,
  });
  const [isDarkMode, setIsDarkMode] = useState(false);

  const initializeTheme = useCallback(async () => {
    try {
      const currentTheme = await getCurrentTheme();
      setTheme(currentTheme);

      // Add null check before accessing local property
      const isDark =
        (currentTheme?.local || currentTheme?.system || "light") === "dark";
      setIsDarkMode(isDark);
      updateDocumentTheme(isDark);
    } catch (error) {
      console.error("Failed to initialize theme:", error);
      // Fallback to light theme
      setTheme({ system: "light", local: "light" });
      setIsDarkMode(false);
      updateDocumentTheme(false);
    }
  }, []);

  useEffect(() => {
    initializeTheme();

    // Set up event listener for theme changes from other components
    const handleThemeChange = async () => {
      const currentTheme = await getCurrentTheme();
      setTheme(currentTheme);
      setIsDarkMode(currentTheme.local === "dark");
    };

    document.addEventListener("themeToggled", handleThemeChange);
    return () => {
      document.removeEventListener("themeToggled", handleThemeChange);
    };
  }, [initializeTheme]);

  const setThemeMode = async (mode: ThemeMode) => {
    const newIsDarkMode = await setThemeHelper(mode);
    setTheme(await getCurrentTheme());
    setIsDarkMode(newIsDarkMode);
    return newIsDarkMode;
  };

  const toggleTheme = async () => {
    // If current theme is dark or not set, switch to light, otherwise switch to dark
    const newTheme = theme.local === "dark" ? "light" : "dark";
    return await setThemeMode(newTheme);
  };

  const contextValue = React.useMemo(
    () => ({ theme, isDarkMode, setThemeMode, toggleTheme }),
    [theme, isDarkMode, setThemeMode, toggleTheme],
  );

  return (
    <ThemeContext.Provider value={contextValue}>
      {children}
    </ThemeContext.Provider>
  );
}

/**
 * Custom hook to access the theme context.
 *
 * @returns The current theme context value.
 * @throws If used outside of a ThemeProvider.
 * @source
 */
export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
};
