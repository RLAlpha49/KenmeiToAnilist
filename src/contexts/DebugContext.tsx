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
  useMemo,
} from "react";
import {
  installConsoleInterceptor,
  logCollector,
  type LogEntry,
  serialiseLogEntries,
  MAX_LOG_ENTRIES,
  setLogRedactionEnabled as setCollectorLogRedactionEnabled,
} from "../utils/logging";
import { exportToJson } from "../utils/exportUtils";
import { throttle } from "@/utils/debounce";
import { FPSMonitor } from "@/utils/fpsMonitor";
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
  PerformanceMetrics,
  MemoryMetrics,
  ApiLatencySample,
} from "@/types/debug";
import { DEFAULT_PERFORMANCE_METRICS } from "@/types/debug";

/**
 * Read-only state value provided by DebugStateContext.
 * Contains all debug state but no mutation functions to prevent accidental state corruption.
 *
 * @property isDebugEnabled - Whether debug mode is currently enabled globally.
 * @property debugMenuOpen - Whether the debug menu panel is visible.
 * @property storageDebuggerEnabled - Whether the storage inspector feature is enabled.
 * @property logViewerEnabled - Whether console log interception and viewing is enabled.
 * @property logRedactionEnabled - Whether sensitive log content is redacted in logs.
 * @property stateInspectorEnabled - Whether state inspection and time-travel debugging is enabled.
 * @property stateInspectorSources - Array of registered state inspector sources for inspection.
 * @property ipcViewerEnabled - Whether IPC communication tracking is enabled.
 * @property eventLoggerEnabled - Whether debug event logging is enabled.
 * @property confidenceTestExporterEnabled - Whether confidence test export feature is enabled.
 * @property performanceMonitorEnabled - Whether performance metrics collection is enabled.
 * @property performanceMetrics - Current performance metrics (API latency, cache stats, etc.).
 * @property eventLogEntries - Array of recorded debug events.
 * @property maxEventLogEntries - Maximum number of event log entries retained.
 * @property ipcEvents - Array of tracked IPC communication events.
 * @property maxIpcEntries - Maximum number of IPC entries retained.
 * @property logEntries - Array of intercepted console log entries.
 * @property maxLogEntries - Maximum number of log entries retained.
 * @source
 */
interface DebugStateContextValue {
  isDebugEnabled: boolean;
  debugMenuOpen: boolean;
  storageDebuggerEnabled: boolean;
  logViewerEnabled: boolean;
  logRedactionEnabled: boolean;
  stateInspectorEnabled: boolean;
  stateInspectorSources: StateInspectorSourceSnapshot[];
  ipcViewerEnabled: boolean;
  eventLoggerEnabled: boolean;
  confidenceTestExporterEnabled: boolean;
  performanceMonitorEnabled: boolean;
  performanceMetrics: PerformanceMetrics;
  currentFPS: number;
  eventLogEntries: DebugEventEntry[];
  maxEventLogEntries: number;
  ipcEvents: IpcLogEntry[];
  maxIpcEntries: number;
  logEntries: LogEntry[];
  maxLogEntries: number;
}

/**
 * Mutation functions provided by DebugActionsContext.
 * Enables modification of debug state, feature toggles, and inspection data.
 *
 * @property toggleDebug - Toggles debug mode between enabled/disabled.
 * @property setDebugEnabled - Explicitly sets debug mode enabled/disabled state.
 * @property openDebugMenu - Opens the debug menu UI panel.
 * @property closeDebugMenu - Closes the debug menu UI panel.
 * @property toggleDebugMenu - Toggles debug menu visibility.
 * @property setStorageDebuggerEnabled - Enables/disables storage inspector feature.
 * @property toggleStorageDebugger - Toggles storage debugger feature.
 * @property setLogViewerEnabled - Enables/disables console log interception and viewing.
 * @property toggleLogViewer - Toggles log viewer feature.
 * @property setLogRedactionEnabled - Enables/disables log content redaction for sensitive data.
 * @property toggleLogRedaction - Toggles log redaction feature.
 * @property setStateInspectorEnabled - Enables/disables state inspection and time-travel debugging.
 * @property toggleStateInspector - Toggles state inspector feature.
 * @property registerStateInspector - Registers a new state source for inspection.
 * @property applyStateInspectorUpdate - Applies a state mutation via state inspector.
 * @property refreshStateInspectorSource - Manually refreshes a state inspector source snapshot.
 * @property setIpcViewerEnabled - Enables/disables IPC communication tracking.
 * @property toggleIpcViewer - Toggles IPC viewer feature.
 * @property setEventLoggerEnabled - Enables/disables debug event logging.
 * @property toggleEventLogger - Toggles event logger feature.
 * @property setConfidenceTestExporterEnabled - Enables/disables confidence test export feature.
 * @property toggleConfidenceTestExporter - Toggles confidence test exporter feature.
 * @property setPerformanceMonitorEnabled - Enables/disables performance metrics collection.
 * @property togglePerformanceMonitor - Toggles performance monitor feature.
 * @property recordApiLatency - Records an API request latency sample.
 * @property recordCacheAccess - Records a cache hit or miss event.
 * @property recordMatchingProgress - Records matching algorithm progress update.
 * @property updateMemoryStats - Updates memory usage metrics.
 * @property resetPerformanceMetrics - Clears all performance metrics.
 * @property exportPerformanceReport - Exports performance metrics to JSON file.
 * @property recordEvent - Records a debug event to the event log.
 * @property clearEventLog - Clears all recorded debug events.
 * @property clearIpcEvents - Clears all IPC communication events.
 * @property clearLogs - Clears all console log entries.
 * @property exportLogs - Exports console logs to JSON file.
 * @source
 */
interface DebugActionsContextValue {
  toggleDebug: () => void;
  setDebugEnabled: (enabled: boolean) => void;
  openDebugMenu: () => void;
  closeDebugMenu: () => void;
  toggleDebugMenu: () => void;
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
  setConfidenceTestExporterEnabled: (enabled: boolean) => void;
  toggleConfidenceTestExporter: () => void;
  setPerformanceMonitorEnabled: (enabled: boolean) => void;
  togglePerformanceMonitor: () => void;
  recordApiLatency: (
    duration: number,
    success: boolean,
    correlationId?: string,
    provider?: string,
    endpoint?: string,
  ) => void;
  recordCacheAccess: (hit: boolean) => void;
  recordMatchingProgress: (
    current: number,
    total: number,
    elapsedMs: number,
  ) => void;
  updateMemoryStats: (stats: MemoryMetrics) => void;
  resetPerformanceMetrics: () => void;
  exportPerformanceReport: () => void;
  recordEvent: (entry: DebugEventRecord, options?: RecordEventOptions) => void;
  clearEventLog: () => void;
  clearIpcEvents: () => void;
  clearLogs: () => void;
  exportLogs: () => void;
}

/**
 * Combined debug context type with both state and action properties.
 * Used by the legacy unified `useDebug` hook for backward compatibility.
 * @source
 */
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

/**
 * Storage key for persisting debug mode enabled/disabled state to localStorage.
 * @source
 */
const DEBUG_STORAGE_KEY = "debug-mode-enabled";

/**
 * Storage key for persisting debug feature toggles to localStorage.
 * @source
 */
const DEBUG_FEATURE_TOGGLES_KEY = "debug-feature-toggles";

/**
 * Maximum number of debug event log entries retained in memory.
 * Oldest entries are discarded when this limit is exceeded.
 * @source
 */
const MAX_EVENT_LOG_ENTRIES = 500;

/**
 * Configuration of debug feature toggles (storage debugger, log viewer, state inspector, etc.).
 * Each toggle controls a separate debugging feature that can be enabled/disabled independently.
 * @source
 */
type DebugFeatureToggles = {
  storageDebugger: boolean;
  logViewer: boolean;
  stateInspector: boolean;
  ipcViewer: boolean;
  redactLogs: boolean;
  eventLogger: boolean;
  confidenceTestExporter: boolean;
  performanceMonitor: boolean;
};

/**
 * Default state for all debug feature toggles (all disabled for production safety).
 * @source
 */
const DEFAULT_FEATURE_TOGGLES: DebugFeatureToggles = {
  storageDebugger: false,
  logViewer: false,
  stateInspector: false,
  ipcViewer: false,
  redactLogs: true,
  eventLogger: false,
  confidenceTestExporter: false,
  performanceMonitor: false,
};

/**
 * Optional configuration for recording debug events with extended behavior control.
 * @property force - If true, logs event even when debug mode or event logger is disabled.
 * @source
 */
interface RecordEventOptions {
  force?: boolean;
}

/**
 * Configuration for registering a state inspector source.
 * @template T - The type of state being inspected.
 * @source
 */
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

/**
 * Internal state inspector source tracking raw and display values.
 * @source
 */
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

/**
 * Serializable snapshot of a state inspector source for display.
 * @source
 */
export interface StateInspectorSourceSnapshot {
  id: string;
  label: string;
  description?: string;
  group: string;
  value: unknown;
  lastUpdated: number;
  canEdit: boolean;
}

/**
 * Handle to publish updates and unregister a state inspector.
 * @template T - The type of state being inspected.
 * @source
 */
export interface StateInspectorHandle<T> {
  publish: (value: T) => void;
  unregister: () => void;
}

/**
 * Settings configuration snapshot for debug inspection.
 * Includes explicit customRules field for easier UI access and clarity.
 * @source
 */
interface SettingsDebugSnapshot {
  syncConfig: SyncConfig;
  matchConfig: MatchConfig;
  customRules?: MatchConfig["customRules"];
}

/**
 * Converts internal state inspector sources to serializable snapshots, sorted by group and label.
 * @param sources - Map of state inspector sources.
 * @returns Array of serializable source snapshots.
 * @source
 */
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
 * Provides comprehensive debug context to child components with split context pattern.
 * Manages debug mode, feature toggles, console log interception, IPC monitoring,
 * state inspection, event logging, and performance metrics collection.
 *
 * **Features:**
 * - Console log interception with optional redaction of sensitive data
 * - State inspection with time-travel debugging via registered state sources
 * - IPC communication tracking and visualization
 * - Debug event logging with optional force-logging override
 * - Performance metrics collection (API latency, cache stats, memory usage)
 * - Settings state inspector for live configuration editing
 * - Adaptive memory polling when performance monitor is enabled
 *
 * @param children - React children to wrap with debug context.
 * @returns Provider component with split contexts for state and actions.
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
  const [debugMenuOpen, setDebugMenuOpen] = useState(false);
  const stateSourcesRef = useRef(
    new Map<string, StateInspectorSourceInternal>(),
  );
  const [performanceMetrics, setPerformanceMetrics] =
    useState<PerformanceMetrics>(DEFAULT_PERFORMANCE_METRICS);
  const memoryPollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const pendingApiSamplesRef = useRef<
    Array<{
      duration: number;
      success: boolean;
      correlationId?: string;
      provider?: string;
      endpoint?: string;
    }>
  >([]);
  const fpsMonitorRef = useRef<FPSMonitor | null>(null);
  const [currentFPS, setCurrentFPS] = useState<number>(60);

  const storageDebuggerEnabled = featureToggles.storageDebugger;
  const logViewerEnabled = featureToggles.logViewer;
  const logRedactionEnabled = featureToggles.redactLogs;
  const stateInspectorEnabled = featureToggles.stateInspector;
  const ipcViewerEnabled = featureToggles.ipcViewer;
  const eventLoggerEnabled = featureToggles.eventLogger;
  const performanceMonitorEnabled = featureToggles.performanceMonitor;

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

  /**
   * Records a debug event to the event log when debug mode or forcing is enabled.
   * @param entry - The debug event to record.
   * @param options - Optional force flag to log even when debug mode is disabled.
   * @source
   */
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

  const setConfidenceTestExporterEnabled = useCallback(
    (enabled: boolean) => {
      persistFeatureToggles((prev) => ({
        ...prev,
        confidenceTestExporter: enabled,
      }));
      recordEvent(
        {
          type: "debug.confidence-test-exporter",
          message: enabled
            ? "Confidence test exporter enabled"
            : "Confidence test exporter disabled",
          level: enabled ? "info" : "warn",
          metadata: { enabled },
        },
        { force: true },
      );
    },
    [persistFeatureToggles, recordEvent],
  );

  const toggleConfidenceTestExporter = useCallback(() => {
    setConfidenceTestExporterEnabled(!featureToggles.confidenceTestExporter);
  }, [featureToggles.confidenceTestExporter, setConfidenceTestExporterEnabled]);

  const setPerformanceMonitorEnabled = useCallback(
    (enabled: boolean) => {
      persistFeatureToggles((prev) => ({
        ...prev,
        performanceMonitor: enabled,
      }));
      recordEvent(
        {
          type: "debug.performance-monitor",
          message: enabled
            ? "Performance monitor enabled"
            : "Performance monitor disabled",
          level: enabled ? "info" : "warn",
          metadata: { enabled },
        },
        { force: true },
      );
    },
    [persistFeatureToggles, recordEvent],
  );

  const togglePerformanceMonitor = useCallback(() => {
    setPerformanceMonitorEnabled(!featureToggles.performanceMonitor);
  }, [featureToggles.performanceMonitor, setPerformanceMonitorEnabled]);

  const flushPendingApiSamples = useCallback(() => {
    const samples = pendingApiSamplesRef.current;
    if (samples.length === 0) return;

    // Collect high-latency events to record after state update
    const highLatencyEvents: Array<{
      duration: number;
      correlationId?: string;
      provider?: string;
      endpoint?: string;
    }> = [];

    setPerformanceMetrics((prev) => {
      // Validate array before adding
      if (!Array.isArray(prev.api.recentLatencies)) {
        console.warn("[DebugContext] recentLatencies is not an array");
        return prev;
      }

      const newLatencies = prev.api.recentLatencies.filter(Number.isFinite);
      let newSamples: ApiLatencySample[] = [...prev.api.recentSamples];
      let totalRequests = prev.api.totalRequests;
      let successfulRequests = prev.api.successfulRequests;
      let failedRequests = prev.api.failedRequests;

      // Process all pending samples
      for (const sample of samples) {
        totalRequests += 1;
        if (sample.success) {
          successfulRequests += 1;
        } else {
          failedRequests += 1;
        }

        newLatencies.push(sample.duration);
        // Use lowercase string for provider to ensure consistency in charts
        const providerKey = String(sample.provider ?? "anilist").toLowerCase();
        newSamples.push({
          duration: sample.duration,
          provider: providerKey,
          endpoint: sample.endpoint,
        });

        // Collect high latency events for recording after state update
        if (sample.duration > 2000) {
          highLatencyEvents.push({
            duration: sample.duration,
            correlationId: sample.correlationId,
            provider: sample.provider,
            endpoint: sample.endpoint,
          });
        }
      }

      // Keep last 100 samples
      const latenciesSliced = newLatencies.slice(-100);
      newSamples = newSamples.slice(-100);

      // Calculate new average safely
      const newAverage =
        latenciesSliced.length > 0
          ? latenciesSliced.reduce((sum, val) => sum + val, 0) /
            latenciesSliced.length
          : 0;

      // Use finite sentinel for min latency to avoid Infinity
      const currentMin =
        Number.isFinite(prev.api.minLatency) && prev.api.minLatency < Infinity
          ? prev.api.minLatency
          : Number.MAX_SAFE_INTEGER;

      return {
        ...prev,
        api: {
          totalRequests,
          successfulRequests,
          failedRequests,
          averageLatency: Math.round(newAverage * 100) / 100,
          minLatency: Math.min(currentMin, ...latenciesSliced),
          maxLatency: Math.max(prev.api.maxLatency, ...latenciesSliced),
          recentLatencies: latenciesSliced,
          recentSamples: newSamples,
          errorRate: (failedRequests / totalRequests) * 100,
        },
      };
    });

    // Record high latency events after state update completes
    for (const event of highLatencyEvents) {
      recordEvent({
        type: "performance.api-latency",
        message: `High API latency detected: ${event.duration.toFixed(0)}ms`,
        level: "warn",
        metadata: {
          duration: event.duration,
          correlationId: event.correlationId,
          provider: event.provider,
          endpoint: event.endpoint,
        },
      });
    }

    // Clear pending samples after flush
    pendingApiSamplesRef.current = [];
  }, [recordEvent]);

  const throttledFlush = useMemo(
    () => throttle(flushPendingApiSamples, 250),
    [flushPendingApiSamples],
  );

  const recordApiLatency = useCallback(
    (
      duration: number,
      success: boolean,
      correlationId?: string,
      provider?: string,
      endpoint?: string,
    ) => {
      if (!featureToggles.performanceMonitor) return;

      // Validate duration: ignore non-finite values, clamp at 0
      if (!Number.isFinite(duration) || duration < 0) {
        console.warn("[DebugContext] Invalid API latency duration:", duration);
        return;
      }

      // Push sample to pending ref
      pendingApiSamplesRef.current.push({
        duration,
        success,
        correlationId,
        provider,
        endpoint,
      });

      // Schedule throttled flush
      throttledFlush();
    },
    [featureToggles.performanceMonitor, throttledFlush],
  );

  const recordCacheAccess = useCallback(
    (hit: boolean) => {
      if (!featureToggles.performanceMonitor) return;

      setPerformanceMetrics((prev) => {
        const newHits = hit ? prev.cache.hits + 1 : prev.cache.hits;
        const newMisses = hit ? prev.cache.misses : prev.cache.misses + 1;
        const total = newHits + newMisses;

        return {
          ...prev,
          cache: {
            ...prev.cache,
            hits: newHits,
            misses: newMisses,
            hitRate: total > 0 ? (newHits / total) * 100 : 0,
          },
        };
      });
    },
    [featureToggles.performanceMonitor],
  );

  const recordMatchingProgress = useCallback(
    (current: number, total: number, elapsedMs: number) => {
      if (!featureToggles.performanceMonitor) return;

      setPerformanceMetrics((prev) => {
        const speed = elapsedMs > 0 ? (current / elapsedMs) * 60000 : 0; // titles per minute

        return {
          ...prev,
          matching: {
            totalMatched: current,
            averageSpeed: Math.round(speed * 10) / 10,
            currentSpeed: Math.round(speed * 10) / 10,
            totalDuration: elapsedMs,
            lastUpdateTimestamp: Date.now(),
          },
        };
      });
    },
    [featureToggles.performanceMonitor],
  );

  const updateMemoryStats = useCallback(
    (stats: MemoryMetrics) => {
      if (!featureToggles.performanceMonitor) return;

      setPerformanceMetrics((prev) => {
        const newHistory = [...prev.memory.history, stats].slice(-50); // Keep last 50 samples

        return {
          ...prev,
          memory: {
            current: stats,
            history: newHistory,
          },
        };
      });

      // Warn if memory usage is high (>500MB private)
      if (stats.private > 512000) {
        recordEvent({
          type: "performance.memory-high",
          message: `High memory usage: ${(stats.private / 1024).toFixed(0)}MB`,
          level: "warn",
          metadata: { private: stats.private, heap: stats.heap },
        });
      }
    },
    [featureToggles.performanceMonitor, recordEvent],
  );

  const resetPerformanceMetrics = useCallback(() => {
    setPerformanceMetrics(DEFAULT_PERFORMANCE_METRICS);
    recordEvent({
      type: "debug.performance-monitor",
      message: "Performance metrics reset",
      level: "info",
    });
  }, [recordEvent]);

  const exportPerformanceReport = useCallback(() => {
    try {
      const sessionDuration = Date.now() - performanceMetrics.sessionStartTime;
      const payload = {
        exportedAt: new Date().toISOString(),
        appVersion: import.meta.env.VITE_APP_VERSION || "unknown",
        sessionDuration,
        metrics: performanceMetrics,
      };

      exportToJson(payload, "kenmei-performance-report");
      recordEvent({
        type: "debug.performance-monitor",
        message: "Performance report exported",
        level: "info",
        metadata: { sessionDuration },
      });
    } catch (error) {
      console.error("Failed to export performance report:", error);
      recordEvent(
        {
          type: "debug.performance-monitor",
          message: "Failed to export performance report",
          level: "error",
          metadata: {
            error: error instanceof Error ? error.message : String(error),
          },
        },
        { force: true },
      );
    }
  }, [performanceMetrics, recordEvent]);

  // Debug menu open/close state
  const openDebugMenu = useCallback(() => setDebugMenuOpen(true), []);
  const closeDebugMenu = useCallback(() => setDebugMenuOpen(false), []);
  const toggleDebugMenu = useCallback(() => setDebugMenuOpen((v) => !v), []);

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
        getSnapshot: () => {
          const matchConfig = getMatchConfig();
          return {
            syncConfig: getSyncConfig(),
            matchConfig: matchConfig,
            customRules: matchConfig.customRules,
          };
        },
        setSnapshot: (snapshot) => {
          if (snapshot.syncConfig) {
            saveSyncConfig(snapshot.syncConfig);
          }
          if (snapshot.matchConfig) {
            saveMatchConfig(snapshot.matchConfig);
          }
          // If customRules are provided separately, merge them back into matchConfig
          if (snapshot.customRules && snapshot.matchConfig) {
            snapshot.matchConfig.customRules = snapshot.customRules;
            saveMatchConfig(snapshot.matchConfig);
          }
        },
        serialize: (snapshot) => ({
          syncConfig: snapshot.syncConfig,
          matchConfig: snapshot.matchConfig,
          customRules: snapshot.customRules,
        }),
        deserialize: (value) => {
          const candidate = value as Partial<SettingsDebugSnapshot> | null;
          const matchConfig = candidate?.matchConfig ?? getMatchConfig();
          return {
            syncConfig: candidate?.syncConfig ?? getSyncConfig(),
            matchConfig: matchConfig,
            customRules: candidate?.customRules ?? matchConfig.customRules,
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

      exportToJson(payload, "kenmei-debug-logs");
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
  }, [recordEvent]);

  // Poll memory stats when performance monitor is enabled
  useEffect(() => {
    if (!isDebugEnabled || !featureToggles.performanceMonitor) {
      if (memoryPollingIntervalRef.current) {
        clearInterval(memoryPollingIntervalRef.current);
        memoryPollingIntervalRef.current = null;
      }
      return;
    }

    const pollMemory = async () => {
      try {
        if (globalThis.electronDebug?.getMemoryStats) {
          const stats = await globalThis.electronDebug.getMemoryStats();
          updateMemoryStats(stats);
        }
      } catch (error) {
        console.error("Failed to poll memory stats:", error);
      }
    };

    // Poll immediately, then every 2.5 seconds
    pollMemory();
    memoryPollingIntervalRef.current = setInterval(pollMemory, 2500);

    return () => {
      if (memoryPollingIntervalRef.current) {
        clearInterval(memoryPollingIntervalRef.current);
        memoryPollingIntervalRef.current = null;
      }
    };
  }, [isDebugEnabled, featureToggles.performanceMonitor, updateMemoryStats]);

  // Monitor FPS when performance monitor is enabled
  useEffect(() => {
    if (!isDebugEnabled || !featureToggles.performanceMonitor) {
      // Cancel throttled flush and clear pending samples on disable
      throttledFlush.cancel?.();
      pendingApiSamplesRef.current = [];

      if (fpsMonitorRef.current) {
        fpsMonitorRef.current.stop();
        fpsMonitorRef.current = null;
      }
      return;
    }

    const fpsMonitor = new FPSMonitor({
      threshold: 30,
      sampleSize: 60,
      onLowFPS: (fps) => {
        recordEvent({
          type: "performance.low-fps",
          message: `Low FPS detected: ${fps.toFixed(1)}`,
          level: "warn",
          metadata: { fps },
        });
      },
    });

    fpsMonitorRef.current = fpsMonitor;
    fpsMonitor.start();

    // Update FPS state every second
    const fpsInterval = setInterval(() => {
      setCurrentFPS(fpsMonitor.getAverageFPS());
    }, 1000);

    return () => {
      clearInterval(fpsInterval);
      // Cancel throttled flush and clear pending samples on unmount
      throttledFlush.cancel?.();
      pendingApiSamplesRef.current = [];

      if (fpsMonitorRef.current) {
        fpsMonitorRef.current.stop();
        fpsMonitorRef.current = null;
      }
    };
  }, [
    isDebugEnabled,
    featureToggles.performanceMonitor,
    recordEvent,
    throttledFlush,
  ]);

  // Listen for API performance events
  useEffect(() => {
    if (!isDebugEnabled || !featureToggles.performanceMonitor) return;

    const handleApiPerformance = (event: Event) => {
      const customEvent = event as CustomEvent<{
        duration: number;
        succeeded: boolean;
        requestId?: string;
        provider?: string;
        endpoint?: string;
      }>;
      const { duration, succeeded, requestId, provider, endpoint } =
        customEvent.detail;
      recordApiLatency(duration, succeeded, requestId, provider, endpoint);
    };

    globalThis.addEventListener(
      "anilist:request:performance",
      handleApiPerformance,
    );
    globalThis.addEventListener(
      "anilist:request:completed",
      handleApiPerformance,
    );

    // Listen for generic API requests (from manga sources, etc.)
    const handleGenericApiRequest = (event: Event) => {
      const customEvent = event as CustomEvent<{
        duration: number;
        succeeded: boolean;
        provider?: string;
        endpoint?: string;
      }>;
      const { duration, succeeded, provider, endpoint } = customEvent.detail;
      recordApiLatency(duration, succeeded, undefined, provider, endpoint);
    };

    globalThis.addEventListener(
      "api:request:completed",
      handleGenericApiRequest,
    );

    return () => {
      globalThis.removeEventListener(
        "anilist:request:performance",
        handleApiPerformance,
      );
      globalThis.removeEventListener(
        "anilist:request:completed",
        handleApiPerformance,
      );
      globalThis.removeEventListener(
        "api:request:completed",
        handleGenericApiRequest,
      );
    };
  }, [isDebugEnabled, featureToggles.performanceMonitor, recordApiLatency]);

  // Listen for cache hit/miss events
  useEffect(() => {
    if (!isDebugEnabled || !featureToggles.performanceMonitor) return;

    const handleCacheHit = () => recordCacheAccess(true);
    const handleCacheMiss = () => recordCacheAccess(false);

    globalThis.addEventListener("matching:cache-hit", handleCacheHit);
    globalThis.addEventListener("matching:cache-miss", handleCacheMiss);

    return () => {
      globalThis.removeEventListener("matching:cache-hit", handleCacheHit);
      globalThis.removeEventListener("matching:cache-miss", handleCacheMiss);
    };
  }, [isDebugEnabled, featureToggles.performanceMonitor, recordCacheAccess]);

  // Listen for matching progress events
  useEffect(() => {
    if (!isDebugEnabled || !featureToggles.performanceMonitor) return;

    const handleMatchingProgress = (event: Event) => {
      const customEvent = event as CustomEvent<{
        current: number;
        total: number;
        elapsedMs: number;
      }>;
      const { current, total, elapsedMs } = customEvent.detail;
      recordMatchingProgress(current, total, elapsedMs);
    };

    globalThis.addEventListener(
      "matching:progress-update",
      handleMatchingProgress,
    );

    return () => {
      globalThis.removeEventListener(
        "matching:progress-update",
        handleMatchingProgress,
      );
    };
  }, [
    isDebugEnabled,
    featureToggles.performanceMonitor,
    recordMatchingProgress,
  ]);

  const stateContextValue = React.useMemo<DebugStateContextValue>(
    () => ({
      isDebugEnabled,
      debugMenuOpen,
      storageDebuggerEnabled,
      logViewerEnabled,
      logRedactionEnabled,
      stateInspectorEnabled,
      stateInspectorSources: stateSourceSnapshots,
      ipcViewerEnabled,
      eventLoggerEnabled,
      confidenceTestExporterEnabled: featureToggles.confidenceTestExporter,
      performanceMonitorEnabled,
      performanceMetrics,
      currentFPS,
      eventLogEntries,
      maxEventLogEntries: MAX_EVENT_LOG_ENTRIES,
      ipcEvents,
      maxIpcEntries,
      logEntries,
      maxLogEntries: MAX_LOG_ENTRIES,
    }),
    [
      currentFPS,
      debugMenuOpen,
      eventLogEntries,
      eventLoggerEnabled,
      featureToggles.confidenceTestExporter,
      performanceMonitorEnabled,
      performanceMetrics,
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
      openDebugMenu,
      closeDebugMenu,
      toggleDebugMenu,
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
      setConfidenceTestExporterEnabled,
      toggleConfidenceTestExporter,
      setPerformanceMonitorEnabled,
      togglePerformanceMonitor,
      recordApiLatency,
      recordCacheAccess,
      recordMatchingProgress,
      updateMemoryStats,
      resetPerformanceMetrics,
      exportPerformanceReport,
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
      exportPerformanceReport,
      recordApiLatency,
      recordCacheAccess,
      recordEvent,
      recordMatchingProgress,
      refreshStateInspectorSource,
      registerStateInspector,
      resetPerformanceMetrics,
      setConfidenceTestExporterEnabled,
      setDebugEnabled,
      setEventLoggerEnabled,
      setIpcViewerEnabled,
      setLogRedactionEnabled,
      setLogViewerEnabled,
      setPerformanceMonitorEnabled,
      setStateInspectorEnabled,
      setStorageDebuggerEnabled,
      toggleConfidenceTestExporter,
      toggleDebug,
      toggleEventLogger,
      toggleIpcViewer,
      toggleLogRedaction,
      toggleLogViewer,
      togglePerformanceMonitor,
      toggleStateInspector,
      toggleStorageDebugger,
      updateMemoryStats,
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

/**
 * Hook to access debug state (read-only) via DebugStateContext.
 * Use this hook when you only need to read debug state without triggering mutations.
 * @returns The debug state context value.
 * @throws {Error} If used outside a DebugProvider.
 * @source
 */
export function useDebugState(): DebugStateContextValue {
  const context = useContext(DebugStateContext);
  if (context === undefined) {
    throw new Error("useDebugState must be used within a DebugProvider");
  }
  return context;
}

/**
 * Hook to access debug actions (mutations) via DebugActionsContext.
 * Use this hook when you need to perform debug state mutations without subscribing to state changes.
 * @returns The debug actions context value.
 * @throws {Error} If used outside a DebugProvider.
 * @source
 */
export function useDebugActions(): DebugActionsContextValue {
  const context = useContext(DebugActionsContext);
  if (context === undefined) {
    throw new Error("useDebugActions must be used within a DebugProvider");
  }
  return context;
}

/**
 * Hook to access complete debug context (both state and actions combined).
 * Prefers split contexts but falls back to legacy unified context for backward compatibility.
 * Use `useDebugState` or `useDebugActions` separately when possible for better performance.
 * @returns The complete debug context value.
 * @throws {Error} If used outside a DebugProvider.
 * @source
 */
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
