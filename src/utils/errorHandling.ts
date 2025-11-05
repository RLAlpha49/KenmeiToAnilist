/**
 * @packageDocumentation
 * @module errorHandling
 * @description Error handling utilities for the application, including error types, error creation, network error handling, async safety, and user notifications.
 */

/**
 * Custom error class for batch operation cancellations.
 * Used to distinguish intentional cancellations from other errors.
 * @source
 */
export class CancelledError extends Error {
  constructor(message: string = "Operation cancelled") {
    super(message);
    this.name = "CancelledError";
    Object.setPrototypeOf(this, CancelledError.prototype);
  }
}

/** Enumerates the different error types used throughout the application. @source */
export enum ErrorType {
  UNKNOWN = "unknown",
  VALIDATION = "validation",
  NETWORK = "network",
  AUTH = "auth",
  SERVER = "server",
  CLIENT = "client",
  STORAGE = "storage",
  AUTHENTICATION = "AUTHENTICATION",
  SYSTEM = "SYSTEM",
}

/** Enumerates the recovery actions available for different error types. @source */
export enum ErrorRecoveryAction {
  RETRY = "retry",
  CHECK_CONNECTION = "check_connection",
  REFRESH_TOKEN = "refresh_token",
  WAIT_RATE_LIMIT = "wait_rate_limit",
  CONTACT_SUPPORT = "contact_support",
  NONE = "none",
}

/** Structure for standardized application errors. @source */
export interface AppError {
  type: ErrorType;
  message: string;
  originalError?: unknown;
  code?: string;
  recoveryAction?: ErrorRecoveryAction;
  recoveryMessage?: string;
}

/**
 * Creates a standardized application error object with optional recovery hints.
 * Constructs an AppError with type, message, original error reference, and optional code.
 * @param type - The error type.
 * @param message - The error message.
 * @param originalError - The original error object, if any.
 * @param code - Optional error code for categorization.
 * @param recoveryAction - Optional recovery action hint for the UI.
 * @param recoveryMessage - Optional user-friendly recovery instruction.
 * @returns The constructed AppError object.
 * @source
 */
export function createError(
  type: ErrorType,
  message: string,
  originalError?: unknown,
  code?: string,
  recoveryAction?: ErrorRecoveryAction,
  recoveryMessage?: string,
): AppError {
  console.debug(
    "[ErrorHandling] 🔍 Creating error: " +
      type +
      " - " +
      message +
      (code ? " (" + code + ")" : ""),
  );

  return {
    type,
    message,
    originalError,
    code,
    recoveryAction,
    recoveryMessage,
  };
}

/**
 * Handles network errors and converts them to application error format.
 * Differentiates between connection errors, timeouts, auth failures, and server errors.
 * @param error - The error to handle.
 * @returns The converted AppError object.
 * @source
 */
export function handleNetworkError(error: unknown): AppError {
  console.warn("[ErrorHandling] ⚠️ Handling network error:", error);

  // Handle fetch errors and timeouts
  if (
    error instanceof TypeError &&
    (error.message.includes("fetch") || error.message.includes("network"))
  ) {
    return createError(
      ErrorType.NETWORK,
      "Unable to connect to the server. Please check your internet connection.",
      error,
      "NETWORK_UNAVAILABLE",
      ErrorRecoveryAction.CHECK_CONNECTION,
      "Please check your internet connection and try again.",
    );
  }

  // Handle API responses with error status codes
  if (
    error instanceof Response ||
    (typeof error === "object" && error !== null && "status" in error)
  ) {
    const response = error as
      | Response
      | { status: number; statusText?: string };
    const status = response.status;
    const message = "An error occurred while communicating with the server.";
    const code = "API_ERROR";

    if (status === 401 || status === 403) {
      return createError(
        ErrorType.AUTH,
        "Authentication failed. Please log in again.",
        error,
        "AUTH_FAILED",
        ErrorRecoveryAction.REFRESH_TOKEN,
        "Your session has expired. Please log in again.",
      );
    }

    if (status === 404) {
      return createError(
        ErrorType.SERVER,
        "The requested resource was not found.",
        error,
        "NOT_FOUND",
        ErrorRecoveryAction.NONE,
        "The requested resource was not found.",
      );
    }

    if (status >= 500) {
      return createError(
        ErrorType.SERVER,
        "The server encountered an error. Please try again in a few moments.",
        error,
        "SERVER_ERROR",
        ErrorRecoveryAction.RETRY,
        "The server encountered an error. Please try again in a few moments.",
      );
    }

    return createError(ErrorType.SERVER, message, error, code);
  }

  // For timeout errors
  if (error instanceof Error && error.name === "TimeoutError") {
    return createError(
      ErrorType.NETWORK,
      "The request timed out. Please try again.",
      error,
      "TIMEOUT",
      ErrorRecoveryAction.RETRY,
      "The request timed out. Please try again.",
    );
  }

  // For any other unknown errors
  return createError(
    ErrorType.UNKNOWN,
    "An unexpected error occurred.",
    error,
    "UNKNOWN_ERROR",
  );
}

/**
 * Gets a user-friendly message for a recovery action.
 * @param action - The recovery action to get a message for.
 * @returns A user-friendly message describing what the user should do.
 * @source
 */
export function getRecoveryActionMessage(action: ErrorRecoveryAction): string {
  switch (action) {
    case ErrorRecoveryAction.RETRY:
      return "Tap 'Retry' to try this operation again";
    case ErrorRecoveryAction.CHECK_CONNECTION:
      return "Check your internet connection and try again";
    case ErrorRecoveryAction.REFRESH_TOKEN:
      return "Your session has expired. Please log in again.";
    case ErrorRecoveryAction.WAIT_RATE_LIMIT:
      return "Too many requests. Please wait a moment and try again.";
    case ErrorRecoveryAction.CONTACT_SUPPORT:
      return "Please contact support for assistance.";
    case ErrorRecoveryAction.NONE:
    default:
      return "";
  }
}

/**
 * Performs a network request with an optional timeout using AbortController.
 * Automatically rejects if the request takes longer than the specified duration.
 * @param url - The URL to fetch.
 * @param options - Fetch options (default: empty object).
 * @param timeout - Timeout in milliseconds (default: 10000).
 * @returns A promise that resolves to the fetch Response.
 * @throws {Error} If the request times out or response is not ok.
 * @source
 */
export async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeout = 10000,
): Promise<Response> {
  const controller = new AbortController();
  const { signal } = controller;

  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal,
    });

    if (!response.ok) {
      throw response;
    }

    return response;
  } catch (error) {
    // AbortError is caused by our timeout
    if (error instanceof Error && error.name === "AbortError") {
      const timeoutError = new Error("Request timed out");
      timeoutError.name = "TimeoutError";
      throw timeoutError;
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Displays an error notification to the user.
 * @param error - The AppError to display.
 * @remarks This is a placeholder that should be integrated with your UI notification system.
 * @source
 */
export function showErrorNotification(error: AppError): void {
  console.error("[ErrorHandling] Error notification:", error.message, error);

  if (globalThis.window !== undefined) {
    alert(`Error: ${error.message}`);
  }
}

/**
 * Safely executes an async operation with error handling.
 * Wraps an async function and returns a result object containing either successful data or an error.
 * @template T - The type of data returned by the async function.
 * @param asyncFn - The async function to execute.
 * @param onError - Optional callback for handling errors.
 * @returns An object containing either the data or the error.
 * @source
 */
export async function safeAsync<T>(
  asyncFn: () => Promise<T>,
  onError?: (error: AppError) => void,
): Promise<{ data: T | null; error: AppError | null }> {
  try {
    const data = await asyncFn();
    return { data, error: null };
  } catch (error) {
    const appError = handleNetworkError(error);
    if (onError) {
      onError(appError);
    }
    return { data: null, error: appError };
  }
}

/**
 * Captures an error to Sentry for monitoring and analysis in production.
 * Wraps error creation with Sentry integration, sending errors when configured.
 * @param type - The error type.
 * @param message - The error message.
 * @param originalError - The original error object.
 * @param context - Optional metadata to include with the error.
 * @param code - Optional error code for categorization.
 * @param recoveryAction - Optional recovery action hint for the UI.
 * @param recoveryMessage - Optional user-friendly recovery instruction.
 * @returns The constructed AppError object.
 * @source
 */
export function captureError(
  type: ErrorType,
  message: string,
  originalError: unknown,
  context?: Record<string, unknown>,
  code?: string,
  recoveryAction?: ErrorRecoveryAction,
  recoveryMessage?: string,
): AppError {
  const appError = createError(
    type,
    message,
    originalError,
    code,
    recoveryAction,
    recoveryMessage,
  );

  // Only capture to Sentry in production or when SENTRY_DSN is configured
  if (
    globalThis.window !== undefined &&
    (process.env.NODE_ENV === "production" ||
      process.env.VITE_SENTRY_DSN ||
      import.meta.env.VITE_SENTRY_DSN)
  ) {
    // Dynamic import to avoid hard dependency on Sentry
    import("@sentry/electron/renderer")
      .then((Sentry) => {
        Sentry.captureException(originalError, {
          tags: {
            errorType: type,
            errorCode: code || "UNKNOWN",
            recoveryAction: recoveryAction || "none",
          },
          contexts: context
            ? {
                app: context,
              }
            : undefined,
        });
      })
      .catch((err) => {
        console.debug(
          "[ErrorHandling] Failed to capture error to Sentry:",
          err,
        );
      });
  }

  return appError;
}
