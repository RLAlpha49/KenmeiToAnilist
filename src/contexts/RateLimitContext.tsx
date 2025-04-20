import React, {
  createContext,
  useContext,
  useState,
  ReactNode,
  useEffect,
} from "react";
import { toast } from "sonner";

interface RateLimitState {
  isRateLimited: boolean;
  retryAfter: number | null;
  message: string | null;
}

interface RateLimitContextType {
  rateLimitState: RateLimitState;
  setRateLimit: (
    isLimited: boolean,
    retryTime?: number,
    message?: string,
  ) => void;
  clearRateLimit: () => void;
}

const RateLimitContext = createContext<RateLimitContextType | undefined>(
  undefined,
);

export function RateLimitProvider({ children }: { children: ReactNode }) {
  const [rateLimitState, setRateLimitState] = useState<RateLimitState>({
    isRateLimited: false,
    retryAfter: null,
    message: null,
  });

  // Use string type only for toast ID to fix TypeScript error
  const [toastId, setToastId] = useState<string | null>(null);

  // Function to set rate limit state
  const setRateLimit = (
    isLimited: boolean,
    retryTime?: number,
    message?: string,
  ) => {
    const retryTimestamp = retryTime ? Date.now() + retryTime * 1000 : null;

    console.log("Setting rate limit state:", {
      isLimited,
      retryTimestamp,
      message,
    });

    setRateLimitState({
      isRateLimited: isLimited,
      retryAfter: retryTimestamp,
      message:
        message ||
        "AniList API rate limit reached. Please wait before making more requests.",
    });
  };

  // Function to clear rate limit state
  const clearRateLimit = () => {
    setRateLimitState({
      isRateLimited: false,
      retryAfter: null,
      message: null,
    });
  };

  // Periodically check rate limit status from main process
  useEffect(() => {
    // Skip if we're in a browser environment without Electron
    if (!window.electronAPI?.anilist?.getRateLimitStatus) return;

    const checkRateLimitStatus = async () => {
      try {
        const status = await window.electronAPI.anilist.getRateLimitStatus();

        if (status.isRateLimited) {
          setRateLimitState({
            isRateLimited: true,
            retryAfter: status.retryAfter,
            message:
              "AniList API rate limit reached. Please wait before making more requests.",
          });
        } else if (rateLimitState.isRateLimited) {
          // Clear rate limit if it was previously set but is now cleared
          clearRateLimit();
        }
      } catch (error) {
        console.error("Error checking rate limit status:", error);
      }
    };

    // Check immediately on component mount
    checkRateLimitStatus();

    // Then check periodically
    const interval = setInterval(checkRateLimitStatus, 1000);

    return () => clearInterval(interval);
  }, [rateLimitState.isRateLimited]);

  // Listen for global rate limiting events
  useEffect(() => {
    const handleRateLimit = (event: Event) => {
      const customEvent = event as CustomEvent;
      if (customEvent.detail) {
        const { retryAfter, message } = customEvent.detail;
        console.log("Received rate limit event:", customEvent.detail);
        setRateLimit(true, retryAfter, message);
      }
    };

    // Add event listener for the custom rate limiting event
    window.addEventListener("anilist:rate-limited", handleRateLimit);

    // Clean up the listener on unmount
    return () => {
      window.removeEventListener("anilist:rate-limited", handleRateLimit);
    };
  }, []);

  // Effect to show/hide toast notification based on rate limit state
  useEffect(() => {
    if (rateLimitState.isRateLimited && rateLimitState.retryAfter) {
      // Create a dismissible persistent toast
      const id = toast.warning(
        <RateLimitToast
          message={rateLimitState.message || "Rate limited by AniList API"}
          retryAfter={rateLimitState.retryAfter}
          onComplete={clearRateLimit}
        />,
        {
          id: "rate-limit-toast",
          duration: Infinity, // Don't auto-dismiss
        },
      );

      // Force cast to string to fix TypeScript error
      setToastId(id as unknown as string);
    } else if (toastId) {
      // Dismiss the toast when no longer rate limited
      toast.dismiss(toastId);
      setToastId(null);
    }
  }, [rateLimitState.isRateLimited, rateLimitState.retryAfter]);

  return (
    <RateLimitContext.Provider
      value={{ rateLimitState, setRateLimit, clearRateLimit }}
    >
      {children}
    </RateLimitContext.Provider>
  );
}

// Custom hook to use the rate limit context
export function useRateLimit() {
  const context = useContext(RateLimitContext);
  if (context === undefined) {
    throw new Error("useRateLimit must be used within a RateLimitProvider");
  }
  return context;
}

// RateLimitToast component
function RateLimitToast({
  message,
  retryAfter,
  onComplete,
}: {
  message: string;
  retryAfter: number;
  onComplete: () => void;
}) {
  const [timeRemaining, setTimeRemaining] = useState<number>(0);
  const [initialDuration, setInitialDuration] = useState<number>(0);

  useEffect(() => {
    // Calculate initial time remaining
    const calcTimeRemaining = () => {
      const diff = retryAfter - Date.now();
      return diff > 0 ? diff : 0;
    };

    const initialRemaining = calcTimeRemaining();
    setTimeRemaining(initialRemaining);
    setInitialDuration(initialRemaining); // Store the initial duration

    // Set up interval to update the countdown
    const interval = setInterval(() => {
      const remaining = calcTimeRemaining();
      setTimeRemaining(remaining);

      if (remaining <= 0) {
        clearInterval(interval);
        onComplete();
      }
    }, 1000);

    // Cleanup interval on unmount
    return () => clearInterval(interval);
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
    <div className="space-y-2">
      <div className="font-medium">{message}</div>
      <div className="text-sm">
        Retry in:{" "}
        <span className="font-mono font-medium">
          {formatTime(timeRemaining)}
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-amber-200 dark:bg-amber-900">
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
