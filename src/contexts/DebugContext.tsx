/**
 * @packageDocumentation
 * @module DebugContext
 * @description React context and provider for managing debug mode state throughout the application.
 */

// TODO: For all TODOs, only show debug features when debug mode is enabled. Each debug feature should have its own panel/section that can be toggled on/off in settings.
// TODO: There should be an overall "Enable Debug Mode" toggle in settings and the user should be warned that debug mode may expose sensitive information.

// TODO: Add ability to view log messages. This is not useful in development and is meant for production environments.
// TODO: May need to update log messages to distinguish between normal logs and debug logs.
// TODO: Add ability to export logs to a file for easier sharing when reporting issues.

// TODO: API request/response viewer for debugging API issues. Should be able to see request URL, method, headers, body, response status, headers, body, and time taken. Should be able to filter by endpoint and status code.

// TODO: Add ability to view application state (e.g. auth state, sync state, settings) for debugging purposes. Allow modifying state for testing.

// TODO: IPC communication viewer for debugging IPC issues. Should be able to see messages sent/received, channels, and data. Should be able to filter.

// TODO: Event logger to track user actions and application events for debugging purposes. Should be able to filter by event type and time range.

// TODO: Rate limiting/debugging for API requests. Show current rate limit status and history of requests made. Allow simulating rate limit exceeded errors for testing.

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
