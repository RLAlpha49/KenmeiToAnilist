/**
 * @packageDocumentation
 * @module DebugContext
 * @description React context and provider for managing debug mode state throughout the application.
 */

// TODO: For all TODOs, only show debug features when debug mode is enabled. Each debug feature should have its own panel/section that can be toggled on/off in settings.

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
import {
  installConsoleInterceptor,
  logCollector,
  type LogEntry,
  serialiseLogEntries,
  MAX_LOG_ENTRIES,
} from "../utils/logging";

/**
 * The shape of the debug context value provided to consumers.
 *
 * @property isDebugEnabled - Whether debug mode is currently enabled.
 * @property toggleDebug - Function to toggle debug mode on/off.
 * @property setDebugEnabled - Function to explicitly set debug mode state.
 * @property logViewerEnabled - Whether the log viewer panel is available in the debug menu.
 * @property logEntries - Captured console log entries for inspection.
 * @property clearLogs - Clears captured log entries.
 * @property exportLogs - Exports captured log entries to a JSON file.
 * @source
 */
interface DebugContextType {
  isDebugEnabled: boolean;
  toggleDebug: () => void;
  setDebugEnabled: (enabled: boolean) => void;
  storageDebuggerEnabled: boolean;
  setStorageDebuggerEnabled: (enabled: boolean) => void;
  toggleStorageDebugger: () => void;
  logViewerEnabled: boolean;
  setLogViewerEnabled: (enabled: boolean) => void;
  toggleLogViewer: () => void;
  logEntries: LogEntry[];
  clearLogs: () => void;
  exportLogs: () => void;
  maxLogEntries: number;
}

const DebugContext = createContext<DebugContextType | undefined>(undefined);

const DEBUG_STORAGE_KEY = "debug-mode-enabled";
const DEBUG_FEATURE_TOGGLES_KEY = "debug-feature-toggles";

type DebugFeatureToggles = {
  storageDebugger: boolean;
  logViewer: boolean;
};

const DEFAULT_FEATURE_TOGGLES: DebugFeatureToggles = {
  storageDebugger: true,
  logViewer: true,
};

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
  const [featureToggles, setFeatureToggles] = useState<DebugFeatureToggles>(
    DEFAULT_FEATURE_TOGGLES,
  );
  const [logEntries, setLogEntries] = useState<LogEntry[]>([]);

  const storageDebuggerEnabled = featureToggles.storageDebugger;
  const logViewerEnabled = featureToggles.logViewer;

  useEffect(() => {
    // Only install the console interceptor when BOTH debug mode AND the log viewer feature are enabled.
    if (!(isDebugEnabled && logViewerEnabled)) return;

    const detachConsole = installConsoleInterceptor();
    return () => {
      detachConsole?.();
    };
  }, [isDebugEnabled, logViewerEnabled]);

  useEffect(() => {
    if (!isDebugEnabled && !logViewerEnabled) {
      return;
    }

    setLogEntries(logCollector.getEntries());
    const unsubscribe = logCollector.subscribe((entries) => {
      setLogEntries(entries);
    });

    return () => {
      unsubscribe();
    };
  }, [isDebugEnabled, logViewerEnabled]);

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

  // Load feature toggles on initialization
  useEffect(() => {
    try {
      const storedToggles = localStorage.getItem(DEBUG_FEATURE_TOGGLES_KEY);
      if (storedToggles) {
        const parsed = JSON.parse(
          storedToggles,
        ) as Partial<DebugFeatureToggles>;
        setFeatureToggles((prev) => ({
          ...prev,
          ...parsed,
        }));
      }
    } catch (error) {
      console.error(
        "Failed to load debug feature toggles from localStorage:",
        error,
      );
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

  const persistFeatureToggles = useCallback(
    (updater: (prev: DebugFeatureToggles) => DebugFeatureToggles) => {
      setFeatureToggles((prev) => {
        const next = updater(prev);
        try {
          localStorage.setItem(DEBUG_FEATURE_TOGGLES_KEY, JSON.stringify(next));
        } catch (error) {
          console.error(
            "Failed to save debug feature toggles to localStorage:",
            error,
          );
        }
        return next;
      });
    },
    [],
  );

  const setStorageDebuggerEnabled = useCallback(
    (enabled: boolean) => {
      persistFeatureToggles((prev) => ({
        ...prev,
        storageDebugger: enabled,
      }));
    },
    [persistFeatureToggles],
  );

  const toggleStorageDebugger = useCallback(() => {
    persistFeatureToggles((prev) => ({
      ...prev,
      storageDebugger: !prev.storageDebugger,
    }));
  }, [persistFeatureToggles]);

  const setLogViewerEnabled = useCallback(
    (enabled: boolean) => {
      persistFeatureToggles((prev) => ({
        ...prev,
        logViewer: enabled,
      }));
    },
    [persistFeatureToggles],
  );

  const toggleLogViewer = useCallback(() => {
    persistFeatureToggles((prev) => ({
      ...prev,
      logViewer: !prev.logViewer,
    }));
  }, [persistFeatureToggles]);

  const clearLogs = useCallback(() => {
    logCollector.clear();
  }, []);

  const exportLogs = useCallback(() => {
    const entries = logCollector.getEntries();
    if (!entries.length) {
      console.warn("No debug logs available to export");
      return;
    }

    try {
      const payload = {
        exportedAt: new Date().toISOString(),
        userAgent:
          typeof navigator === "undefined" ? undefined : navigator.userAgent,
        totalEntries: entries.length,
        maxEntries: MAX_LOG_ENTRIES,
        logs: serialiseLogEntries(entries),
      };

      const json = JSON.stringify(payload, null, 2);
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const timestamp = new Date()
        .toISOString()
        .replaceAll(":", "-")
        .replaceAll(".", "-");
      link.href = url;
      link.download = `kenmei-debug-logs-${timestamp}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Failed to export debug logs:", error);
    }
  }, []);

  const value = React.useMemo<DebugContextType>(
    () => ({
      isDebugEnabled,
      toggleDebug,
      setDebugEnabled,
      storageDebuggerEnabled,
      setStorageDebuggerEnabled,
      toggleStorageDebugger,
      logViewerEnabled,
      setLogViewerEnabled,
      toggleLogViewer,
      logEntries,
      clearLogs,
      exportLogs,
      maxLogEntries: MAX_LOG_ENTRIES,
    }),
    [
      isDebugEnabled,
      toggleDebug,
      setDebugEnabled,
      storageDebuggerEnabled,
      setStorageDebuggerEnabled,
      toggleStorageDebugger,
      logViewerEnabled,
      setLogViewerEnabled,
      toggleLogViewer,
      logEntries,
      clearLogs,
      exportLogs,
    ],
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
