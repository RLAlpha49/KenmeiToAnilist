/**
 * @packageDocumentation
 * @module logging
 * @description Lightweight log collector for capturing console output in production builds.
 */

export type LogLevel = "log" | "info" | "warn" | "error" | "debug";

/**
 * Individual captured log entry.
 */
export interface LogEntry {
  /** Unique identifier for the log entry. */
  id: string;
  /** Log severity level based on the originating console method. */
  level: LogLevel;
  /** Primary message extracted from the first argument. */
  message: string;
  /** Additional details derived from remaining console arguments. */
  details: string[];
  /** ISO timestamp representing when the log entry was captured. */
  timestamp: string;
  /** Optional stack trace snippet to help identify the source of the log. */
  source?: string;
  /** Whether the entry is considered a debug-only message. */
  isDebug?: boolean;
}

const LOG_LEVELS: LogLevel[] = ["error", "warn", "info", "log", "debug"];
export const MAX_LOG_ENTRIES = 1000;

/**
 * Generates a reasonably unique identifier for log entries.
 */
const generateLogId = (): string => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(16).slice(2, 10)}`;
};

/**
 * Attempts to convert a console argument into a serialisable string.
 */
const serialiseArgument = (value: unknown): string => {
  if (value instanceof Error) {
    const stack = value.stack?.split("\n").slice(0, 5).join("\n");
    return value.name + ": " + value.message + (stack ? "\n" + stack : "");
  }

  if (typeof value === "string") {
    return value;
  }

  if (value === undefined) {
    return "undefined";
  }

  if (value === null) {
    return "null";
  }

  if (
    typeof value === "number" ||
    typeof value === "boolean" ||
    typeof value === "bigint"
  ) {
    return String(value);
  }

  if (typeof value === "symbol") {
    return value.toString();
  }

  if (typeof value === "function") {
    return value.toString();
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch (error) {
    const errorMessage =
      error instanceof Error
        ? `${error.name}: ${error.message}`
        : Object.prototype.toString.call(error);
    return `Unserialisable value (${errorMessage})`;
  }
};

/**
 * Simple implementation of console-like format string replacement.
 * Supports %s, %d, %i, %f, %o, %O and falls back to string conversion.
 * For %o/%O, objects are JSON-stringified if possible, otherwise '[object Object]'.
 */
const applyFormat = (format: string, args: unknown[]): string => {
  let i = 0;
  // Use replaceAll for each supported token
  const tokens = ["%%", "%s", "%d", "%i", "%f", "%o", "%O", "%c"];
  let result = format;
  for (const token of tokens) {
    result = result.replaceAll(token, () => {
      if (token === "%%") return "%";
      const arg = args[i++];
      if (arg === undefined) return "";
      switch (token) {
        case "%s":
          return String(arg);
        case "%d":
        case "%i":
          return Number(arg).toString();
        case "%f":
          return Number.parseFloat(String(arg)).toString();
        case "%o":
        case "%O":
          if (typeof arg === "object" && arg !== null) {
            try {
              return JSON.stringify(arg);
            } catch {
              return "[object Object]";
            }
          }
          return String(arg);
        case "%c":
          // CSS specifier - ignore in serialised output
          return "";
        default:
          return String(arg);
      }
    });
  }
  return result;
};

/** Count how many format placeholders in `format` will consume an argument. */
const countPlaceholders = (format: string): number => {
  const matches = Array.from(format.matchAll(/%[sdifoOc%]/g));
  let count = 0;
  for (const m of matches) {
    const token = m[0];
    if (token === "%%" || token === "%c") continue;
    count += 1;
  }
  return count;
};

/**
 * Attempts to extract a meaningful source line from a stack trace.
 */
const extractSourceFromStack = (stack?: string): string | undefined => {
  if (!stack) return undefined;
  return (
    stack
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line && !line.includes("logging.ts"))
      .slice(1, 3)
      .join("\n")
      .trim() || undefined
  );
};

/**
 * Determines whether a log entry should be treated as a debug-focused message.
 */
const inferIsDebug = (level: LogLevel, message: string): boolean => {
  if (level === "debug") return true;
  const lower = message.toLowerCase();
  return lower.startsWith("[debug]") || lower.includes("debug:");
};

class LogCollector {
  #entries: LogEntry[] = [];
  readonly #listeners = new Set<(entries: LogEntry[]) => void>();

  getEntries(): LogEntry[] {
    return this.#entries;
  }

  subscribe(listener: (entries: LogEntry[]) => void): () => void {
    this.#listeners.add(listener);
    listener(this.#entries);
    return () => {
      this.#listeners.delete(listener);
    };
  }

  addEntry(level: LogLevel, args: unknown[]): void {
    const timestamp = new Date().toISOString();
    const [primary, ...rest] = args;

    let message = "";
    let details: string[] = [];

    if (
      typeof primary === "string" &&
      /%[sdifoOc%]/.test(primary) &&
      rest.length
    ) {
      // apply format specifiers against the first N args; remaining args become details
      const consumed = countPlaceholders(primary);
      const consumedArgs = rest.slice(0, consumed);
      message = applyFormat(primary, consumedArgs);
      details = rest.slice(consumed).map(serialiseArgument);
    } else {
      message =
        primary === undefined && rest.length === 0
          ? ""
          : serialiseArgument(primary);
      details = rest.map(serialiseArgument);
    }

    const entry: LogEntry = {
      id: generateLogId(),
      level,
      message,
      details,
      timestamp,
      source: extractSourceFromStack(new Error(message).stack),
      isDebug: inferIsDebug(level, message),
    };

    this.#entries = [...this.#entries, entry].slice(-MAX_LOG_ENTRIES);
    this.#notify();
  }

  clear(): void {
    this.#entries = [];
    this.#notify();
  }

  #notify() {
    const snapshot = this.#entries;
    for (const listener of this.#listeners) {
      listener(snapshot);
    }
  }
}

export const logCollector = new LogCollector();

let interceptorInstalled = false;
const originalConsoleMethods = new Map<
  LogLevel,
  (...args: unknown[]) => void
>();

type ConsoleMethod = (...args: unknown[]) => void;
const assignableConsole = console as Console & Record<LogLevel, ConsoleMethod>;

/**
 * Installs console interceptors so that log entries can be captured.
 * Returns a cleanup function that restores original console methods.
 */
export function installConsoleInterceptor(): () => void {
  if (interceptorInstalled) {
    return () => {
      // no-op cleanup when already installed by another consumer
    };
  }

  if (typeof globalThis.window === "undefined") {
    return () => {
      // no console interception in non-browser environments
    };
  }

  for (const level of LOG_LEVELS) {
    const original =
      assignableConsole[level]?.bind(console) ?? console.log.bind(console);
    originalConsoleMethods.set(level, original);

    assignableConsole[level] = (...args: unknown[]) => {
      logCollector.addEntry(level, args);
      original(...args);
    };
  }

  interceptorInstalled = true;

  return () => {
    if (!interceptorInstalled) return;
    for (const level of LOG_LEVELS) {
      const original = originalConsoleMethods.get(level);
      if (original) {
        assignableConsole[level] = original;
      }
    }
    interceptorInstalled = false;
    originalConsoleMethods.clear();
  };
}

export interface SerializableLogEntry {
  id: string;
  level: LogLevel;
  message: string;
  details: string[];
  timestamp: string;
  source?: string;
  isDebug?: boolean;
}

/**
 * Prepares log entries for exporting to a JSON file.
 */
export function serialiseLogEntries(
  entries: LogEntry[],
): SerializableLogEntry[] {
  return entries.map(
    ({ id, level, message, details, timestamp, source, isDebug }) => ({
      id,
      level,
      message,
      details,
      timestamp,
      source,
      isDebug,
    }),
  );
}
