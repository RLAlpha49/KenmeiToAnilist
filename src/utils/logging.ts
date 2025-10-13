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
 * Redacts sensitive information from strings.
 * @param text - The text to redact
 * @returns The redacted text
 */
const redactSensitiveData = (text: string): string => {
  // Redact potential tokens (long alphanumeric strings that look like tokens)
  let redacted = text.replaceAll(/\b[\w-]{40,}\b/g, "[REDACTED_TOKEN]");

  // Redact client secrets in query params or JSON
  redacted = redacted.replaceAll(
    /(client_secret|clientSecret)["']?\s*[:=]\s*["']?[^"',}\s&]+/gi,
    "$1=[REDACTED]",
  );

  // Redact access tokens in various formats
  redacted = redacted.replaceAll(
    /(access_token|accessToken|token)["']?\s*[:=]\s*["']?[\w-]{20,}["']?/gi,
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

let logRedactionEnabled = true;

/**
 * Enables or disables sensitive data redaction for captured logs.
 * @param enabled - Whether redaction should be applied to log output.
 */
export function setLogRedactionEnabled(enabled: boolean): void {
  logRedactionEnabled = enabled;
}

/**
 * Returns whether sensitive data redaction is currently enabled for captured logs.
 */
export function isLogRedactionEnabled(): boolean {
  return logRedactionEnabled;
}

const maybeRedact = (text: string): string =>
  logRedactionEnabled ? redactSensitiveData(text) : text;

/**
 * Attempts to convert a console argument into a serialisable string.
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

const applyFormat = (format: string, args: unknown[]): string => {
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
const inferIsDebug = (level: LogLevel): boolean => {
  if (level === "debug") return true;

  // "log" level is also considered debug (fallback/trace level)
  if (level === "log") return true;

  // info, warn, and error are not debug messages
  return false;
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
      isDebug: inferIsDebug(level),
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
