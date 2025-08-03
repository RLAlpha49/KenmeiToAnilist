/**
 * @packageDocumentation
 * @module errorHandling
 * @description Error handling utilities for the application, including error types, error creation, network error handling, async safety, and user notifications.
 */

/**
 * Enumerates the different error types used throughout the application.
 *
 * @source
 */
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

/**
 * Structure for standardized application errors.
 *
 * @source
 */
export interface AppError {
  type: ErrorType;
  message: string;
  originalError?: unknown;
  code?: string;
}

/**
 * Creates a standardized application error object.
 *
 * @param type - The error type.
 * @param message - The error message.
 * @param originalError - The original error object, if any.
 * @param code - An optional error code.
 * @returns The constructed AppError object.
 * @example
 * ```ts
 * const error = createError(ErrorType.NETWORK, 'Network failed');
 * ```
 * @source
 */
export function createError(
  type: ErrorType,
  message: string,
  originalError?: unknown,
  code?: string,
): AppError {
  return {
    type,
    message,
    originalError,
    code,
  };
}

/**
 * Handles network errors and converts them to the application error format.
 *
 * @param error - The error to handle.
 * @returns The converted AppError object.
 * @example
 * ```ts
 * try {
 *   await fetch(...);
 * } catch (err) {
 *   const appError = handleNetworkError(err);
 * }
 * ```
 * @source
 */
export function handleNetworkError(error: unknown): AppError {
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
      );
    }

    if (status === 404) {
      return createError(
        ErrorType.SERVER,
        "The requested resource was not found.",
        error,
        "NOT_FOUND",
      );
    }

    if (status >= 500) {
      return createError(
        ErrorType.SERVER,
        "The server encountered an error. Please try again later.",
        error,
        "SERVER_ERROR",
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
 * Performs a network request with a timeout.
 *
 * @param url - The URL to fetch.
 * @param options - Fetch options.
 * @param timeout - Timeout in milliseconds (default: 10000).
 * @returns A promise that resolves to the fetch Response.
 * @throws If the request times out or the response is not ok.
 * @example
 * ```ts
 * const response = await fetchWithTimeout('https://api.example.com', {}, 5000);
 * ```
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
 *
 * @param error - The AppError to display.
 * @remarks
 * This is a placeholder that should be integrated with your UI notification system.
 * @source
 */
export function showErrorNotification(error: AppError): void {
  console.error("Error:", error.message, error);

  if (typeof window !== "undefined") {
    alert(`Error: ${error.message}`);
  }
}

/**
 * Safely executes an async operation with error handling.
 *
 * @param asyncFn - The async function to execute.
 * @param onError - Optional callback for handling errors.
 * @returns An object containing either the data or the error.
 * @example
 * ```ts
 * const { data, error } = await safeAsync(() => fetchData());
 * ```
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
