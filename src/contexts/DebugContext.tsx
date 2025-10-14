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
  useRef,
} from "react";
import {
  installConsoleInterceptor,
  logCollector,
  type LogEntry,
  serialiseLogEntries,
  MAX_LOG_ENTRIES,
  setLogRedactionEnabled as setCollectorLogRedactionEnabled,
} from "../utils/logging";
import {
  getSyncConfig,
  saveSyncConfig,
  type SyncConfig,
  getMatchConfig,
  saveMatchConfig,
  type MatchConfig,
} from "../utils/storage";
import type {
  DebugEventEntry,
  DebugEventRecord,
  IpcLogEntry,
} from "@/types/debug";

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
interface DebugStateContextValue {
  isDebugEnabled: boolean;
  storageDebuggerEnabled: boolean;
  logViewerEnabled: boolean;
  logRedactionEnabled: boolean;
  stateInspectorEnabled: boolean;
  stateInspectorSources: StateInspectorSourceSnapshot[];
  ipcViewerEnabled: boolean;
  eventLoggerEnabled: boolean;
  eventLogEntries: DebugEventEntry[];
  maxEventLogEntries: number;
  ipcEvents: IpcLogEntry[];
  maxIpcEntries: number;
  logEntries: LogEntry[];
  maxLogEntries: number;
}

interface DebugActionsContextValue {
  toggleDebug: () => void;
  setDebugEnabled: (enabled: boolean) => void;
  setStorageDebuggerEnabled: (enabled: boolean) => void;
  toggleStorageDebugger: () => void;
  setLogViewerEnabled: (enabled: boolean) => void;
  toggleLogViewer: () => void;
  setLogRedactionEnabled: (enabled: boolean) => void;
  toggleLogRedaction: () => void;
  setStateInspectorEnabled: (enabled: boolean) => void;
  toggleStateInspector: () => void;
  registerStateInspector: <T>(
    config: StateInspectorRegistration<T>,
  ) => StateInspectorHandle<T>;
  applyStateInspectorUpdate: (id: string, value: unknown) => void;
  refreshStateInspectorSource: (id: string) => void;
  setIpcViewerEnabled: (enabled: boolean) => void;
  toggleIpcViewer: () => void;
  setEventLoggerEnabled: (enabled: boolean) => void;
  toggleEventLogger: () => void;
  recordEvent: (entry: DebugEventRecord, options?: RecordEventOptions) => void;
  clearEventLog: () => void;
  clearIpcEvents: () => void;
  clearLogs: () => void;
  exportLogs: () => void;
}

interface DebugContextType
  extends DebugStateContextValue,
    DebugActionsContextValue {}

const DebugContext = createContext<DebugContextType | undefined>(undefined);
const DebugStateContext = createContext<DebugStateContextValue | undefined>(
  undefined,
);

const DebugActionsContext = createContext<DebugActionsContextValue | undefined>(
  undefined,
);

const DEBUG_STORAGE_KEY = "debug-mode-enabled";
const DEBUG_FEATURE_TOGGLES_KEY = "debug-feature-toggles";
const MAX_EVENT_LOG_ENTRIES = 500;

type DebugFeatureToggles = {
  storageDebugger: boolean;
  logViewer: boolean;
  stateInspector: boolean;
  ipcViewer: boolean;
  redactLogs: boolean;
  eventLogger: boolean;
};

// Default all features to off for production
const DEFAULT_FEATURE_TOGGLES: DebugFeatureToggles = {
  storageDebugger: false,
  logViewer: false,
  stateInspector: false,
  ipcViewer: false,
  redactLogs: true,
  eventLogger: false,
};

interface RecordEventOptions {
  force?: boolean;
}

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
  const [eventLogEntries, setEventLogEntries] = useState<DebugEventEntry[]>([]);
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
  const logRedactionEnabled = featureToggles.redactLogs;
  const stateInspectorEnabled = featureToggles.stateInspector;
  const ipcViewerEnabled = featureToggles.ipcViewer;
  const eventLoggerEnabled = featureToggles.eventLogger;

  useEffect(() => {
    // Only install the console interceptor when BOTH debug mode AND the log viewer feature are enabled.
    if (!(isDebugEnabled && logViewerEnabled)) return;

    const detachConsole = installConsoleInterceptor();
    return () => {
      detachConsole?.();
    };
  }, [isDebugEnabled, logViewerEnabled]);

  useEffect(() => {
    setCollectorLogRedactionEnabled(logRedactionEnabled);
  }, [logRedactionEnabled]);

  useEffect(() => {
    if (!isDebugEnabled && !logViewerEnabled) {
      return;
    }

    setLogEntries(logCollector.getEntries());
    const unsubscribe = logCollector.subscribe((entries) => {
      // Use queueMicrotask to defer state update and avoid setState during render
      queueMicrotask(() => {
        setLogEntries(entries);
      });
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

  useEffect(() => {
    if (!isDebugEnabled) {
      setEventLogEntries([]);
    }
  }, [isDebugEnabled]);

  useEffect(() => {
    if (!eventLoggerEnabled) {
      setEventLogEntries([]);
    }
  }, [eventLoggerEnabled]);

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

  const recordEvent = useCallback(
    (entry: DebugEventRecord, options?: RecordEventOptions) => {
      const shouldRecord =
        options?.force === true || (isDebugEnabled && eventLoggerEnabled);
      if (!shouldRecord) {
        return;
      }

      const timestamp = entry.timestamp ?? new Date().toISOString();
      let id = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      const cryptoApi = globalThis.crypto;
      if (cryptoApi && typeof cryptoApi.randomUUID === "function") {
        id = cryptoApi.randomUUID();
      }

      const normalised: DebugEventEntry = {
        id,
        timestamp,
        type: entry.type,
        message: entry.message,
        level: entry.level,
        source: entry.source,
        context: entry.context,
        metadata: entry.metadata,
        tags: entry.tags,
      };

      setEventLogEntries((previous) => {
        const next = [...previous, normalised];
        if (next.length > MAX_EVENT_LOG_ENTRIES) {
          return next.slice(next.length - MAX_EVENT_LOG_ENTRIES);
        }
        return next;
      });
    },
    [eventLoggerEnabled, isDebugEnabled],
  );

  const clearEventLog = useCallback(() => {
    setEventLogEntries([]);
  }, []);

  // Save debug state to localStorage whenever it changes
  const setDebugEnabled = useCallback(
    (enabled: boolean) => {
      setIsDebugEnabled(enabled);
      try {
        localStorage.setItem(DEBUG_STORAGE_KEY, JSON.stringify(enabled));
      } catch (error) {
        console.error("Failed to save debug state to localStorage:", error);
      }
      recordEvent(
        {
          type: "debug.mode",
          message: enabled ? "Debug mode enabled" : "Debug mode disabled",
          level: enabled ? "info" : "warn",
          metadata: { enabled },
        },
        { force: true },
      );
    },
    [recordEvent],
  );

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
      recordEvent({
        type: "debug.storage",
        message: enabled
          ? "Storage debugger enabled"
          : "Storage debugger disabled",
        level: enabled ? "info" : "warn",
        metadata: { enabled },
      });
    },
    [persistFeatureToggles, recordEvent],
  );

  const toggleStorageDebugger = useCallback(() => {
    setStorageDebuggerEnabled(!storageDebuggerEnabled);
  }, [setStorageDebuggerEnabled, storageDebuggerEnabled]);

  const setLogViewerEnabled = useCallback(
    (enabled: boolean) => {
      persistFeatureToggles((prev) => ({
        ...prev,
        logViewer: enabled,
      }));
      recordEvent({
        type: "debug.log-viewer",
        message: enabled ? "Log viewer enabled" : "Log viewer disabled",
        level: enabled ? "info" : "warn",
        metadata: { enabled },
      });
    },
    [persistFeatureToggles, recordEvent],
  );

  const toggleLogViewer = useCallback(() => {
    setLogViewerEnabled(!logViewerEnabled);
  }, [logViewerEnabled, setLogViewerEnabled]);

  const setLogRedactionEnabled = useCallback(
    (enabled: boolean) => {
      persistFeatureToggles((prev) => ({
        ...prev,
        redactLogs: enabled,
      }));
      recordEvent({
        type: "debug.log-viewer",
        message: enabled ? "Log redaction enabled" : "Log redaction disabled",
        level: "info",
        metadata: { enabled },
      });
    },
    [persistFeatureToggles, recordEvent],
  );

  const toggleLogRedaction = useCallback(() => {
    setLogRedactionEnabled(!logRedactionEnabled);
  }, [logRedactionEnabled, setLogRedactionEnabled]);

  const setStateInspectorEnabled = useCallback(
    (enabled: boolean) => {
      persistFeatureToggles((prev) => ({
        ...prev,
        stateInspector: enabled,
      }));
      recordEvent({
        type: "debug.state-inspector",
        message: enabled
          ? "State inspector enabled"
          : "State inspector disabled",
        level: enabled ? "info" : "warn",
        metadata: { enabled },
      });
    },
    [persistFeatureToggles, recordEvent],
  );

  const toggleStateInspector = useCallback(() => {
    setStateInspectorEnabled(!stateInspectorEnabled);
  }, [setStateInspectorEnabled, stateInspectorEnabled]);

  const setIpcViewerEnabled = useCallback(
    (enabled: boolean) => {
      persistFeatureToggles((prev) => ({
        ...prev,
        ipcViewer: enabled,
      }));
      recordEvent({
        type: "debug.ipc",
        message: enabled ? "IPC viewer enabled" : "IPC viewer disabled",
        level: enabled ? "info" : "warn",
        metadata: { enabled },
      });
    },
    [persistFeatureToggles, recordEvent],
  );

  const toggleIpcViewer = useCallback(() => {
    setIpcViewerEnabled(!ipcViewerEnabled);
  }, [ipcViewerEnabled, setIpcViewerEnabled]);

  const setEventLoggerEnabled = useCallback(
    (enabled: boolean) => {
      persistFeatureToggles((prev) => ({
        ...prev,
        eventLogger: enabled,
      }));
      recordEvent(
        {
          type: "debug.event-logger",
          message: enabled ? "Event logger enabled" : "Event logger disabled",
          level: enabled ? "info" : "warn",
          metadata: { enabled },
        },
        { force: true },
      );
    },
    [persistFeatureToggles, recordEvent],
  );

  const toggleEventLogger = useCallback(() => {
    setEventLoggerEnabled(!eventLoggerEnabled);
  }, [eventLoggerEnabled, setEventLoggerEnabled]);

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
      recordEvent({
        type: "debug.state-inspector",
        message: `Registered state inspector '${config.label}'`,
        level: "debug",
        metadata: { id: config.id },
      });

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
          recordEvent({
            type: "debug.state-inspector",
            message: `Unregistered state inspector '${config.label}'`,
            level: "debug",
            metadata: { id: config.id },
          });
        },
      };
    },
    [recordEvent],
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
        recordEvent({
          type: "debug.state-inspector",
          message: `State inspector '${source.label ?? id}' updated`,
          level: "debug",
          metadata: { id },
        });
      } catch (error) {
        console.error("Failed to apply state inspector update", {
          id,
          error,
        });
        throw error;
      }
    },
    [recordEvent],
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
    recordEvent({
      type: "debug.log-viewer",
      message: "Console log buffer cleared",
      level: "warn",
    });
  }, [recordEvent]);

  const clearIpcEvents = useCallback(() => {
    if (globalThis.window === undefined) return;
    globalThis.electronDebug?.ipc.clear();
    recordEvent({
      type: "debug.ipc",
      message: "IPC log cleared",
      level: "warn",
    });
  }, [recordEvent]);

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
      recordEvent({
        type: "debug.log-viewer",
        message: "Console logs exported",
        level: "info",
        metadata: { totalEntries: entries.length },
      });
    } catch (error) {
      console.error("Failed to export debug logs:", error);
      recordEvent(
        {
          type: "debug.log-viewer",
          message: "Failed to export debug logs",
          level: "error",
          metadata: {
            error: error instanceof Error ? error.message : String(error),
          },
        },
        { force: true },
      );
    }
  }, []);

  const stateContextValue = React.useMemo<DebugStateContextValue>(
    () => ({
      isDebugEnabled,
      storageDebuggerEnabled,
      logViewerEnabled,
      logRedactionEnabled,
      stateInspectorEnabled,
      stateInspectorSources: stateSourceSnapshots,
      ipcViewerEnabled,
      eventLoggerEnabled,
      eventLogEntries,
      maxEventLogEntries: MAX_EVENT_LOG_ENTRIES,
      ipcEvents,
      maxIpcEntries,
      logEntries,
      maxLogEntries: MAX_LOG_ENTRIES,
    }),
    [
      eventLogEntries,
      eventLoggerEnabled,
      ipcEvents,
      ipcViewerEnabled,
      isDebugEnabled,
      logEntries,
      logRedactionEnabled,
      logViewerEnabled,
      maxIpcEntries,
      stateInspectorEnabled,
      stateSourceSnapshots,
      storageDebuggerEnabled,
    ],
  );

  const actionsContextValue = React.useMemo<DebugActionsContextValue>(
    () => ({
      toggleDebug,
      setDebugEnabled,
      setStorageDebuggerEnabled,
      toggleStorageDebugger,
      setLogViewerEnabled,
      toggleLogViewer,
      setLogRedactionEnabled,
      toggleLogRedaction,
      setStateInspectorEnabled,
      toggleStateInspector,
      registerStateInspector,
      applyStateInspectorUpdate,
      refreshStateInspectorSource,
      setIpcViewerEnabled,
      toggleIpcViewer,
      setEventLoggerEnabled,
      toggleEventLogger,
      recordEvent,
      clearEventLog,
      clearIpcEvents,
      clearLogs,
      exportLogs,
    }),
    [
      applyStateInspectorUpdate,
      clearEventLog,
      clearIpcEvents,
      clearLogs,
      exportLogs,
      recordEvent,
      refreshStateInspectorSource,
      registerStateInspector,
      setDebugEnabled,
      setEventLoggerEnabled,
      setIpcViewerEnabled,
      setLogRedactionEnabled,
      setLogViewerEnabled,
      setStateInspectorEnabled,
      setStorageDebuggerEnabled,
      toggleDebug,
      toggleEventLogger,
      toggleIpcViewer,
      toggleLogRedaction,
      toggleLogViewer,
      toggleStateInspector,
      toggleStorageDebugger,
    ],
  );

  const legacyContextValue = React.useMemo<DebugContextType>(
    () => ({
      ...stateContextValue,
      ...actionsContextValue,
    }),
    [actionsContextValue, stateContextValue],
  );

  return (
    <DebugActionsContext.Provider value={actionsContextValue}>
      <DebugStateContext.Provider value={stateContextValue}>
        <DebugContext.Provider value={legacyContextValue}>
          {children}
        </DebugContext.Provider>
      </DebugStateContext.Provider>
    </DebugActionsContext.Provider>
  );
}

export function useDebugState(): DebugStateContextValue {
  const context = useContext(DebugStateContext);
  if (context === undefined) {
    throw new Error("useDebugState must be used within a DebugProvider");
  }
  return context;
}

export function useDebugActions(): DebugActionsContextValue {
  const context = useContext(DebugActionsContext);
  if (context === undefined) {
    throw new Error("useDebugActions must be used within a DebugProvider");
  }
  return context;
}

export function useDebug(): DebugContextType {
  const legacyContext = useContext(DebugContext);
  const stateContext = useContext(DebugStateContext);
  const actionsContext = useContext(DebugActionsContext);

  const mergedContext = React.useMemo(() => {
    if (legacyContext !== undefined) {
      return legacyContext;
    }

    if (stateContext !== undefined && actionsContext !== undefined) {
      return {
        ...stateContext,
        ...actionsContext,
      } satisfies DebugContextType;
    }

    return undefined;
  }, [actionsContext, legacyContext, stateContext]);

  if (mergedContext === undefined) {
    throw new Error("useDebug must be used within a DebugProvider");
  }

  return mergedContext;
}
