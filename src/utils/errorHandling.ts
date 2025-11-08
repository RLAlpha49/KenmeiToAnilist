/**
 * @packageDocumentation
 * @module errorHandling
 * @description Error handling utilities for the application, including error types, error creation, network error handling, async safety, and user notifications.
 */

import React from "react";

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
  SYSTEM = "system",
  IMPORT = "import",
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
 * Options for displaying error notifications with recovery actions.
 * @source
 */
export interface ErrorNotificationOptions {
  /** Callback to execute when user clicks retry button */
  onRetry?: () => void | Promise<void>;
  /** Callback to execute when user dismisses the notification */
  onDismiss?: () => void;
  /** Toast ID for updating existing toasts */
  toastId?: string | number;
  /** Custom toast duration in milliseconds */
  duration?: number;
}

/**
 * Mapping of error types to USER_GUIDE help link anchors.
 * @source
 */
type HelpLinkConfig = {
  [K in ErrorType]: string;
};

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
  console.error(message);
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

    if (status === 429) {
      return createError(
        ErrorType.SERVER,
        "API rate limit exceeded. Please wait before trying again.",
        error,
        "RATE_LIMITED",
        ErrorRecoveryAction.WAIT_RATE_LIMIT,
        "Too many requests. Please wait a moment before retrying.",
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
 * Generates a help link URL based on error type.
 * Maps error types to relevant USER_GUIDE sections.
 * Returns a resolvable URL to documentation (GitHub or in-app).
 * @param errorType - The error type to get help for.
 * @returns The full URL to the help section, or null if no help available.
 * @source
 */
export function getHelpLinkForErrorType(errorType: ErrorType): string | null {
  const helpLinkConfig: HelpLinkConfig = {
    [ErrorType.VALIDATION]: "#handling-import-errors",
    [ErrorType.IMPORT]: "#handling-import-errors",
    [ErrorType.AUTH]: "#anilist-authentication",
    [ErrorType.NETWORK]: "#troubleshooting",
    [ErrorType.SERVER]: "#synchronizing-to-anilist",
    [ErrorType.STORAGE]: "#troubleshooting",
    [ErrorType.SYSTEM]: "#getting-help",
    [ErrorType.CLIENT]: "#getting-help",
    [ErrorType.UNKNOWN]: "#getting-help",
  };

  const anchor = helpLinkConfig[errorType];
  if (!anchor) return null;

  // Construct URL to USER_GUIDE documentation
  // In production, this points to the GitHub repository
  // Users can also access via in-app route if available
  const baseUrl =
    "https://github.com/RLAlpha49/KenmeiToAnilist/blob/master/docs/guides/USER_GUIDE.md";
  return `${baseUrl}${anchor}`;
}

/**
 * Generates a Sonner toast action button configuration for recovery actions.
 * @param action - The recovery action to create a button for.
 * @param onRetry - Optional callback for retry actions.
 * @returns A Sonner action config object, or null if no action button should be shown.
 * @source
 */
export function getRecoveryActionButton(
  action: ErrorRecoveryAction,
  onRetry?: () => void | Promise<void>,
): { label: string; onClick: () => void } | null {
  switch (action) {
    case ErrorRecoveryAction.RETRY:
      if (!onRetry) return null;
      return {
        label: "Retry",
        onClick: () => {
          // Handle both sync and async callbacks
          const result = onRetry();
          if (result instanceof Promise) {
            result.catch((error) => {
              console.error("[ErrorHandling] Retry failed:", error);
            });
          }
        },
      };

    case ErrorRecoveryAction.CHECK_CONNECTION:
      return {
        label: "Check Connection",
        onClick: () => {
          // Try to use Electron's shell.openExternal for better reliability
          import("electron")
            .then((electron) => {
              // Access shell from the module
              const shell = electron.shell;
              if (shell && typeof shell.openExternal === "function") {
                shell.openExternal("https://www.google.com");
              } else if (globalThis.window?.open) {
                // Fallback to window.open if shell is not available
                globalThis.window.open("https://www.google.com", "_blank");
              }
            })
            .catch(() => {
              // If import fails, fall back to window.open
              if (globalThis.window?.open) {
                globalThis.window.open("https://www.google.com", "_blank");
              }
            });
        },
      };

    case ErrorRecoveryAction.REFRESH_TOKEN:
      if (!onRetry) return null;
      return {
        label: "Re-authenticate",
        onClick: () => {
          // Handle both sync and async callbacks
          const result = onRetry();
          if (result instanceof Promise) {
            result.catch((error) => {
              console.error("[ErrorHandling] Re-authentication failed:", error);
            });
          }
        },
      };

    case ErrorRecoveryAction.CONTACT_SUPPORT:
      return {
        label: "Get Help",
        onClick: () => {
          try {
            const helpLink = getHelpLinkForErrorType(ErrorType.UNKNOWN);
            if (helpLink && globalThis.window?.open) {
              globalThis.window.open(helpLink, "_blank");
            }
          } catch (error) {
            console.error("[ErrorHandling] Failed to open help link:", error);
          }
        },
      };

    case ErrorRecoveryAction.WAIT_RATE_LIMIT:
      // Rate limit errors are handled by specialized notification
      return null;

    case ErrorRecoveryAction.NONE:
    default:
      return null;
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
 * Displays an error notification to the user with optional recovery actions.
 * Uses Sonner toast for rich notification with retry buttons and interactive help links.
 * @param error - The AppError to display.
 * @param options - Optional configuration for the notification.
 * @remarks Builds React elements for description to render clickable help links.
 * @source
 */
export function showErrorNotification(
  error: AppError,
  options?: ErrorNotificationOptions,
): void {
  console.error("[ErrorHandling] Error notification:", error.message, error);

  // Import toast at runtime to avoid circular dependencies
  import("sonner")
    .then(({ toast }) => {
      // Build React element description with recovery message and interactive help link
      let description: React.ReactNode | undefined;

      const helpLink = getHelpLinkForErrorType(error.type);
      if (error.recoveryMessage || helpLink) {
        description = React.createElement(
          "div",
          { style: { display: "flex", flexDirection: "column", gap: "8px" } },
          error.recoveryMessage &&
            React.createElement(
              "p",
              { style: { margin: 0 } },
              error.recoveryMessage,
            ),
          helpLink &&
            React.createElement(
              "a",
              {
                href: helpLink,
                target: "_blank",
                rel: "noopener noreferrer",
                style: {
                  color: "inherit",
                  textDecoration: "underline",
                  cursor: "pointer",
                  fontSize: "0.9em",
                  margin: 0,
                },
              },
              "📖 View troubleshooting guide",
            ),
        );
      }

      // Get recovery action button if available
      const actionButton = error.recoveryAction
        ? getRecoveryActionButton(error.recoveryAction, options?.onRetry)
        : null;

      // Determine toast duration based on error type
      const defaultDuration =
        error.type === ErrorType.VALIDATION ? 5000 : 10000;
      const duration = options?.duration ?? defaultDuration;

      // Show the error toast
      toast.error(error.message, {
        description,
        action: actionButton || undefined,
        duration,
        id: options?.toastId,
        onDismiss: options?.onDismiss,
      });
    })
    .catch((toastError) => {
      // Fallback if toast import fails
      console.error(
        "[ErrorHandling] Failed to show toast notification:",
        toastError,
      );
      if (globalThis.window !== undefined) {
        const message = error.recoveryMessage
          ? `${error.message}\n\n${error.recoveryMessage}`
          : error.message;
        alert(`Error: ${message}`);
      }
    });
}

/**
 * Displays a rate limit notification with countdown timer.
 * Shows a custom toast with disabled retry button that enables after the wait period elapses.
 * @param retryAfterSeconds - Number of seconds to wait before retry is enabled.
 * @param message - User-facing message to display.
 * @param onComplete - Callback invoked when countdown completes.
 * @remarks Used specifically for HTTP 429 rate limit errors to guide users to wait.
 * @source
 */
export function showRateLimitNotification(
  retryAfterSeconds: number,
  message: string,
  onComplete: () => void,
): void {
  console.warn(
    `[ErrorHandling] Rate limit detected. Waiting ${retryAfterSeconds}s before retry.`,
  );

  import("sonner")
    .then(({ toast }) => {
      let secondsRemaining = retryAfterSeconds;

      // Create a custom description element with countdown
      const createCountdownDescription = (remaining: number) => {
        return React.createElement(
          "div",
          { style: { display: "flex", flexDirection: "column", gap: "8px" } },
          React.createElement("p", { style: { margin: 0 } }, message),
          React.createElement(
            "p",
            { style: { margin: 0, fontSize: "0.9em", opacity: 0.8 } },
            `Retry available in ${remaining}s...`,
          ),
        );
      };

      // Show initial toast
      const toastId = toast.loading("Rate limit active", {
        description: createCountdownDescription(secondsRemaining),
        duration: retryAfterSeconds * 1000 + 2000, // Duration + buffer
      });

      // Update countdown every second
      const intervalId = setInterval(() => {
        secondsRemaining -= 1;

        if (secondsRemaining <= 0) {
          clearInterval(intervalId);

          // Show completion toast with retry button
          toast.success("Rate limit lifted - Retry now available", {
            id: toastId,
            description:
              "You can now retry your request. Click the button or try again manually.",
            action: {
              label: "Retry Now",
              onClick: onComplete,
            },
            duration: 8000,
          });
        } else {
          // Update toast with new countdown
          toast.loading("Rate limit active", {
            id: toastId,
            description: createCountdownDescription(secondsRemaining),
            duration: retryAfterSeconds * 1000 + 2000,
          });
        }
      }, 1000);
    })
    .catch((toastError) => {
      console.error(
        "[ErrorHandling] Failed to show rate limit notification:",
        toastError,
      );
    });
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
