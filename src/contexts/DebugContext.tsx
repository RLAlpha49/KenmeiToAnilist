/**
 * @packageDocumentation
 * @module DebugContext
 * @description React context and provider for managing debug mode state throughout the application.
 */

// TODO: For all TODOs, only show debug features when debug mode is enabled. Each debug feature should have its own panel/section that can be toggled on/off in settings.

// TODO: API request/response viewer for debugging API issues. Should be able to see request URL, method, headers, body, response status, headers, body, and time taken. Should be able to filter by endpoint and status code.

// TODO: Event logger to track user actions and application events for debugging purposes. Should be able to filter by event type and time range.

// TODO: Rate limiting/debugging for API requests. Show current rate limit status and history of requests made. Allow simulating rate limit exceeded errors for testing.

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
} from "react";
import {
  installConsoleInterceptor,
  logCollector,
  type LogEntry,
  serialiseLogEntries,
  MAX_LOG_ENTRIES,
} from "../utils/logging";
import {
  getSyncConfig,
  saveSyncConfig,
  type SyncConfig,
  getMatchConfig,
  saveMatchConfig,
  type MatchConfig,
} from "../utils/storage";
import type { IpcLogEntry } from "@/types/debug";

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
  stateInspectorEnabled: boolean;
  setStateInspectorEnabled: (enabled: boolean) => void;
  toggleStateInspector: () => void;
  stateInspectorSources: StateInspectorSourceSnapshot[];
  registerStateInspector: <T>(
    config: StateInspectorRegistration<T>,
  ) => StateInspectorHandle<T>;
  applyStateInspectorUpdate: (id: string, value: unknown) => void;
  refreshStateInspectorSource: (id: string) => void;
  ipcViewerEnabled: boolean;
  setIpcViewerEnabled: (enabled: boolean) => void;
  toggleIpcViewer: () => void;
  ipcEvents: IpcLogEntry[];
  clearIpcEvents: () => void;
  maxIpcEntries: number;
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
  stateInspector: boolean;
  ipcViewer: boolean;
};

// Default all features to off for production
const DEFAULT_FEATURE_TOGGLES: DebugFeatureToggles = {
  storageDebugger: false,
  logViewer: false,
  stateInspector: false,
  ipcViewer: false,
};

export interface StateInspectorRegistration<T> {
  id: string;
  label: string;
  description?: string;
  group?: string;
  getSnapshot: () => T;
  setSnapshot?: (value: T) => void;
  serialize?: (value: T) => unknown;
  deserialize?: (value: unknown) => T;
}

interface StateInspectorSourceInternal {
  id: string;
  label: string;
  description?: string;
  group: string;
  getSnapshot: () => unknown;
  setSnapshot?: (value: unknown) => void;
  serialize: (value: unknown) => unknown;
  deserialize: (value: unknown) => unknown;
  latestRawValue: unknown;
  latestDisplayValue: unknown;
  lastUpdated: number;
}

export interface StateInspectorSourceSnapshot {
  id: string;
  label: string;
  description?: string;
  group: string;
  value: unknown;
  lastUpdated: number;
  canEdit: boolean;
}

export interface StateInspectorHandle<T> {
  publish: (value: T) => void;
  unregister: () => void;
}

interface SettingsDebugSnapshot {
  syncConfig: SyncConfig;
  matchConfig: MatchConfig;
}

function toStateInspectorSnapshots(
  sources: Map<string, StateInspectorSourceInternal>,
): StateInspectorSourceSnapshot[] {
  return Array.from(sources.values())
    .sort((a, b) => {
      const groupCompare = a.group.localeCompare(b.group);
      if (groupCompare !== 0) {
        return groupCompare;
      }
      return a.label.localeCompare(b.label);
    })
    .map((source) => ({
      id: source.id,
      label: source.label,
      description: source.description,
      group: source.group,
      value: source.latestDisplayValue,
      lastUpdated: source.lastUpdated,
      canEdit: Boolean(source.setSnapshot),
    }));
}

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
  const [ipcEvents, setIpcEvents] = useState<IpcLogEntry[]>([]);
  const [maxIpcEntries, setMaxIpcEntries] = useState<number>(() => {
    if (globalThis.window !== undefined && globalThis.electronDebug?.ipc) {
      return globalThis.electronDebug.ipc.maxEntries;
    }
    return 500;
  });
  const [stateSourceSnapshots, setStateSourceSnapshots] = useState<
    StateInspectorSourceSnapshot[]
  >([]);
  const stateSourcesRef = useRef(
    new Map<string, StateInspectorSourceInternal>(),
  );

  const storageDebuggerEnabled = featureToggles.storageDebugger;
  const logViewerEnabled = featureToggles.logViewer;
  const stateInspectorEnabled = featureToggles.stateInspector;
  const ipcViewerEnabled = featureToggles.ipcViewer;

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

  useEffect(() => {
    if (globalThis.window === undefined) return;
    const bridge = globalThis.window.electronDebug?.ipc;
    if (!bridge) return;
    setMaxIpcEntries(bridge.maxEntries);
  }, []);

  useEffect(() => {
    if (globalThis.window === undefined) {
      return;
    }

    const bridge = globalThis.electronDebug?.ipc;
    if (!bridge) {
      return;
    }

    // Enable/disable IPC tracking based on debug mode and feature toggle
    const shouldTrack = isDebugEnabled && ipcViewerEnabled;
    bridge.setEnabled(shouldTrack);

    if (!shouldTrack) {
      setIpcEvents([]);
      return;
    }

    setIpcEvents(bridge.getEvents());
    const unsubscribe = bridge.subscribe((entries) => {
      setIpcEvents(entries);
    });

    return () => {
      unsubscribe();
    };
  }, [isDebugEnabled, ipcViewerEnabled]);

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

  const setStateInspectorEnabled = useCallback(
    (enabled: boolean) => {
      persistFeatureToggles((prev) => ({
        ...prev,
        stateInspector: enabled,
      }));
    },
    [persistFeatureToggles],
  );

  const toggleStateInspector = useCallback(() => {
    persistFeatureToggles((prev) => ({
      ...prev,
      stateInspector: !prev.stateInspector,
    }));
  }, [persistFeatureToggles]);

  const setIpcViewerEnabled = useCallback(
    (enabled: boolean) => {
      persistFeatureToggles((prev) => ({
        ...prev,
        ipcViewer: enabled,
      }));
    },
    [persistFeatureToggles],
  );

  const toggleIpcViewer = useCallback(() => {
    persistFeatureToggles((prev) => ({
      ...prev,
      ipcViewer: !prev.ipcViewer,
    }));
  }, [persistFeatureToggles]);

  const registerStateInspector = useCallback(
    <T,>(config: StateInspectorRegistration<T>): StateInspectorHandle<T> => {
      const serialize = config.serialize
        ? (value: unknown) => config.serialize!(value as T)
        : (value: unknown) => value;
      const deserialize = config.deserialize
        ? (value: unknown) => config.deserialize!(value) as unknown
        : (value: unknown) => value;
      const getSnapshot = () => config.getSnapshot() as unknown;
      const setSnapshot = config.setSnapshot
        ? (value: unknown) => {
            (config.setSnapshot as (next: T) => void)(value as T);
          }
        : undefined;

      const initialRaw = getSnapshot();
      const initialDisplay = serialize(initialRaw);
      const internal: StateInspectorSourceInternal = {
        id: config.id,
        label: config.label,
        description: config.description,
        group: config.group ?? "General",
        getSnapshot,
        setSnapshot,
        serialize,
        deserialize,
        latestRawValue: initialRaw,
        latestDisplayValue: initialDisplay,
        lastUpdated: Date.now(),
      };

      const nextSources = new Map(stateSourcesRef.current);
      nextSources.set(config.id, internal);
      stateSourcesRef.current = nextSources;
      setStateSourceSnapshots(toStateInspectorSnapshots(nextSources));

      return {
        publish: (value: T) => {
          const current = stateSourcesRef.current.get(config.id);
          if (!current) return;
          const next = {
            ...current,
            latestRawValue: value,
            latestDisplayValue: current.serialize(value as unknown),
            lastUpdated: Date.now(),
          } satisfies StateInspectorSourceInternal;
          const map = new Map(stateSourcesRef.current);
          map.set(config.id, next);
          stateSourcesRef.current = map;
          setStateSourceSnapshots(toStateInspectorSnapshots(map));
        },
        unregister: () => {
          const current = new Map(stateSourcesRef.current);
          current.delete(config.id);
          stateSourcesRef.current = current;
          setStateSourceSnapshots(toStateInspectorSnapshots(current));
        },
      };
    },
    [],
  );

  const refreshStateInspectorSource = useCallback((id: string) => {
    const source = stateSourcesRef.current.get(id);
    if (!source) return;
    try {
      const snapshot = source.getSnapshot();
      const map = new Map(stateSourcesRef.current);
      map.set(id, {
        ...source,
        latestRawValue: snapshot,
        latestDisplayValue: source.serialize(snapshot),
        lastUpdated: Date.now(),
      });
      stateSourcesRef.current = map;
      setStateSourceSnapshots(toStateInspectorSnapshots(map));
    } catch (error) {
      console.error("Failed to refresh state inspector source", {
        id,
        error,
      });
    }
  }, []);

  const applyStateInspectorUpdate = useCallback(
    (id: string, value: unknown) => {
      const source = stateSourcesRef.current.get(id);
      if (!source) {
        throw new Error(`Unknown state inspector source: ${id}`);
      }

      if (!source.setSnapshot) {
        throw new Error(`State inspector source '${id}' is read-only`);
      }

      const nextValue = source.deserialize(value);

      try {
        source.setSnapshot(nextValue);
        const refreshed = source.getSnapshot();
        const map = new Map(stateSourcesRef.current);
        map.set(id, {
          ...source,
          latestRawValue: refreshed,
          latestDisplayValue: source.serialize(refreshed),
          lastUpdated: Date.now(),
        });
        stateSourcesRef.current = map;
        setStateSourceSnapshots(toStateInspectorSnapshots(map));
      } catch (error) {
        console.error("Failed to apply state inspector update", {
          id,
          error,
        });
        throw error;
      }
    },
    [],
  );

  useEffect(() => {
    const settingsId = "settings-state";
    try {
      const handle = registerStateInspector<SettingsDebugSnapshot>({
        id: settingsId,
        label: "Application Settings",
        description:
          "Persisted sync and matching configuration stored in local preferences.",
        group: "Settings",
        getSnapshot: () => ({
          syncConfig: getSyncConfig(),
          matchConfig: getMatchConfig(),
        }),
        setSnapshot: (snapshot) => {
          if (snapshot.syncConfig) {
            saveSyncConfig(snapshot.syncConfig);
          }
          if (snapshot.matchConfig) {
            saveMatchConfig(snapshot.matchConfig);
          }
        },
        serialize: (snapshot) => ({
          syncConfig: snapshot.syncConfig,
          matchConfig: snapshot.matchConfig,
        }),
        deserialize: (value) => {
          const candidate = value as Partial<SettingsDebugSnapshot> | null;
          return {
            syncConfig: candidate?.syncConfig ?? getSyncConfig(),
            matchConfig: candidate?.matchConfig ?? getMatchConfig(),
          } satisfies SettingsDebugSnapshot;
        },
      });

      return () => {
        handle.unregister();
      };
    } catch (error) {
      console.error("Failed to register settings state inspector", error);
      return undefined;
    }
  }, [registerStateInspector]);

  const clearLogs = useCallback(() => {
    logCollector.clear();
  }, []);

  const clearIpcEvents = useCallback(() => {
    if (globalThis.window === undefined) return;
    globalThis.electronDebug?.ipc.clear();
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
      stateInspectorEnabled,
      setStateInspectorEnabled,
      toggleStateInspector,
      ipcViewerEnabled,
      setIpcViewerEnabled,
      toggleIpcViewer,
      stateInspectorSources: stateSourceSnapshots,
      registerStateInspector,
      applyStateInspectorUpdate,
      refreshStateInspectorSource,
      ipcEvents,
      clearIpcEvents,
      maxIpcEntries,
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
      stateInspectorEnabled,
      setStateInspectorEnabled,
      toggleStateInspector,
      ipcViewerEnabled,
      setIpcViewerEnabled,
      toggleIpcViewer,
      stateSourceSnapshots,
      registerStateInspector,
      applyStateInspectorUpdate,
      refreshStateInspectorSource,
      ipcEvents,
      clearIpcEvents,
      maxIpcEntries,
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
