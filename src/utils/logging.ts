/**
 * @packageDocumentation
 * @module logging
 * @description Lightweight log collector for capturing console output in production builds.
 */

/**
 * Console group entry with deduplication metadata.
 * @source
 */
type GroupEntry = {
  /** Label used for deduplication logic and display */
  label: string;
  count: number;
  opened: boolean; // whether console.group was actually called for this entry
};

const groupStack: GroupEntry[] = [];

/**
 * Starts a new console group that will contain related log messages.
 *
 * Groups with the same label are automatically deduplicated (incremented) rather than
 * creating nested groups. The group state is tracked by `LogCollector` so group hierarchy
 * is preserved when logs are captured.
 *
 * @param label - The label for the group. Used for both deduplication and display.
 * @param collapsed - If true, creates a collapsed group (user must click to expand). Default: true.
 * @source
 */
export function startGroup(label: string, collapsed = true): void {
  // If the current top group has the same label, increment its ref count and
  // don't call console.group again to avoid nested identical groups.
  const top = groupStack.at(-1);
  if (top && top.label === label) {
    top.count++;
    return;
  }

  const entry: GroupEntry = {
    label,
    count: 1,
    opened: false,
  };
  try {
    if (collapsed) {
      console.groupCollapsed(label);
    } else {
      console.group(label);
    }
    entry.opened = true;
  } catch {
    // ignore if console grouping isn't supported
    entry.opened = false;
  }

  groupStack.push(entry);
}

/**
 * Ends the most recent console group started with `startGroup()`.
 *
 * Handles reference counting for deduplicated groups - only closes the console group
 * when the last reference is ended. Safe to call when no group is active (no-op).
 *
 * @source
 */
export function endGroup(): void {
  if (groupStack.length === 0) return;

  const top = groupStack.at(-1);
  if (!top) return;

  if (top.count > 1) {
    top.count--;
    return;
  }

  // This is the last reference for this group; close it if we opened it.
  if (top.opened) {
    try {
      console.groupEnd();
    } catch {
      // ignore
    }
  }

  groupStack.pop();
}

/**
 * Wraps a synchronous operation with automatic group management.
 *
 * Automatically calls `startGroup()` before the operation and `endGroup()` after,
 * ensuring cleanup even if the operation throws an error.
 *
 * @param label - The group label for this operation.
 * @param fn - The synchronous function to wrap.
 * @param collapsed - If true, creates a collapsed group. Default: true.
 * @returns The return value of the wrapped function.
 * @throws Rethrows any error thrown by the wrapped function.
 * @source
 */
export function withGroup<T>(label: string, fn: () => T, collapsed = true): T {
  startGroup(label, collapsed);
  try {
    return fn();
  } finally {
    endGroup();
  }
}

/**
 * Wraps an asynchronous operation with automatic group management.
 *
 * Automatically calls `startGroup()` before the operation and `endGroup()` after,
 * ensuring cleanup even if the operation rejects. All console output from the async
 * function will be contained in the group in browser DevTools and tracked with group
 * hierarchy in log collection.
 *
 * @param label - The group label for this operation.
 * @param fn - The async function to wrap.
 * @param collapsed - If true, creates a collapsed group. Default: true.
 * @returns Promise that resolves to the return value of the wrapped function.
 * @throws Rethrows any error thrown or rejected by the wrapped function.
 * @source
 */
export async function withGroupAsync<T>(
  label: string,
  fn: () => Promise<T>,
  collapsed = true,
): Promise<T> {
  startGroup(label, collapsed);
  try {
    return await fn();
  } finally {
    endGroup();
  }
}

/** Log level severity classification. @source */
export type LogLevel = "log" | "info" | "warn" | "error" | "debug";

/**
 * Individual captured log entry.
 * @source
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
  /** Hierarchical path of console groups this log belongs to. Empty array if not in a group. */
  groupPath?: string[];
  /** Nesting depth of the log within groups (0 = top-level, 1 = nested once, etc.). */
  groupDepth?: number;
}

const LOG_LEVELS: LogLevel[] = ["error", "warn", "info", "log", "debug"];
/**
 * Maximum number of log entries to retain in memory before discarding oldest.
 * @source
 */
export const MAX_LOG_ENTRIES = 1000;

/**
 * Generates a unique identifier for a log entry.
 *
 * Uses native `crypto.randomUUID()` if available, otherwise generates a fallback ID
 * from timestamp and random data.
 *
 * @returns A unique identifier string.
 * @source
 */
const generateLogId = (): string => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(16).slice(2, 10)}`;
};

/**
 * Redacts sensitive information from log entries to prevent exposing tokens and credentials.
 *
 * Removes or replaces long tokens, access tokens, client secrets, authorization headers,
 * and auth codes with placeholder text.
 *
 * @param text - The text to redact.
 * @returns The redacted text with sensitive values replaced.
 * @source
 */
const redactSensitiveData = (text: string): string => {
  // List of auth fields that should be redacted
  const sensitiveFields = [
    "access_token",
    "accessToken",
    "id_token",
    "idToken",
    "refresh_token",
    "refreshToken",
    "authorization",
    "bearer",
    "client_secret",
    "clientSecret",
  ];

  // Try JSON-safe redaction first
  try {
    const parsed = JSON.parse(text);
    const redacted = redactJsonRecursively(parsed, sensitiveFields);
    return JSON.stringify(redacted);
  } catch {
    // Not valid JSON, fall through to regex-based redaction
  }

  // Regex-based fallback for non-JSON strings
  let redacted = text;

  // Redact potential tokens (long alphanumeric strings that look like tokens)
  redacted = redacted.replaceAll(/\b[\w-]{40,}\b/g, "[REDACTED_TOKEN]");

  // Redact known auth field values
  redacted = redacted.replaceAll(
    /(access_token|accessToken|id_token|idToken|refresh_token|refreshToken|client_secret|clientSecret)["']?\s*[:=]\s*["']?[^"',}\s&]+/gi,
    "$1=[REDACTED]",
  );

  // Redact authorization headers
  redacted = redacted.replaceAll(/Bearer\s+[\w-]{20,}/gi, "Bearer [REDACTED]");

  // Redact auth codes (10+ character alphanumeric strings in auth contexts)
  redacted = redacted.replaceAll(
    /(code|auth_code|authorization_code)["']?\s*[:=]\s*["']?[\w-]{10,}["']?/gi,
    "$1=[REDACTED]",
  );

  return redacted;
};

/**
 * Recursively walk JSON object and redact sensitive fields.
 * @param obj - Object to redact (can be any JSON-serializable value).
 * @param sensitiveFields - List of field names to redact.
 * @returns New object with sensitive fields redacted.
 * @source
 */
const redactJsonRecursively = (
  obj: unknown,
  sensitiveFields: string[],
): unknown => {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => redactJsonRecursively(item, sensitiveFields));
  }

  if (typeof obj === "object" && obj.constructor === Object) {
    const redacted: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      // Check if key matches any sensitive field (case-insensitive)
      const isSensitive = sensitiveFields.some(
        (field) => field.toLowerCase() === key.toLowerCase(),
      );

      if (isSensitive && typeof value === "string" && value.length > 0) {
        redacted[key] = "[REDACTED]";
      } else {
        redacted[key] = redactJsonRecursively(value, sensitiveFields);
      }
    }
    return redacted;
  }

  // Return primitives as-is
  return obj;
};

let logRedactionEnabled = true;

/**
 * Enables or disables sensitive data redaction for captured logs.
 * @param enabled - Whether redaction should be applied to log output.
 * @source
 */
export function setLogRedactionEnabled(enabled: boolean): void {
  logRedactionEnabled = enabled;
}

/**
 * Returns whether sensitive data redaction is currently enabled for captured logs.
 * @source
 */
export function isLogRedactionEnabled(): boolean {
  return logRedactionEnabled;
}

/**
 * Applies redaction to log output if enabled.
 * @param text - The text to potentially redact.
 * @returns Redacted text if redaction is enabled, otherwise the original text.
 * @source
 */
const maybeRedact = (text: string): string =>
  logRedactionEnabled ? redactSensitiveData(text) : text;

/**
 * Converts a console argument into a serializable string representation.
 *
 * Handles errors, objects, primitives, functions, and circular references gracefully.
 * Applies sensitive data redaction if enabled.
 *
 * @param value - The value to serialize.
 * @returns A string representation of the value.
 * @source
 */
const serialiseArgument = (value: unknown): string => {
  if (value instanceof Error) {
    const stack = value.stack?.split("\n").slice(0, 5).join("\n");
    const errorStr =
      value.name + ": " + value.message + (stack ? "\n" + stack : "");
    return maybeRedact(errorStr);
  }

  if (typeof value === "string") {
    return maybeRedact(value);
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
    const jsonStr = JSON.stringify(value, null, 2);
    return maybeRedact(jsonStr);
  } catch (error) {
    const errorMessage =
      error instanceof Error
        ? `${error.name}: ${error.message}`
        : Object.prototype.toString.call(error);
    return `Unserialisable value (${errorMessage})`;
  }
};

/**
 * Applies console format specifiers (%s, %d, %f, %o, %O, %c) to arguments.
 * @param format - The format string to process.
 * @param args - The arguments to apply to format placeholders.
 * @returns The formatted string with specifiers replaced.
 * @source
 */
const applyFormat = (format: string, args: unknown[]): string => {
  // Applies console format specifiers (%s, %d, %f, %o, %O, %c) to arguments
  // Similar to console.log formatting behavior
  let i = 0;
  const tokens = ["%%", "%s", "%d", "%i", "%f", "%o", "%O", "%c"];

  const escapeRegex = (s: string) =>
    s.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
  const objectDefaultString = (v: unknown) => Object.prototype.toString.call(v);

  const stringifyObject = (v: unknown): string => {
    if (v === null) return "null";
    try {
      const json = JSON.stringify(v);
      // JSON.stringify can return undefined for some values; fallback to default
      return json ?? objectDefaultString(v);
    } catch {
      return objectDefaultString(v);
    }
  };

  const stringifyGeneral = (arg: unknown): string =>
    typeof arg === "object" && arg !== null
      ? stringifyObject(arg)
      : String(arg);

  let result = format;
  for (const token of tokens) {
    const re = new RegExp(escapeRegex(token), "g");
    result = result.replace(re, () => {
      if (token === "%%") return "%";
      const arg = args[i++];
      if (arg === undefined) return "";

      switch (token) {
        case "%s":
          return stringifyGeneral(arg);
        case "%d":
        case "%i":
        case "%f":
          if (typeof arg === "object" && arg !== null)
            return stringifyObject(arg);
          return String(Number(arg));
        case "%o":
        case "%O":
          return stringifyGeneral(arg);
        case "%c":
          // CSS specifier - ignore in serialised output
          return "";
        default:
          return stringifyGeneral(arg);
      }
    });
  }

  return result;
};

/**
 * Counts the number of format placeholders in a format string that will consume arguments.
 *
 * Matches placeholders like %s, %d, %f, %o, %O, %i but excludes %% and %c.
 *
 * @param format - The format string to analyze.
 * @returns The count of placeholders that consume arguments.
 * @source
 */
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
 * Extracts meaningful source line information from a stack trace.
 *
 * Filters out logging internals and returns the first relevant caller stack frames.
 *
 * @param stack - The stack trace string to extract from.
 * @returns A cleaned source line string, or undefined if extraction fails.
 * @source
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
 * Determines whether a log entry is debug-focused based on its log level.
 *
 * Debug and log levels are considered debug messages; info, warn, and error are not.
 *
 * @param level - The log level to evaluate.
 * @returns True if the level represents a debug message, false otherwise.
 * @source
 */
const inferIsDebug = (level: LogLevel): boolean => {
  if (level === "debug") return true;

  // "log" level is also considered debug (fallback/trace level)
  if (level === "log") return true;

  // info, warn, and error are not debug messages
  return false;
};

/**
 * Captures console output in production builds for debugging and error reporting.
 *
 * Maintains an in-memory buffer of log entries with subscriptions for real-time updates.
 * Supports format string processing and sensitive data redaction.
 * Tracks console group hierarchy to preserve structural information about grouped logs.
 *
 * @source
 */
class LogCollector {
  #entries: LogEntry[] = [];
  readonly #listeners = new Set<(entries: LogEntry[]) => void>();
  readonly #groupStack: string[] = [];

  /**
   * Retrieves all captured log entries.
   * @returns Array of log entries.
   * @source
   */
  getEntries(): LogEntry[] {
    return this.#entries;
  }

  /**
   * Subscribes to log entry changes with a callback.
   * @param listener - Function called with current entries and updates.
   * @returns Unsubscribe function to remove the listener.
   * @source
   */
  subscribe(listener: (entries: LogEntry[]) => void): () => void {
    this.#listeners.add(listener);
    listener(this.#entries);
    return () => {
      this.#listeners.delete(listener);
    };
  }

  /**
   * Called when console.group() or console.groupCollapsed() is invoked.
   * Tracks the group label in the hierarchy stack.
   * @param label - The group label.
   * @source
   */
  enterGroup(label: string): void {
    this.#groupStack.push(label);
  }

  /**
   * Called when console.groupEnd() is invoked.
   * Removes the most recent group from the hierarchy stack.
   * @source
   */
  exitGroup(): void {
    this.#groupStack.pop();
  }

  /**
   * Adds a new log entry to the collection.
   * @param level - The log severity level.
   * @param args - Arguments passed to the console method.
   * @source
   */
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
      isDebug: inferIsDebug(level),
      groupPath:
        this.#groupStack.length > 0 ? [...this.#groupStack] : undefined,
      groupDepth:
        this.#groupStack.length > 0 ? this.#groupStack.length : undefined,
    };

    this.#entries = [...this.#entries, entry].slice(-MAX_LOG_ENTRIES);
    this.#notify();
  }

  /**
   * Clears all captured log entries.
   * @source
   */
  clear(): void {
    this.#entries = [];
    this.#notify();
  }

  /**
   * Notifies all subscribers of log entry changes.
   * @source
   */
  #notify() {
    const snapshot = this.#entries;
    for (const listener of this.#listeners) {
      listener(snapshot);
    }
  }
}

export const logCollector = new LogCollector();

/** Tracks whether console interceptors are currently installed. */
let interceptorInstalled = false;
const originalConsoleMethods = new Map<
  LogLevel,
  (...args: unknown[]) => void
>();

/**
 * Console object with assignable log level methods for interception.
 * @source
 */
type ConsoleMethod = (...args: unknown[]) => void;
const assignableConsole = console as Console & Record<LogLevel, ConsoleMethod>;

/**
 * Installs console interceptors to capture all log output.
 *
 * Wraps console methods (log, info, warn, error, debug) to forward entries to the LogCollector
 * while preserving normal console output. Also wraps group methods (group, groupCollapsed, groupEnd)
 * to track the hierarchical group structure for better log organization.
 *
 * Returns a cleanup function to uninstall interceptors.
 *
 * @returns A cleanup function that restores original console methods.
 * @source
 */
export function installConsoleInterceptor(): () => void {
  if (interceptorInstalled) {
    return () => {
      // no-op cleanup when already installed by another consumer
    };
  }

  if (globalThis.window === undefined) {
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

  // Wrap console group methods to track hierarchy
  const originalGroupCollapsed = console.groupCollapsed.bind(console);
  const originalGroup = console.group.bind(console);
  const originalGroupEnd = console.groupEnd.bind(console);

  console.groupCollapsed = (...args: unknown[]) => {
    // Extract label from first argument
    const label = args.length > 0 ? String(args[0]) : "Group";
    logCollector.enterGroup(label);
    originalGroupCollapsed(...args);
  };

  console.group = (...args: unknown[]) => {
    // Extract label from first argument
    const label = args.length > 0 ? String(args[0]) : "Group";
    logCollector.enterGroup(label);
    originalGroup(...args);
  };

  console.groupEnd = () => {
    logCollector.exitGroup();
    originalGroupEnd();
  };

  interceptorInstalled = true;

  return () => {
    if (!interceptorInstalled) return;
    for (const level of LOG_LEVELS) {
      const original = originalConsoleMethods.get(level);
      if (original) {
        assignableConsole[level] = original;
      }
    }

    // Restore group methods
    console.groupCollapsed = originalGroupCollapsed;
    console.group = originalGroup;
    console.groupEnd = originalGroupEnd;

    interceptorInstalled = false;
    originalConsoleMethods.clear();
  };
}

/**
 * Represents a log entry in serializable form suitable for export or storage.
 * @source
 */
export interface SerializableLogEntry {
  id: string;
  level: LogLevel;
  message: string;
  details: string[];
  timestamp: string;
  source?: string;
  isDebug?: boolean;
  groupPath?: string[];
  groupDepth?: number;
}

/**
 * Transforms internal LogEntry objects into a serializable format for export.
 *
 * Strips internal state and returns only properties needed for persistence or transmission.
 * Includes group hierarchy information to preserve structural context.
 *
 * @param entries - Array of internal log entries to serialize.
 * @returns Array of serializable log entries.
 * @source
 */
export function serialiseLogEntries(
  entries: LogEntry[],
): SerializableLogEntry[] {
  return entries.map(
    ({
      id,
      level,
      message,
      details,
      timestamp,
      source,
      isDebug,
      groupPath,
      groupDepth,
    }) => ({
      id,
      level,
      message,
      details,
      timestamp,
      source,
      isDebug,
      groupPath,
      groupDepth,
    }),
  );
}
