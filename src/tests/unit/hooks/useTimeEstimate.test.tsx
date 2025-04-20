import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useTimeEstimate } from "../../../hooks/useTimeEstimate";

// Define an interface for the global extension
interface Global {
  advanceTime: (ms: number) => number;
}

// Define window types
interface MatchingProcessState {
  isRunning: boolean;
  progress: {
    current: number;
    total: number;
    currentTitle: string;
  };
  statusMessage: string;
  detailMessage: string | null;
  timeEstimate: {
    startTime: number;
    averageTimePerManga: number;
    estimatedRemainingSeconds: number;
  };
  lastUpdated: number;
}

// Extend the window interface
declare global {
  interface Window {
    matchingProcessState?: MatchingProcessState | undefined;
  }
}

describe("useTimeEstimate", () => {
  // Store the original Date.now implementation
  const originalDateNow = Date.now;

  beforeEach(() => {
    // Mock Date.now to have predictable time values
    let currentTime = 1000000000000; // Starting time
    vi.spyOn(Date, "now").mockImplementation(() => currentTime);

    // Function to advance time in tests
    (global as unknown as Global).advanceTime = (ms: number) => {
      currentTime += ms;
      return currentTime;
    };

    // Mock window.matchingProcessState
    window.matchingProcessState = {
      timeEstimate: null,
      lastUpdated: 0,
    } as unknown as MatchingProcessState;
  });

  afterEach(() => {
    // Restore the original implementation
    vi.restoreAllMocks();
    Date.now = originalDateNow;
    (global as unknown as Global).advanceTime = undefined as any;
  });

  it("initializes with correct initial state", () => {
    const { result } = renderHook(() => useTimeEstimate());

    // Check initial state
    expect(result.current.timeEstimate).toEqual({
      startTime: 0,
      averageTimePerManga: 0,
      estimatedRemainingSeconds: 0,
    });
  });

  it("initializes time tracking correctly", () => {
    const { result } = renderHook(() => useTimeEstimate());

    // Initialize time tracking
    let estimate;
    act(() => {
      estimate = result.current.initializeTimeTracking();
    });

    // Check that time tracking state was initialized
    expect(result.current.timeEstimate).toEqual({
      startTime: Date.now(),
      averageTimePerManga: 0,
      estimatedRemainingSeconds: 0,
    });

    // Function should return the same estimate
    expect(estimate).toEqual(result.current.timeEstimate);
  });

  it("calculates time estimates based on progress", () => {
    const { result } = renderHook(() => useTimeEstimate());

    // Initialize time tracking
    act(() => {
      result.current.initializeTimeTracking();
    });

    // Record the initial time
    const startTime = Date.now();

    // Simulate processing 1 item over 1 second
    (global as unknown as Global).advanceTime(1000);

    act(() => {
      result.current.calculateTimeEstimate(1, 10);
    });

    // After 1 item processed in 1 second, average should be 1000ms per item
    // and 9 remaining items would take 9 seconds
    expect(result.current.timeEstimate.averageTimePerManga).toBe(1000);
    expect(result.current.timeEstimate.estimatedRemainingSeconds).toBe(9);
    expect(result.current.timeEstimate.startTime).toBe(startTime);

    // Now process another 2 items over 4 seconds (2 seconds per item)
    (global as unknown as Global).advanceTime(4000);

    act(() => {
      result.current.calculateTimeEstimate(3, 10);
    });

    // The timePerItem for this batch is 4000/2 = 2000ms
    // So we have [1000, 2000] => average is 1500ms
    // With 7 remaining items, that's 10.5 seconds, rounded to 11
    expect(result.current.timeEstimate.averageTimePerManga).toBeCloseTo(
      1500,
      0,
    );
    expect(result.current.timeEstimate.estimatedRemainingSeconds).toBe(11);
  });

  it("ignores updates when no progress is made", () => {
    const { result } = renderHook(() => useTimeEstimate());

    // Initialize time tracking
    act(() => {
      result.current.initializeTimeTracking();
    });

    // Process 1 item
    (global as unknown as Global).advanceTime(1000);

    act(() => {
      result.current.calculateTimeEstimate(1, 10);
    });

    const initialEstimate = { ...result.current.timeEstimate };

    // Try to update with the same current count
    (global as unknown as Global).advanceTime(1000);

    act(() => {
      result.current.calculateTimeEstimate(1, 10);
    });

    // Estimate should not change
    expect(result.current.timeEstimate).toEqual(initialEstimate);
  });

  it("updates the global window.matchingProcessState", () => {
    const { result } = renderHook(() => useTimeEstimate());

    // Initialize time tracking
    act(() => {
      result.current.initializeTimeTracking();
    });

    // Process items
    (global as unknown as Global).advanceTime(1000);

    act(() => {
      result.current.calculateTimeEstimate(1, 10);
    });

    // Check that global state was updated
    expect(window.matchingProcessState?.timeEstimate).toEqual(
      result.current.timeEstimate,
    );
    expect(window.matchingProcessState?.lastUpdated).toBe(Date.now());
  });

  it("caps estimated time at 24 hours", () => {
    const { result } = renderHook(() => useTimeEstimate());

    // Initialize time tracking
    act(() => {
      result.current.initializeTimeTracking();
    });

    // Simulate a very slow process - 1 hour per item
    (global as unknown as Global).advanceTime(3600000); // 1 hour in ms

    act(() => {
      // Process 1 out of 100 items
      result.current.calculateTimeEstimate(1, 100);
    });

    // With 1 hour per item and 99 items remaining, that's 99 hours
    // But it should be capped at 24 hours (86400 seconds)
    expect(result.current.timeEstimate.estimatedRemainingSeconds).toBe(86400);
  });

  it("handles moving average by keeping only last 10 samples", () => {
    const { result } = renderHook(() => useTimeEstimate());

    // Initialize time tracking
    act(() => {
      result.current.initializeTimeTracking();
    });

    // Generate 15 samples with varying times (100ms to 1500ms)
    for (let i = 1; i <= 15; i++) {
      (global as unknown as Global).advanceTime(i * 100); // Increasing time per item

      act(() => {
        result.current.calculateTimeEstimate(i, 20);
      });
    }

    // Only the last 10 samples (6-15) should be considered in the average
    // That would be 600ms to 1500ms, average 1050ms
    // With 5 items remaining, that's 5.25 seconds
    expect(result.current.timeEstimate.averageTimePerManga).toBeCloseTo(
      1050,
      0,
    );
    expect(result.current.timeEstimate.estimatedRemainingSeconds).toBe(5);
  });
});
