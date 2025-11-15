/**
 * @packageDocumentation
 * @module ipc-debugger
 * @description Instrumentation utilities for capturing IPC activity between the renderer and main processes.
 */

import { contextBridge, ipcRenderer, type IpcRendererEvent } from "electron";
import type { IpcLogEntry, IpcLogPayload } from "@/types/debug";

/** Maximum number of IPC log entries to retain in memory. @source */
export const MAX_IPC_LOG_ENTRIES = 500;

/**
 * Generates a unique identifier using crypto.randomUUID or a fallback timestamp-based approach.
 * @returns A unique string identifier for correlating IPC events.
 * @internal
 * @source
 */
const generateId = (): string => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(16).slice(2, 10)}`;
};

/**
 * Gets the current timestamp in milliseconds using performance.now() or fallback.
 * @returns Current time in milliseconds.
 * @internal
 * @source
 */
const nowMs = (): number => {
  if (
    typeof performance !== "undefined" &&
    typeof performance.now === "function"
  ) {
    return performance.now();
  }
  return Date.now();
};

/**
 * Safely clones a value, handling Error, BigInt, Symbol, and Function types.
 * Falls back to structuredClone or Object.prototype.toString.call for unsupported types.
 * @param value - The value to clone.
 * @returns A safely cloned copy of the value.
 * @internal
 * @source
 */
const safeClone = (value: unknown): unknown => {
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack,
    };
  }

  if (typeof value === "bigint") {
    return value.toString();
  }

  if (typeof value === "symbol") {
    return value.toString();
  }

  if (typeof value === "function") {
    return `[Function ${value.name || "anonymous"}]`;
  }

  try {
    return structuredClone(value);
  } catch {
    return Object.prototype.toString.call(value);
  }
};

/**
 * Summarizes a value for logging display, truncating long strings and JSON to 200 characters.
 * @param value - The value to summarize.
 * @returns A string representation suitable for display in logs.
 * @internal
 * @source
 */
const summarise = (value: unknown): string => {
  if (value === undefined) return "undefined";
  if (value === null) return "null";
  if (typeof value === "string") {
    return value.length > 200 ? `${value.slice(0, 200)}…` : value;
  }
  if (
    typeof value === "number" ||
    typeof value === "boolean" ||
    typeof value === "bigint"
  ) {
    return String(value);
  }
  if (typeof value === "symbol" || typeof value === "function") {
    return String(value);
  }
  if (value instanceof Error) {
    return `${value.name}: ${value.message}`;
  }
  try {
    const json = JSON.stringify(value, null, 2);
    if (!json) return Object.prototype.toString.call(value);
    return json.length > 200 ? `${json.slice(0, 200)}…` : json;
  } catch {
    return Object.prototype.toString.call(value);
  }
};

/**
 * Redacts sensitive data from payloads for security.
 * Masks common secrets like Authorization headers, tokens, and client secrets.
 * @param value - The value to potentially redact.
 * @returns Redacted copy of value.
 * @internal
 * @source
 */
const redactSensitiveData = (value: unknown): unknown => {
  if (typeof value === "string") {
    // Mask tokens, auth headers, API keys, etc.
    const sensitivePatterns = [
      /Bearer\s+[\w\-.]+/gi,
      /Authorization:\s*[\w\-.]+/gi,
      /token["s:=]+[\w\-.]+/gi,
      /secret["s:=]+[\w\-.]+/gi,
      /password["s:=]+[\w\-.]+/gi,
      /api[_-]?key["s:=]+[\w\-.]+/gi,
    ];
    let redacted = value;
    for (const pattern of sensitivePatterns) {
      redacted = redacted.replace(pattern, "[REDACTED]");
    }
    return redacted;
  }

  if (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    !(value instanceof Error)
  ) {
    const obj = value as Record<string, unknown>;
    const redacted: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(obj)) {
      const lowerKey = key.toLowerCase();
      if (
        lowerKey.includes("token") ||
        lowerKey.includes("auth") ||
        lowerKey.includes("secret") ||
        lowerKey.includes("password") ||
        lowerKey.includes("key")
      ) {
        redacted[key] = "[REDACTED]";
      } else {
        redacted[key] = redactSensitiveData(val);
      }
    }
    return redacted;
  }

  if (Array.isArray(value)) {
    return value.map((item) => redactSensitiveData(item));
  }

  return value;
};

/**
 * Creates a payload object with raw cloned data and a preview summary.
 * Optionally redacts sensitive data before summarizing.
 * @param value - The value to include in the payload.
 * @param redact - Whether to redact sensitive fields (default: false).
 * @returns Payload object with raw and preview fields.
 * @internal
 * @source
 */
const createPayload = (
  value: unknown,
  redact: boolean = false,
): IpcLogPayload => {
  const raw = safeClone(value);
  const processedRaw = redact ? redactSensitiveData(raw) : raw;
  return {
    raw: processedRaw,
    preview: summarise(processedRaw),
  };
};

/**
 * Manages IPC event collection and subscriber notifications.
 * Maintains a fixed-size buffer of recent IPC events and notifies subscribers of changes.
 * @source
 */
class IpcEventCollector {
  #entries: IpcLogEntry[] = [];
  readonly #listeners = new Set<(entries: IpcLogEntry[]) => void>();

  /**
   * Adds a new IPC event to the collection, maintaining the maximum entry limit.
   * @param entry - The IPC log entry to add.
   * @source
   */
  addEntry(entry: IpcLogEntry) {
    this.#entries = [...this.#entries, entry].slice(-MAX_IPC_LOG_ENTRIES);
    this.#notify();
  }

  /**
   * Clears all stored IPC events.
   * @source
   */
  clear() {
    if (!this.#entries.length) return;
    this.#entries = [];
    this.#notify();
  }

  /**
   * Retrieves all stored IPC events.
   * @returns Array of current IPC log entries.
   * @source
   */
  getEntries(): IpcLogEntry[] {
    return this.#entries;
  }

  /**
   * Registers a subscriber to receive IPC event updates.
   * @param listener - Callback invoked with the current entries list when updates occur.
   * @returns Function to unsubscribe the listener.
   * @source
   */
  subscribe(listener: (entries: IpcLogEntry[]) => void): () => void {
    this.#listeners.add(listener);
    listener(this.#entries);
    return () => {
      this.#listeners.delete(listener);
    };
  }

  /**
   * Notifies all subscribers of state changes.
   * @internal
   * @source
   */
  #notify() {
    const snapshot = this.#entries;
    for (const listener of this.#listeners) {
      listener(snapshot);
    }
  }
}

const collector = new IpcEventCollector();

/**
 * Adds an IPC event to the collector if debugging is enabled.
 * @param entry - The IPC event to log (id is auto-generated if missing).
 * @internal
 * @source
 */
const appendEvent = (entry: Omit<IpcLogEntry, "id"> & { id?: string }) => {
  if (!enabled) return; // Only track when debugging is enabled
  collector.addEntry({
    ...entry,
    id: entry.id ?? generateId(),
  });
};

/** Type for IPC renderer event listeners. @internal @source */
type RendererListener = (event: IpcRendererEvent, ...args: unknown[]) => void;

/** Maps original listeners to wrapped listeners for proper cleanup. @internal @source */
const listenerMap = new WeakMap<RendererListener, RendererListener>();

/**
 * Wraps an IPC listener to capture events before invoking the original.
 * @param channel - The IPC channel name.
 * @param listener - The original listener function.
 * @param mode - Registration mode: "on" for persistent, "once" for single-use.
 * @returns The wrapped listener function.
 * @internal
 * @source
 */
const wrapListener = (
  channel: string,
  listener: RendererListener,
  mode: "on" | "once",
) => {
  const existing = listenerMap.get(listener);
  if (existing) {
    return existing;
  }

  const wrapped: RendererListener = (event, ...args) => {
    appendEvent({
      channel,
      direction: "received",
      transport: "event",
      timestamp: new Date().toISOString(),
      payload: createPayload(args),
    });

    if (mode === "once") {
      listenerMap.delete(listener);
    }

    listener(event, ...args);
  };

  listenerMap.set(listener, wrapped);
  return wrapped;
};

/** Tracks if IPC debugging instrumentation is installed. @internal @source */
let installed = false;
/** Controls whether IPC debugging is currently active. @internal @source */
let enabled = false;

/**
 * Enables or disables IPC debugging without affecting the collector.
 * @param value - True to enable, false to disable.
 * @source
 */
export function setIpcDebuggingEnabled(value: boolean): void {
  enabled = value;
}

/**
 * Checks if IPC debugging is currently enabled.
 * @returns True if debugging is enabled, false otherwise.
 * @source
 */
export function isIpcDebuggingEnabled(): boolean {
  return enabled;
}

/**
 * Sets up IPC debugging instrumentation in the preload/renderer context.
 * Wraps ipcRenderer methods to capture and log IPC events.
 * Exposes `electronDebug` object with IPC viewer and memory stats.
 * @source
 */
export function setupIpcDebugging(): void {
  if (installed) return;
  installed = true;

  // Check if IPC debugging should be enabled based on saved preferences
  // This runs in preload context where localStorage is available
  try {
    const debugModeEnabled = localStorage.getItem("debug-mode-enabled");
    const featureToggles = localStorage.getItem("debug-feature-toggles");

    if (debugModeEnabled === "true" && featureToggles) {
      const toggles = JSON.parse(featureToggles);
      if (toggles.ipcViewer === true) {
        enabled = true;
      }
    }
  } catch {
    // Default to disabled if there's any error reading settings
    enabled = false;
  }

  const originalInvoke = ipcRenderer.invoke.bind(ipcRenderer);
  const originalSend = ipcRenderer.send.bind(ipcRenderer);
  const originalPostMessage =
    typeof ipcRenderer.postMessage === "function"
      ? ipcRenderer.postMessage.bind(ipcRenderer)
      : undefined;
  const originalOn = ipcRenderer.on.bind(ipcRenderer);
  const originalOnce = ipcRenderer.once.bind(ipcRenderer);
  const originalAddListener = ipcRenderer.addListener.bind(ipcRenderer);
  const originalRemoveListener = ipcRenderer.removeListener.bind(ipcRenderer);
  const originalOff =
    typeof ipcRenderer.off === "function"
      ? ipcRenderer.off.bind(ipcRenderer)
      : undefined;

  ipcRenderer.invoke = async (channel: string, ...args: unknown[]) => {
    const correlationId = generateId();
    const startedAt = nowMs();

    appendEvent({
      correlationId,
      channel,
      direction: "sent",
      transport: "invoke",
      status: "pending",
      timestamp: new Date().toISOString(),
      payload: createPayload(args),
    });

    try {
      const result = await originalInvoke(channel, ...args);
      const durationMs = Math.max(0, nowMs() - startedAt);
      appendEvent({
        correlationId,
        channel,
        direction: "received",
        transport: "invoke-response",
        status: "fulfilled",
        timestamp: new Date().toISOString(),
        durationMs,
        payload: createPayload(result),
      });
      return result;
    } catch (error) {
      const durationMs = Math.max(0, nowMs() - startedAt);
      appendEvent({
        correlationId,
        channel,
        direction: "received",
        transport: "invoke-response",
        status: "rejected",
        timestamp: new Date().toISOString(),
        durationMs,
        payload: createPayload(
          error instanceof Error
            ? { name: error.name, message: error.message }
            : error,
        ),
        error:
          error instanceof Error
            ? `${error.name}: ${error.message}`
            : String(error),
      });
      throw error;
    }
  };

  ipcRenderer.send = (channel: string, ...args: unknown[]) => {
    appendEvent({
      channel,
      direction: "sent",
      transport: "send",
      timestamp: new Date().toISOString(),
      payload: createPayload(args),
    });
    return originalSend(channel, ...args);
  };

  if (originalPostMessage) {
    ipcRenderer.postMessage = (
      channel: string,
      message: unknown,
      transfer?: MessagePort[],
    ) => {
      appendEvent({
        channel,
        direction: "sent",
        transport: "message",
        timestamp: new Date().toISOString(),
        payload: createPayload({
          message,
          transferDescriptors: transfer?.length ?? 0,
        }),
      });
      return originalPostMessage(channel, message, transfer);
    };
  }

  const assignListener =
    (
      register: (
        channel: string,
        listener: RendererListener,
      ) => typeof ipcRenderer,
      mode: "on" | "once",
    ) =>
    (channel: string, listener: RendererListener) =>
      register(channel, wrapListener(channel, listener, mode));

  ipcRenderer.on = assignListener(originalOn, "on");
  ipcRenderer.addListener = assignListener(originalAddListener, "on");
  ipcRenderer.once = assignListener(originalOnce, "once");

  ipcRenderer.removeListener = (
    channel: string,
    listener: RendererListener,
  ) => {
    const wrapped = listenerMap.get(listener);
    if (wrapped) {
      listenerMap.delete(listener);
      return originalRemoveListener(channel, wrapped);
    }
    return originalRemoveListener(channel, listener);
  };

  if (originalOff) {
    ipcRenderer.off = (channel: string, listener: RendererListener) => {
      const wrapped = listenerMap.get(listener);
      if (wrapped) {
        listenerMap.delete(listener);
        return originalOff(channel, wrapped);
      }
      return originalOff(channel, listener);
    };
  }

  contextBridge.exposeInMainWorld("electronDebug", {
    ipc: {
      maxEntries: MAX_IPC_LOG_ENTRIES,
      getEvents: (): IpcLogEntry[] => collector.getEntries(),
      subscribe: (callback: (entries: IpcLogEntry[]) => void) =>
        collector.subscribe(callback),
      clear: () => collector.clear(),
      setEnabled: (value: boolean) => {
        enabled = value;
        if (!value) {
          collector.clear();
        }
      },
      isEnabled: () => enabled,
    },
    getMemoryStats: () => ipcRenderer.invoke("debug:get-memory-stats"),
  });
}
