/**
 * @packageDocumentation
 * @module RateLimitContext
 * @description React context and provider for managing AniList API rate limit state and notifications throughout the application.
 */

import React, {
  createContext,
  useContext,
  useState,
  ReactNode,
  useEffect,
  useRef,
  useCallback,
} from "react";
import { toast } from "sonner";
import { useDebugActions, StateInspectorHandle } from "./DebugContext";

/**
 * The shape of the rate limit state managed by the context.
 *
 * @property isRateLimited - Whether the API is currently rate limited.
 * @property retryAfter - The timestamp (ms) when requests can be retried, or null.
 * @property message - The message to display to the user, or null.
 * @source
 */
export interface RateLimitState {
  isRateLimited: boolean;
  retryAfter: number | null;
  message: string | null;
}

/**
 * The shape of the rate limit context value provided to consumers.
 *
 * @property rateLimitState - The current rate limit state.
 * @property setRateLimit - Function to set the rate limit state.
 * @property clearRateLimit - Function to clear the rate limit state.
 * @source
 */
interface RateLimitContextType {
  rateLimitState: RateLimitState;
  setRateLimit: (
    isLimited: boolean,
    retryTime?: number,
    message?: string,
  ) => void;
  clearRateLimit: () => void;
}

interface RateLimitDebugSnapshot {
  rateLimitState: RateLimitState;
  toastId: string | null;
}

const RateLimitContext = createContext<RateLimitContextType | undefined>(
  undefined,
);

/**
 * Provides rate limit context to its children, managing rate limit state and notifications.
 *
 * @param children - The React children to be wrapped by the provider.
 * @returns The rate limit context provider with value for consumers.
 * @source
 */
export function RateLimitProvider({
  children,
}: Readonly<{ children: ReactNode }>) {
  const [rateLimitState, setRateLimitState] = useState<RateLimitState>({
    isRateLimited: false,
    retryAfter: null,
    message: null,
  });

  // Use string type only for toast ID to fix TypeScript error
  const [toastId, setToastId] = useState<string | null>(null);
  const { registerStateInspector: registerRateLimitInspector } =
    useDebugActions();
  const rateLimitInspectorHandleRef =
    useRef<StateInspectorHandle<RateLimitDebugSnapshot> | null>(null);
  const rateLimitSnapshotRef = useRef<RateLimitDebugSnapshot | null>(null);
  const getRateLimitSnapshotRef = useRef<() => RateLimitDebugSnapshot>(() => ({
    rateLimitState,
    toastId,
  }));
  getRateLimitSnapshotRef.current = () => ({ rateLimitState, toastId });

  const emitRateLimitSnapshot = useCallback(() => {
    if (!rateLimitInspectorHandleRef.current) return;
    const snapshot = getRateLimitSnapshotRef.current();
    rateLimitSnapshotRef.current = snapshot;
    rateLimitInspectorHandleRef.current.publish(snapshot);
  }, []);

  const applyRateLimitDebugSnapshot = useCallback(
    (snapshot: RateLimitDebugSnapshot) => {
      if (snapshot.rateLimitState) {
        setRateLimitState(snapshot.rateLimitState);
      }
      setToastId(snapshot.toastId ?? null);
    },
    [],
  );

  // Function to set rate limit state
  const setRateLimit = useCallback(
    (isLimited: boolean, retryTime?: number, message?: string) => {
      const retryTimestamp = retryTime ? Date.now() + retryTime * 1000 : null;

      console.debug("[RateLimitContext] Setting rate limit state:", {
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
    },
    [],
  );

  // Function to clear rate limit state
  const clearRateLimit = useCallback(() => {
    setRateLimitState({
      isRateLimited: false,
      retryAfter: null,
      message: null,
    });
  }, []);

  const rateLimitStateRef = useRef(rateLimitState);
  useEffect(() => {
    rateLimitStateRef.current = rateLimitState;
  }, [rateLimitState]);

  const isCheckingRef = useRef(false);

  const checkRateLimitStatus = useCallback(async () => {
    if (!globalThis.electronAPI?.anilist?.getRateLimitStatus) return;
    if (isCheckingRef.current) return;

    isCheckingRef.current = true;
    try {
      const status = await globalThis.electronAPI.anilist.getRateLimitStatus();

      if (status.isRateLimited) {
        setRateLimitState({
          isRateLimited: true,
          retryAfter: status.retryAfter,
          message:
            "AniList API rate limit reached. Please wait before making more requests.",
        });
      } else if (rateLimitStateRef.current.isRateLimited) {
        clearRateLimit();
      }
    } catch (error) {
      console.error(
        "[RateLimitContext] Error checking rate limit status:",
        error,
      );
    } finally {
      isCheckingRef.current = false;
    }
  }, [clearRateLimit]);

  useEffect(() => {
    checkRateLimitStatus().catch((err) =>
      console.error("[RateLimitContext] checkRateLimitStatus error:", err),
    );
  }, [checkRateLimitStatus]);

  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollIntervalRef = useRef<number>(1000); // Start with 1 second

  // Adaptive polling: faster when rate-limited, slower when not
  const getNextPollInterval = useCallback(() => {
    if (rateLimitStateRef.current.isRateLimited) {
      // Poll every 1 second when rate-limited (need to know when it clears)
      return 1000;
    } else {
      // Gradually increase interval when not rate-limited, max 5 seconds
      const current = pollIntervalRef.current;
      return Math.min(current * 1.2, 5000);
    }
  }, []);

  const schedulePoll = useCallback(() => {
    if (pollTimerRef.current) return;

    const interval = getNextPollInterval();
    pollIntervalRef.current = interval;

    pollTimerRef.current = setTimeout(() => {
      pollTimerRef.current = null;
      checkRateLimitStatus()
        .then(() => {
          // Schedule next poll
          schedulePoll();
        })
        .catch((err) => {
          console.error("[RateLimitContext] checkRateLimitStatus error:", err);
          // Schedule next poll even on error
          schedulePoll();
        });
    }, interval);
  }, [checkRateLimitStatus, getNextPollInterval]);

  const startPolling = useCallback(() => {
    if (pollTimerRef.current) return;
    console.debug("[RateLimitContext] ▶️ Starting adaptive polling");
    pollIntervalRef.current = 1000; // Reset to fast polling
    // Immediate check
    checkRateLimitStatus()
      .then(() => schedulePoll())
      .catch((err) => {
        console.error("[RateLimitContext] Initial check error:", err);
        schedulePoll();
      });
  }, [checkRateLimitStatus, schedulePoll]);

  const stopPolling = useCallback(() => {
    if (!pollTimerRef.current) return;
    console.debug("[RateLimitContext] ⏹️ Stopping polling");
    clearTimeout(pollTimerRef.current);
    pollTimerRef.current = null;
    pollIntervalRef.current = 1000; // Reset interval
  }, []);

  const handleMatchingState = useCallback(
    (event: Event) => {
      const detail = (event as CustomEvent<{ isRunning: boolean }>).detail;
      if (detail?.isRunning) {
        startPolling();
      } else {
        stopPolling();
      }
    },
    [startPolling, stopPolling],
  );

  const handleRequestComplete = useCallback(() => {
    checkRateLimitStatus().catch((err) =>
      console.error("[RateLimitContext] checkRateLimitStatus error:", err),
    );
  }, [checkRateLimitStatus]);

  useEffect(() => {
    globalThis.addEventListener(
      "anilist:request:completed",
      handleRequestComplete,
    );

    return () => {
      globalThis.removeEventListener(
        "anilist:request:completed",
        handleRequestComplete,
      );
    };
  }, [handleRequestComplete]);

  useEffect(() => {
    if (globalThis.matchingProcessState?.isRunning) {
      startPolling();
    }

    globalThis.addEventListener("matching:state", handleMatchingState);

    return () => {
      stopPolling();
      globalThis.removeEventListener("matching:state", handleMatchingState);
    };
  }, [startPolling, stopPolling, handleMatchingState]);

  // Listen for global rate limiting events
  useEffect(() => {
    const handleRateLimit = (event: Event) => {
      const customEvent = event as CustomEvent;
      if (customEvent.detail) {
        const { retryAfter, message } = customEvent.detail;
        console.debug(
          "[RateLimitContext] Received rate limit event:",
          customEvent.detail,
        );
        setRateLimit(true, retryAfter, message);
      }
    };

    // Add event listener for the custom rate limiting event
    globalThis.addEventListener("anilist:rate-limited", handleRateLimit);

    // Clean up the listener on unmount
    return () => {
      globalThis.removeEventListener("anilist:rate-limited", handleRateLimit);
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

  useEffect(() => {
    emitRateLimitSnapshot();
  }, [rateLimitState, toastId, emitRateLimitSnapshot]);

  useEffect(() => {
    if (!registerRateLimitInspector) return;

    rateLimitSnapshotRef.current = getRateLimitSnapshotRef.current();

    const handle = registerRateLimitInspector<RateLimitDebugSnapshot>({
      id: "rate-limit-state",
      label: "Rate Limit",
      description:
        "AniList API rate limit flags, retry timestamp, and active toast identifier.",
      group: "Application",
      getSnapshot: () =>
        rateLimitSnapshotRef.current ?? getRateLimitSnapshotRef.current(),
      setSnapshot: applyRateLimitDebugSnapshot,
    });

    rateLimitInspectorHandleRef.current = handle;

    return () => {
      handle.unregister();
      rateLimitInspectorHandleRef.current = null;
      rateLimitSnapshotRef.current = null;
    };
  }, [registerRateLimitInspector, applyRateLimitDebugSnapshot]);

  const contextValue = React.useMemo(
    () => ({ rateLimitState, setRateLimit, clearRateLimit }),
    [rateLimitState, setRateLimit, clearRateLimit],
  );

  return (
    <RateLimitContext.Provider value={contextValue}>
      {children}
    </RateLimitContext.Provider>
  );
}

/**
 * Custom hook to access the rate limit context.
 *
 * @returns The current rate limit context value.
 * @throws If used outside of a RateLimitProvider.
 * @source
 */
export function useRateLimit() {
  const context = useContext(RateLimitContext);
  if (context === undefined) {
    throw new Error("useRateLimit must be used within a RateLimitProvider");
  }
  return context;
}

/**
 * Toast component to display rate limit countdown and message.
 *
 * @param message - The message to display to the user.
 * @param retryAfter - The timestamp (ms) when requests can be retried.
 * @param onComplete - Callback when the countdown completes.
 * @returns The rendered toast component.
 * @source
 */
function RateLimitToast({
  message,
  retryAfter,
  onComplete,
}: Readonly<{
  message: string;
  retryAfter: number;
  onComplete: () => void;
}>) {
  const [timeRemaining, setTimeRemaining] = useState<number>(0);
  const [initialDuration, setInitialDuration] = useState<number>(0);

  useEffect(() => {
    // Calculate initial time remaining
    const calcTimeRemaining = () => Math.max(retryAfter - Date.now(), 0);

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
