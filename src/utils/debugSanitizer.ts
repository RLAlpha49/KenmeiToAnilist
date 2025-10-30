/**
 * @packageDocumentation
 * @module debugSanitizer
 * @description Sanitization utilities for redacting sensitive data in debug output.
 */

/**
 * Options for sanitizing debug output.
 */
export interface SanitizeOptions {
  /** Whether to redact sensitive data (tokens, credentials, etc.) */
  redactSensitive?: boolean;
  /** Maximum depth to traverse into objects before stopping */
  maxDepth?: number;
}

/**
 * Patterns that match sensitive data to redact.
 */
const SENSITIVE_PATTERNS = [
  /bearer\s+[\w\-.]+/gi,
  /authorization:\s*[\w\-.]+/gi,
  /token["s:=]+[\w\-.]+/gi,
  /secret["s:=]+[\w\-.]+/gi,
  /password["s:=]+[\w\-.]+/gi,
  /api[_-]?key["s:=]+[\w\-.]+/gi,
  /access[_-]?token["s:=]+[\w\-.]+/gi,
  /refresh[_-]?token["s:=]+[\w\-.]+/gi,
  /x-api-key["s:=]+[\w\-.]+/gi,
];

/**
 * Keys that typically contain sensitive data and should be redacted.
 */
const SENSITIVE_KEYS = new Set([
  "token",
  "auth",
  "secret",
  "password",
  "key",
  "apikey",
  "api_key",
  "accesstoken",
  "access_token",
  "refreshtoken",
  "refresh_token",
  "authorization",
  "bearer",
  "credential",
  "credentials",
  "sessionid",
  "session_id",
  "cookie",
]);

/**
 * Sanitizes a string value by redacting sensitive data.
 * Replaces patterns matching tokens, keys, and other sensitive info with [REDACTED].
 * @param value - String to sanitize
 * @returns Redacted string
 */
function sanitizeString(value: string): string {
  let result = value;
  for (const pattern of SENSITIVE_PATTERNS) {
    result = result.replace(pattern, "[REDACTED]");
  }
  return result;
}

/**
 * Sanitizes an object by recursively redacting sensitive keys and values.
 * @param obj - Object to sanitize
 * @param maxDepth - Maximum depth to traverse (default 10)
 * @param currentDepth - Current recursion depth
 * @returns Sanitized copy of object
 */
function sanitizeObject(
  obj: Record<string, unknown>,
  maxDepth: number = 10,
  currentDepth: number = 0,
): Record<string, unknown> {
  if (currentDepth >= maxDepth) {
    return { __depth_limit_reached: true };
  }

  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase();

    // Check if this key contains sensitive information
    if (
      SENSITIVE_KEYS.has(lowerKey) ||
      lowerKey.includes("token") ||
      lowerKey.includes("auth") ||
      lowerKey.includes("secret") ||
      lowerKey.includes("password") ||
      lowerKey.includes("key")
    ) {
      sanitized[key] = "[REDACTED]";
    } else if (typeof value === "string") {
      sanitized[key] = sanitizeString(value);
    } else if (
      typeof value === "object" &&
      value !== null &&
      !Array.isArray(value) &&
      !(value instanceof Error) &&
      !(value instanceof Date)
    ) {
      sanitized[key] = sanitizeObject(
        value as Record<string, unknown>,
        maxDepth,
        currentDepth + 1,
      );
    } else if (Array.isArray(value)) {
      sanitized[key] = value.map((item) =>
        sanitizeValue(item, maxDepth, currentDepth + 1),
      );
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

/**
 * Sanitizes any value based on its type.
 * @param value - Value to sanitize
 * @param maxDepth - Maximum recursion depth
 * @param currentDepth - Current recursion depth
 * @returns Sanitized value
 */
function sanitizeValue(
  value: unknown,
  maxDepth: number = 10,
  currentDepth: number = 0,
): unknown {
  if (typeof value === "string") {
    return sanitizeString(value);
  }

  if (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    !(value instanceof Error) &&
    !(value instanceof Date)
  ) {
    return sanitizeObject(
      value as Record<string, unknown>,
      maxDepth,
      currentDepth,
    );
  }

  if (Array.isArray(value)) {
    if (currentDepth >= maxDepth) {
      return "[DEPTH_LIMIT_REACHED]";
    }
    return value.map((item) => sanitizeValue(item, maxDepth, currentDepth + 1));
  }

  return value;
}

/**
 * Sanitizes a value for debug display by redacting sensitive data.
 * Handles objects, arrays, strings, and primitives recursively.
 * Respects maximum depth to prevent infinite recursion.
 *
 * @param value - The value to sanitize
 * @param options - Sanitization options
 * @returns Sanitized copy of the value, or original if not flagged for redaction
 *
 * @example
 * const unsafeData = { token: "secret-123", user: "john" };
 * const safe = sanitizeForDebug(unsafeData, { redactSensitive: true });
 * // Result: { token: "[REDACTED]", user: "john" }
 */
export function sanitizeForDebug(
  value: unknown,
  options: SanitizeOptions = {},
): unknown {
  const { redactSensitive = true, maxDepth = 10 } = options;

  if (!redactSensitive) {
    return value;
  }

  return sanitizeValue(value, maxDepth);
}

/**
 * Sanitizes a string for debug display.
 * Useful for sanitizing log messages or JSON strings.
 *
 * @param text - The text to sanitize
 * @param redact - Whether to apply redaction (default: true)
 * @returns Sanitized text
 *
 * @example
 * const log = 'Authorization: Bearer secret-token-123';
 * const safe = sanitizeStringForDebug(log);
 * // Result: 'Authorization: [REDACTED]'
 */
export function sanitizeStringForDebug(
  text: string,
  redact: boolean = true,
): string {
  if (!redact) {
    return text;
  }
  return sanitizeString(text);
}
