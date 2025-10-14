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
  useRef,
} from "react";
import { ThemeMode } from "@/types/theme-mode";
import {
  getCurrentTheme,
  ThemePreferences,
  updateDocumentTheme,
  enableDarkMode,
  enableLightMode,
  applySystemTheme,
} from "@/helpers/theme_helpers";
import { useDebugActions, StateInspectorHandle } from "./DebugContext";

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

interface ThemeDebugSnapshot {
  theme: ThemePreferences;
  isDarkMode: boolean;
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
  const { registerStateInspector: registerThemeStateInspector } =
    useDebugActions();
  const themeInspectorHandleRef =
    useRef<StateInspectorHandle<ThemeDebugSnapshot> | null>(null);
  const themeSnapshotRef = useRef<ThemeDebugSnapshot | null>(null);
  const getThemeSnapshotRef = useRef<() => ThemeDebugSnapshot>(() => ({
    theme,
    isDarkMode,
  }));
  getThemeSnapshotRef.current = () => ({
    theme,
    isDarkMode,
  });

  const emitThemeSnapshot = useCallback(() => {
    if (!themeInspectorHandleRef.current) return;
    const snapshot = getThemeSnapshotRef.current();
    themeSnapshotRef.current = snapshot;
    themeInspectorHandleRef.current.publish(snapshot);
  }, []);

  const applyThemeDebugSnapshot = useCallback(
    (snapshot: ThemeDebugSnapshot) => {
      setTheme((prev) => ({
        system: snapshot.theme?.system ?? prev.system,
        local: snapshot.theme?.local ?? prev.local,
      }));

      const computedIsDark = (() => {
        if (typeof snapshot.isDarkMode === "boolean")
          return snapshot.isDarkMode;
        if (snapshot.theme?.local === "dark") return true;
        if (snapshot.theme?.local === "light") return false;
        return undefined;
      })();

      if (computedIsDark !== undefined) {
        setIsDarkMode(computedIsDark);
      }

      const resolvedMode =
        snapshot.theme?.local ?? (computedIsDark ? "dark" : "light");
      if (resolvedMode === "dark" || resolvedMode === "light") {
        updateDocumentTheme(resolvedMode);
      }
    },
    [],
  );

  const initializeTheme = useCallback(async () => {
    try {
      const currentTheme = await getCurrentTheme();
      setTheme(currentTheme);

      // Add null check before accessing local property
      const mode = currentTheme?.local || currentTheme?.system || "light";
      let resolvedMode: "dark" | "light";
      if (mode === "dark" || mode === "light") {
        resolvedMode = mode;
      } else {
        // Resolve system mode to dark/light explicitly
        resolvedMode = (await globalThis.themeMode.system()) ? "dark" : "light";
      }
      const isDark = resolvedMode === "dark";
      setIsDarkMode(isDark);
      updateDocumentTheme(resolvedMode);
    } catch (error) {
      console.error("Failed to initialize theme:", error);
      // Fallback to light theme
      setTheme({ system: "light", local: "light" });
      setIsDarkMode(false);
      updateDocumentTheme("light");
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

  useEffect(() => {
    emitThemeSnapshot();
  }, [theme, isDarkMode, emitThemeSnapshot]);

  useEffect(() => {
    if (!registerThemeStateInspector) return;

    themeSnapshotRef.current = getThemeSnapshotRef.current();

    const handle = registerThemeStateInspector<ThemeDebugSnapshot>({
      id: "theme-state",
      label: "Theme",
      description:
        "Current theme preferences and resolved dark mode flag applied to the document.",
      group: "Application",
      getSnapshot: () =>
        themeSnapshotRef.current ?? getThemeSnapshotRef.current(),
      setSnapshot: applyThemeDebugSnapshot,
    });

    themeInspectorHandleRef.current = handle;

    return () => {
      handle.unregister();
      themeInspectorHandleRef.current = null;
      themeSnapshotRef.current = null;
    };
  }, [registerThemeStateInspector, applyThemeDebugSnapshot]);

  const setThemeMode = async (mode: ThemeMode) => {
    let newIsDarkMode: boolean;
    if (mode === "dark") {
      newIsDarkMode = await enableDarkMode();
    } else if (mode === "light") {
      newIsDarkMode = await enableLightMode();
    } else {
      newIsDarkMode = await applySystemTheme();
    }
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
