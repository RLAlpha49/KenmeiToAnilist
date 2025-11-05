import React, { useState, useEffect } from "react";

/**
 * @packageDocumentation
 * @module RateLimitCountdown
 * @description Displays a countdown timer and progress bar for API rate limit retry, calling a callback when complete.
 */

/**
 * Props for the RateLimitCountdown component.
 * @property retryAfter - Timestamp in milliseconds when retry is allowed.
 * @property onComplete - Callback invoked when countdown reaches zero.
 * @source
 */
interface RateLimitCountdownProps {
  retryAfter: number;
  onComplete: () => void;
}

/**
 * Displays countdown timer and progress bar for API rate limit retry.
 * @param props - Component properties.
 * @param props.retryAfter - Timestamp in milliseconds when retry is allowed.
 * @param props.onComplete - Callback invoked when countdown reaches zero.
 * @returns React element with countdown timer and progress bar.
 * @source
 */
export function RateLimitCountdown({
  retryAfter,
  onComplete,
}: Readonly<RateLimitCountdownProps>) {
  const [timeRemaining, setTimeRemaining] = useState<number>(0);
  const [initialDuration, setInitialDuration] = useState<number>(0);

  useEffect(() => {
    // Calculate initial time remaining
    const calcTimeRemaining = () => {
      const diff = retryAfter - Date.now();
      const result = Math.max(diff, 0);
      console.debug(
        `[RateLimitCountdown] Calculated remaining time: ${result}ms (${Math.ceil(result / 1000)}s)`,
      );
      return result;
    };

    const initialRemaining = calcTimeRemaining();
    setTimeRemaining(initialRemaining);
    // Store initial duration for progress calculation
    setInitialDuration(initialRemaining);
    console.debug(
      "[RateLimitCountdown] Initial time remaining set to:",
      initialRemaining,
    );

    // Invoke callback immediately if no time remaining
    if (initialRemaining === 0) {
      console.debug(
        "[RateLimitCountdown] Initial time is zero, calling onComplete immediately",
      );
      onComplete();
      return () => {}; // No interval to clean up
    }

    // Update countdown every second
    const interval = setInterval(() => {
      const remaining = calcTimeRemaining();
      setTimeRemaining(remaining);

      if (remaining <= 0) {
        console.debug(
          "[RateLimitCountdown] Countdown reached zero, calling onComplete",
        );
        clearInterval(interval);
        onComplete();
      }
    }, 1000);

    // Cleanup interval on unmount
    return () => {
      console.debug("[RateLimitCountdown] unmounting, clearing interval");
      clearInterval(interval);
    };
  }, [retryAfter, onComplete]);

  // Format milliseconds to MM:SS format
  const formatTime = (ms: number) => {
    const totalSeconds = Math.ceil(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  // Calculate progress as percentage (100% to 0%)
  const progressPercentage =
    initialDuration > 0 ? (timeRemaining / initialDuration) * 100 : 100;

  return (
    <div className="mt-2 text-sm">
      <div className="flex items-center justify-between">
        <span>Retrying in:</span>
        <span className="font-mono font-medium">
          {formatTime(timeRemaining)}
        </span>
      </div>

      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-amber-200 dark:bg-amber-900">
        <div
          className="h-full bg-amber-500 transition-all duration-1000 ease-linear dark:bg-amber-600"
          style={{
            width: `${progressPercentage}%`,
          }}
        />
      </div>
    </div>
  );
}
