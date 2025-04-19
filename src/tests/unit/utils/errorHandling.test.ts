import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  createError,
  handleNetworkError,
  fetchWithTimeout,
  safeAsync,
  showErrorNotification,
  ErrorType,
  type AppError,
} from "@/utils/errorHandling";

describe("errorHandling", () => {
  describe("createError", () => {
    it("creates an error object with the provided properties", () => {
      const originalError = new Error("Test error");
      const error = createError(
        ErrorType.VALIDATION,
        "Invalid input",
        originalError,
        "VALIDATION_ERROR",
      );

      expect(error).toEqual({
        type: ErrorType.VALIDATION,
        message: "Invalid input",
        originalError,
        code: "VALIDATION_ERROR",
      });
    });

    it("creates an error without optional properties", () => {
      const error = createError(ErrorType.UNKNOWN, "Unknown error");

      expect(error).toEqual({
        type: ErrorType.UNKNOWN,
        message: "Unknown error",
      });
    });
  });

  describe("handleNetworkError", () => {
    it("handles network TypeError", () => {
      const networkError = new TypeError("Failed to fetch");
      const appError = handleNetworkError(networkError);

      expect(appError.type).toBe(ErrorType.NETWORK);
      expect(appError.code).toBe("NETWORK_UNAVAILABLE");
      expect(appError.originalError).toBe(networkError);
    });

    it("handles 401 status code", () => {
      const response = new Response(null, { status: 401 });
      const appError = handleNetworkError(response);

      expect(appError.type).toBe(ErrorType.AUTH);
      expect(appError.code).toBe("AUTH_FAILED");
      expect(appError.originalError).toBe(response);
    });

    it("handles 404 status code", () => {
      const response = new Response(null, { status: 404 });
      const appError = handleNetworkError(response);

      expect(appError.type).toBe(ErrorType.SERVER);
      expect(appError.code).toBe("NOT_FOUND");
      expect(appError.originalError).toBe(response);
    });

    it("handles 500 status code", () => {
      const response = new Response(null, { status: 500 });
      const appError = handleNetworkError(response);

      expect(appError.type).toBe(ErrorType.SERVER);
      expect(appError.code).toBe("SERVER_ERROR");
      expect(appError.originalError).toBe(response);
    });

    it("handles timeout errors", () => {
      const timeoutError = new Error("Timeout");
      timeoutError.name = "TimeoutError";

      const appError = handleNetworkError(timeoutError);

      expect(appError.type).toBe(ErrorType.NETWORK);
      expect(appError.code).toBe("TIMEOUT");
      expect(appError.originalError).toBe(timeoutError);
    });

    it("handles unknown errors", () => {
      const unknownError = { message: "Some strange error" };
      const appError = handleNetworkError(unknownError);

      expect(appError.type).toBe(ErrorType.UNKNOWN);
      expect(appError.code).toBe("UNKNOWN_ERROR");
      expect(appError.originalError).toBe(unknownError);
    });
  });

  describe("fetchWithTimeout", () => {
    let originalFetch: typeof global.fetch;

    beforeEach(() => {
      originalFetch = global.fetch;
      vi.useFakeTimers();
    });

    afterEach(() => {
      global.fetch = originalFetch;
      vi.useRealTimers();
    });

    it("fetches successfully within timeout", async () => {
      const mockResponse = new Response(JSON.stringify({ data: "test" }), {
        status: 200,
      });
      global.fetch = vi.fn().mockResolvedValue(mockResponse);

      const promise = fetchWithTimeout("https://example.com/api", {}, 5000);
      await vi.runAllTimersAsync();
      const response = await promise;

      expect(response).toBe(mockResponse);
      expect(global.fetch).toHaveBeenCalledWith(
        "https://example.com/api",
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
      );
    });

    it("rejects when response is not ok", async () => {
      const mockResponse = new Response(null, { status: 400 });
      global.fetch = vi.fn().mockResolvedValue(mockResponse);

      await expect(
        fetchWithTimeout("https://example.com/api", {}, 5000),
      ).rejects.toEqual(mockResponse);
    });

    it("throws TimeoutError when request times out", async () => {
      // Create an actual AbortError
      const abortError = new Error("The operation was aborted");
      abortError.name = "AbortError";

      // Mock implementation of fetch that always rejects with our AbortError
      global.fetch = vi.fn().mockRejectedValue(abortError);

      // Use try/catch to handle the error
      let caughtError = null;
      try {
        await fetchWithTimeout("https://example.com/api", {});
      } catch (error) {
        caughtError = error;
      }

      // Verify we caught the TimeoutError
      expect(caughtError).not.toBeNull();
      expect((caughtError as Error).name).toBe("TimeoutError");
      expect((caughtError as Error).message).toBe("Request timed out");

      // Ensure the mock was called with signal
      expect(global.fetch).toHaveBeenCalledWith(
        "https://example.com/api",
        expect.objectContaining({
          signal: expect.any(AbortSignal),
        }),
      );
    });
  });

  describe("safeAsync", () => {
    it("returns data when async function succeeds", async () => {
      const asyncFn = vi.fn().mockResolvedValue("success");
      const result = await safeAsync(asyncFn);

      expect(result).toEqual({
        data: "success",
        error: null,
      });
    });

    it("returns error when async function fails", async () => {
      const networkError = new TypeError("Failed to fetch");
      const asyncFn = vi.fn().mockRejectedValue(networkError);
      const result = await safeAsync(asyncFn);

      expect(result.data).toBeNull();
      expect(result.error).not.toBeNull();
      expect(result.error?.type).toBe(ErrorType.NETWORK);
    });

    it("calls onError callback when provided", async () => {
      const networkError = new TypeError("Failed to fetch");
      const asyncFn = vi.fn().mockRejectedValue(networkError);
      const onError = vi.fn();

      await safeAsync(asyncFn, onError);

      expect(onError).toHaveBeenCalledTimes(1);
      expect(onError).toHaveBeenCalledWith(
        expect.objectContaining({
          type: ErrorType.NETWORK,
        }),
      );
    });
  });

  describe("showErrorNotification", () => {
    let originalConsoleError: typeof console.error;
    let originalAlert: typeof window.alert;

    beforeEach(() => {
      originalConsoleError = console.error;
      console.error = vi.fn();

      originalAlert = window.alert;
      window.alert = vi.fn();
    });

    afterEach(() => {
      console.error = originalConsoleError;
      window.alert = originalAlert;
    });

    it("logs error to console", () => {
      const error: AppError = {
        type: ErrorType.VALIDATION,
        message: "Invalid input",
      };

      showErrorNotification(error);

      expect(console.error).toHaveBeenCalledWith(
        "Error:",
        "Invalid input",
        error,
      );
    });

    it("shows alert with error message", () => {
      const error: AppError = {
        type: ErrorType.VALIDATION,
        message: "Invalid input",
      };

      showErrorNotification(error);

      expect(window.alert).toHaveBeenCalledWith("Error: Invalid input");
    });
  });
});
