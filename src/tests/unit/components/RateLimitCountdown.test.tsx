import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { RateLimitCountdown } from "@/components/RateLimitCountdown";
import React from "react";

describe("RateLimitCountdown", () => {
  beforeEach(() => {
    // Mock console.log to avoid noise in tests
    vi.spyOn(console, "log").mockImplementation(() => {});

    // Setup fake timers
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("renders with the correct initial time", () => {
    // Set current time to a fixed value
    const now = new Date(2023, 0, 1, 12, 0, 0).getTime(); // 2023-01-01 12:00:00
    vi.setSystemTime(now);

    // Set retryAfter to 2 minutes in the future
    const retryAfter = now + 2 * 60 * 1000;

    render(<RateLimitCountdown retryAfter={retryAfter} onComplete={vi.fn()} />);

    // Check initial time display (should be 2:00)
    expect(screen.getByText("2:00")).toBeInTheDocument();
  });

  it("updates the countdown correctly", () => {
    // Set current time to a fixed value
    const now = new Date(2023, 0, 1, 12, 0, 0).getTime(); // 2023-01-01 12:00:00
    vi.setSystemTime(now);

    // Set retryAfter to 2 minutes in the future
    const retryAfter = now + 2 * 60 * 1000;

    render(<RateLimitCountdown retryAfter={retryAfter} onComplete={vi.fn()} />);

    // Check initial time display
    expect(screen.getByText("2:00")).toBeInTheDocument();

    // Advance time by 30 seconds
    act(() => {
      vi.advanceTimersByTime(30 * 1000);
    });

    // Now the countdown should be 1:30
    expect(screen.getByText("1:30")).toBeInTheDocument();

    // Advance time by another 30 seconds
    act(() => {
      vi.advanceTimersByTime(30 * 1000);
    });

    // Now the countdown should be 1:00
    expect(screen.getByText("1:00")).toBeInTheDocument();
  });

  it("calls onComplete when countdown reaches zero", () => {
    // Set current time to a fixed value
    const now = new Date(2023, 0, 1, 12, 0, 0).getTime(); // 2023-01-01 12:00:00
    vi.setSystemTime(now);

    // Set retryAfter to 10 seconds in the future
    const retryAfter = now + 10 * 1000;

    const onCompleteMock = vi.fn();

    render(
      <RateLimitCountdown
        retryAfter={retryAfter}
        onComplete={onCompleteMock}
      />,
    );

    // Advance time to just before completion
    act(() => {
      vi.advanceTimersByTime(9 * 1000);
    });

    // onComplete should not have been called yet
    expect(onCompleteMock).not.toHaveBeenCalled();

    // Advance time past completion
    act(() => {
      vi.advanceTimersByTime(2 * 1000);
    });

    // onComplete should have been called
    expect(onCompleteMock).toHaveBeenCalledTimes(1);
  });

  it("shows correct progress percentage", () => {
    // Set current time to a fixed value
    const now = new Date(2023, 0, 1, 12, 0, 0).getTime(); // 2023-01-01 12:00:00
    vi.setSystemTime(now);

    // Set retryAfter to 100 seconds in the future
    const retryAfter = now + 100 * 1000;

    const { container } = render(
      <RateLimitCountdown retryAfter={retryAfter} onComplete={vi.fn()} />,
    );

    // Get the progress bar element
    const progressBar = container.querySelector(".bg-amber-500");
    expect(progressBar).toBeInTheDocument();

    // Initially should be at 100%
    expect(progressBar?.style.width).toBe("100%");

    // Advance time halfway
    act(() => {
      vi.advanceTimersByTime(50 * 1000);
    });

    // Progress should be around 50% (might not be exact due to timing)
    const widthValue = parseInt(progressBar?.style.width || "0");
    expect(widthValue).toBeGreaterThanOrEqual(49);
    expect(widthValue).toBeLessThanOrEqual(51);
  });

  it("handles past retryAfter times", () => {
    // Set current time to a fixed value
    const now = new Date(2023, 0, 1, 12, 0, 0).getTime(); // 2023-01-01 12:00:00
    vi.setSystemTime(now);

    // Set retryAfter to a past time
    const retryAfter = now - 60 * 1000; // 1 minute in the past

    const onCompleteMock = vi.fn();

    render(
      <RateLimitCountdown
        retryAfter={retryAfter}
        onComplete={onCompleteMock}
      />,
    );

    // Should call onComplete immediately
    expect(onCompleteMock).toHaveBeenCalledTimes(1);

    // Time remaining should show 0:00
    expect(screen.getByText("0:00")).toBeInTheDocument();
  });
});
