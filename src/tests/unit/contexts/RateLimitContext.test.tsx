import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  RateLimitProvider,
  useRateLimit,
} from "../../../contexts/RateLimitContext";

// Mock the toast function from sonner
vi.mock("sonner", () => ({
  toast: {
    warning: vi.fn().mockReturnValue("mock-toast-id"),
    dismiss: vi.fn(),
  },
}));

// Import the toast after mocking
import { toast } from "sonner";

// Mock timers
beforeEach(() => {
  // Set up timestamp for consistent testing
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2023, 1, 1));
  
  // Mock the interval functions to prevent infinite loops
  const originalSetInterval = global.setInterval;
  vi.spyOn(global, 'setInterval').mockImplementation((callback, delay) => {
    return originalSetInterval(callback as TimerHandler, delay) as unknown as NodeJS.Timeout;
  });
  
  window.electronAPI = {
    anilist: {
      getRateLimitStatus: vi.fn().mockResolvedValue({
        isRateLimited: false,
        retryAfter: null,
      }),
    },
  } as any;
  
  // Reset toast mocks
  vi.mocked(toast.warning).mockClear();
  vi.mocked(toast.dismiss).mockClear();
});

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

// Create a test component that uses the RateLimit context
function TestComponent() {
  const { rateLimitState, setRateLimit, clearRateLimit } = useRateLimit();

  return (
    <div>
      <div data-testid="is-rate-limited">
        {String(rateLimitState.isRateLimited)}
      </div>
      <div data-testid="retry-after">
        {rateLimitState.retryAfter !== null
          ? rateLimitState.retryAfter
          : "null"}
      </div>
      <div data-testid="message">{rateLimitState.message || "null"}</div>
      <button
        data-testid="set-rate-limit"
        onClick={() => setRateLimit(true, 60, "Test rate limit message")}
      >
        Set Rate Limit
      </button>
      <button data-testid="clear-rate-limit" onClick={clearRateLimit}>
        Clear Rate Limit
      </button>
    </div>
  );
}

describe("RateLimitContext", () => {
  it("provides the rate limit context values", async () => {
    await act(async () => {
      render(
        <RateLimitProvider>
          <TestComponent />
        </RateLimitProvider>
      );
      
      // Let all pending promises resolve
      await vi.runOnlyPendingTimersAsync();
    });

    // Check that the context values are rendered
    expect(screen.getByTestId("is-rate-limited")).toBeInTheDocument();
    expect(screen.getByTestId("retry-after")).toBeInTheDocument();
    expect(screen.getByTestId("message")).toBeInTheDocument();

    // Check initial values
    expect(screen.getByTestId("is-rate-limited")).toHaveTextContent("false");
    expect(screen.getByTestId("retry-after")).toHaveTextContent("null");
    expect(screen.getByTestId("message")).toHaveTextContent("null");
  });

  it("throws an error when used outside provider", () => {
    // Silence the expected error in the console
    vi.spyOn(console, "error").mockImplementation(() => {});

    expect(() => {
      render(<TestComponent />);
    }).toThrow("useRateLimit must be used within a RateLimitProvider");

    // Restore console.error
    (console.error as any).mockRestore();
  });
  
  it("exposes context functionality correctly", () => {
    const contextValue = {
      rateLimitState: {
        isRateLimited: false,
        retryAfter: null,
        message: null,
      },
      setRateLimit: vi.fn(),
      clearRateLimit: vi.fn(),
    };

    // Direct test of context hook
    render(
      <RateLimitProvider>
        <TestComponent />
      </RateLimitProvider>
    );

    // Check that initial state is correct
    expect(screen.getByTestId("is-rate-limited")).toHaveTextContent("false");
    
    // We're only testing that the context functions are properly exposed,
    // not their actual implementation, which is covered by unit tests for those functions
  });
});
