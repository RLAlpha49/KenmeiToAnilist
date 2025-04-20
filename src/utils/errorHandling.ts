/**
 * Error handling utilities for the application
 */

// Define different error types
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

// Define the error structure
export interface AppError {
  type: ErrorType;
  message: string;
  originalError?: unknown;
  code?: string;
}

/**
 * Create a standardized application error
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
 * Handle network errors and convert them to the application error format
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
 * Create a network request with timeout
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
 * Display error notifications to the user
 * This is a placeholder that should be integrated with your UI notification system
 */
export function showErrorNotification(error: AppError): void {
  console.error("Error:", error.message, error);

  // Here you would integrate with your UI notification system
  // For example:
  // toast.error(error.message);

  // For now, let's use a simple alert for demo purposes
  if (typeof window !== "undefined") {
    alert(`Error: ${error.message}`);
  }
}

/**
 * Safely execute an async operation with error handling
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
