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

interface ThemeContextType {
  theme: ThemePreferences;
  isDarkMode: boolean;
  setThemeMode: (mode: ThemeMode) => Promise<boolean>;
  toggleTheme: () => Promise<boolean>;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
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

  return (
    <ThemeContext.Provider
      value={{ theme, isDarkMode, setThemeMode, toggleTheme }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
};
