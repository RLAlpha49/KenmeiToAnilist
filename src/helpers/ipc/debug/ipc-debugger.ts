/**
 * @packageDocumentation
 * @module ipc_debugger
 * @description Instrumentation utilities for capturing IPC activity between the renderer and main processes.
 */

import { contextBridge, ipcRenderer, type IpcRendererEvent } from "electron";
import type { IpcLogEntry, IpcLogPayload } from "@/types/debug";

export const MAX_IPC_LOG_ENTRIES = 500;

const generateId = (): string => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(16).slice(2, 10)}`;
};

const nowMs = (): number => {
  if (
    typeof performance !== "undefined" &&
    typeof performance.now === "function"
  ) {
    return performance.now();
  }
  return Date.now();
};

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
    if (typeof structuredClone === "function") {
      return structuredClone(value);
    }
  } catch {
    // Ignore clone failures and fall back to JSON/string representations.
  }

  if (value && typeof value === "object") {
    try {
      return typeof structuredClone === "function"
        ? structuredClone(value)
        : JSON.parse(JSON.stringify(value));
    } catch {
      return Object.prototype.toString.call(value);
    }
  }

  return value;
};

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

const createPayload = (value: unknown): IpcLogPayload => {
  const raw = safeClone(value);
  return {
    raw,
    preview: summarise(raw),
  };
};

class IpcEventCollector {
  #entries: IpcLogEntry[] = [];
  readonly #listeners = new Set<(entries: IpcLogEntry[]) => void>();

  addEntry(entry: IpcLogEntry) {
    this.#entries = [...this.#entries, entry].slice(-MAX_IPC_LOG_ENTRIES);
    this.#notify();
  }

  clear() {
    if (!this.#entries.length) return;
    this.#entries = [];
    this.#notify();
  }

  getEntries(): IpcLogEntry[] {
    return this.#entries;
  }

  subscribe(listener: (entries: IpcLogEntry[]) => void): () => void {
    this.#listeners.add(listener);
    listener(this.#entries);
    return () => {
      this.#listeners.delete(listener);
    };
  }

  #notify() {
    const snapshot = this.#entries;
    for (const listener of this.#listeners) {
      listener(snapshot);
    }
  }
}

const collector = new IpcEventCollector();

const appendEvent = (entry: Omit<IpcLogEntry, "id"> & { id?: string }) => {
  if (!enabled) return; // Only track when debugging is enabled
  collector.addEntry({
    ...entry,
    id: entry.id ?? generateId(),
  });
};

type RendererListener = (event: IpcRendererEvent, ...args: unknown[]) => void;

const listenerMap = new WeakMap<RendererListener, RendererListener>();

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

let installed = false;
let enabled = false;

export function setIpcDebuggingEnabled(value: boolean): void {
  enabled = value;
}

export function isIpcDebuggingEnabled(): boolean {
  return enabled;
}

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
  });
}
