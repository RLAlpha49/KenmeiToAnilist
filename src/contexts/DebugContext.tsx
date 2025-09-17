/**
 * @packageDocumentation
 * @module DebugContext
 * @description React context and provider for managing debug mode state throughout the application.
 */

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";

/**
 * The shape of the debug context value provided to consumers.
 *
 * @property isDebugEnabled - Whether debug mode is currently enabled.
 * @property toggleDebug - Function to toggle debug mode on/off.
 * @property setDebugEnabled - Function to explicitly set debug mode state.
 * @source
 */
interface DebugContextType {
  isDebugEnabled: boolean;
  toggleDebug: () => void;
  setDebugEnabled: (enabled: boolean) => void;
}

const DebugContext = createContext<DebugContextType | undefined>(undefined);

const DEBUG_STORAGE_KEY = "debug-mode-enabled";

/**
 * Provides debug context to its children, managing debug state and persistence.
 *
 * @param children - The React children to be wrapped by the provider.
 * @returns The debug context provider with value for consumers.
 * @source
 */
export function DebugProvider({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const [isDebugEnabled, setIsDebugEnabled] = useState(false);

  // Load debug state from localStorage on initialization
  useEffect(() => {
    try {
      const savedDebugState = localStorage.getItem(DEBUG_STORAGE_KEY);
      if (savedDebugState !== null) {
        setIsDebugEnabled(JSON.parse(savedDebugState));
      }
    } catch (error) {
      console.error("Failed to load debug state from localStorage:", error);
    }
  }, []);

  // Save debug state to localStorage whenever it changes
  const setDebugEnabled = useCallback((enabled: boolean) => {
    setIsDebugEnabled(enabled);
    try {
      localStorage.setItem(DEBUG_STORAGE_KEY, JSON.stringify(enabled));
    } catch (error) {
      console.error("Failed to save debug state to localStorage:", error);
    }
  }, []);

  const toggleDebug = useCallback(() => {
    setDebugEnabled(!isDebugEnabled);
  }, [isDebugEnabled, setDebugEnabled]);

  const value = React.useMemo<DebugContextType>(
    () => ({
      isDebugEnabled,
      toggleDebug,
      setDebugEnabled,
    }),
    [isDebugEnabled, toggleDebug, setDebugEnabled],
  );

  return (
    <DebugContext.Provider value={value}>{children}</DebugContext.Provider>
  );
}

/**
 * Hook to access the debug context.
 *
 * @returns The debug context value.
 * @throws Error if used outside of a DebugProvider.
 * @source
 */
export function useDebug(): DebugContextType {
  const context = useContext(DebugContext);
  if (context === undefined) {
    throw new Error("useDebug must be used within a DebugProvider");
  }
  return context;
}
