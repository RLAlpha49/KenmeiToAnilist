import React, { useState, useEffect } from "react";

interface RateLimitCountdownProps {
  retryAfter: number; // Timestamp when the retry will happen
  onComplete: () => void; // Callback when countdown reaches zero
}

export function RateLimitCountdown({
  retryAfter,
  onComplete,
}: RateLimitCountdownProps) {
  const [timeRemaining, setTimeRemaining] = useState<number>(0);
  const [initialDuration, setInitialDuration] = useState<number>(0);

  useEffect(() => {
    // Calculate initial time remaining
    const calcTimeRemaining = () => {
      const diff = retryAfter - Date.now();
      const result = diff > 0 ? diff : 0;
      console.log(
        `Calculated remaining time: ${result}ms (${Math.ceil(result / 1000)}s)`,
      );
      return result;
    };

    const initialRemaining = calcTimeRemaining();
    setTimeRemaining(initialRemaining);
    setInitialDuration(initialRemaining); // Store the initial duration
    console.log("Initial time remaining set to:", initialRemaining);

    // If the initial time is already 0, call onComplete immediately
    if (initialRemaining === 0) {
      console.log("Initial time is zero, calling onComplete immediately");
      onComplete();
      return () => {}; // No interval to clean up
    }

    // Set up interval to update the countdown
    const interval = setInterval(() => {
      const remaining = calcTimeRemaining();
      setTimeRemaining(remaining);

      if (remaining <= 0) {
        console.log("Countdown reached zero, calling onComplete");
        clearInterval(interval);
        onComplete();
      }
    }, 1000);

    // Cleanup interval on unmount
    return () => {
      console.log("RateLimitCountdown unmounting, clearing interval");
      clearInterval(interval);
    };
  }, [retryAfter, onComplete]);

  // Format the time remaining
  const formatTime = (ms: number) => {
    const totalSeconds = Math.ceil(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  // Calculate progress percentage (100% to 0% as time elapses)
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
