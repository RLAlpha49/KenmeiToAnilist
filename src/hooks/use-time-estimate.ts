/**
 * @packageDocumentation
 * @module useTimeEstimate
 * @description Custom React hook for tracking and calculating time estimates during batch processes, such as manga synchronization or matching.
 */
import { useState, useRef, useCallback } from "react";
import { TimeEstimate } from "../types/matching";

/**
 * Hook for tracking and calculating time estimates during batch processes.
 * Maintains a moving average of processing times to predict remaining duration.
 * @returns Object with time estimate state and tracking control methods.
 * @source
 */
export const useTimeEstimate = () => {
  /** Current time estimate and calculation state. @source */
  const [timeEstimate, setTimeEstimate] = useState<TimeEstimate>({
    startTime: 0,
    averageTimePerManga: 0,
    estimatedRemainingSeconds: 0,
  });

  /** Whether time tracking is currently paused. @source */
  const [isPaused, setIsPaused] = useState(false);

  /** Start time of the current processing session. @source */
  const processingStartTimeRef = useRef<number>(0);
  /** Number of items processed as of last time estimate update. @source */
  const lastProcessedCountRef = useRef<number>(0);
  /** Array of processing times per item (moving window of 10 samples). @source */
  const processingTimesRef = useRef<number[]>([]);
  /** Timestamp of the last time estimate calculation. @source */
  const lastTimeUpdateRef = useRef<number>(0);
  /** Nesting counter for pause/resume balance tracking. @source */
  const pauseCountRef = useRef<number>(0);
  /** Timestamp when pause was initiated for duration calculation. @source */
  const pauseStartRef = useRef<number | null>(null);

  /**
   * Calculates estimated time remaining using a moving average of processing times.
   * Skips updates during pause periods and requires progress to have advanced.
   * @param current - Number of items processed so far.
   * @param total - Total number of items to process.
   * @source
   */
  const calculateTimeEstimate = useCallback(
    (current: number, total: number) => {
      const now = Date.now();

      // Skip update if no progress made since last calculation
      if (current <= lastProcessedCountRef.current) {
        return;
      }

      // Skip updates while paused to maintain accurate averages
      if (pauseCountRef.current > 0) {
        return;
      }

      const timeSinceLastUpdate = now - lastTimeUpdateRef.current;
      const itemsProcessed = current - lastProcessedCountRef.current;

      if (itemsProcessed > 0 && timeSinceLastUpdate > 0) {
        const timePerItem = timeSinceLastUpdate / itemsProcessed;

        // Maintain moving window of processing times (last 10 samples)
        processingTimesRef.current.push(timePerItem);
        if (processingTimesRef.current.length > 10) {
          processingTimesRef.current.shift();
        }

        const avgTimePerItem =
          processingTimesRef.current.reduce((sum, time) => sum + time, 0) /
          processingTimesRef.current.length;

        const remainingItems = total - current;
        const estimatedRemainingMs = avgTimePerItem * remainingItems;

        // Cap estimate at 24 hours and validate sanity
        const maxTimeMs = 24 * 60 * 60 * 1000;
        const isValidEstimate =
          Number.isFinite(estimatedRemainingMs) &&
          estimatedRemainingMs >= 0 &&
          estimatedRemainingMs < Number.MAX_SAFE_INTEGER;

        const cappedEstimatedMs = isValidEstimate
          ? Math.min(estimatedRemainingMs, maxTimeMs)
          : 0;

        const newEstimate = {
          startTime: processingStartTimeRef.current,
          averageTimePerManga: avgTimePerItem,
          estimatedRemainingSeconds: Math.round(cappedEstimatedMs / 1000),
        };

        setTimeEstimate(newEstimate);

        // Sync with global state for cross-component access
        if (globalThis.matchingProcessState) {
          // eslint-disable-next-line react-compiler/react-compiler
          globalThis.matchingProcessState.timeEstimate = newEstimate;
          globalThis.matchingProcessState.lastUpdated = now;
        }

        lastProcessedCountRef.current = current;
        lastTimeUpdateRef.current = now;
      }
    },
    [],
  );

  /**
   * Initializes time tracking for a new process or restores from existing global state.
   * Resets refs and state if no active process, otherwise preserves timing data.
   * @returns Initial time estimate object.
   * @source
   */
  const initializeTimeTracking = useCallback(() => {
    const now = Date.now();

    // Reset if no active process or valid timing data exists
    const shouldReset =
      !globalThis.matchingProcessState?.isRunning ||
      !globalThis.matchingProcessState?.timeEstimate ||
      processingTimesRef.current.length === 0;

    if (shouldReset) {
      processingStartTimeRef.current = now;
      lastProcessedCountRef.current = 0;
      lastTimeUpdateRef.current = now;
      processingTimesRef.current = [];
      pauseCountRef.current = 0;
      pauseStartRef.current = null;
      setIsPaused(false);

      const initialEstimate = {
        startTime: now,
        averageTimePerManga: 0,
        estimatedRemainingSeconds: 0,
      };

      setTimeEstimate(initialEstimate);
      return initialEstimate;
    }

    // Restore from global state and continue with existing tracking
    console.debug("[TimeEstimate] Preserving existing time tracking data");
    const globalEstimate = globalThis.matchingProcessState?.timeEstimate;

    if (globalEstimate) {
      processingStartTimeRef.current = globalEstimate.startTime;
      lastProcessedCountRef.current =
        globalThis.matchingProcessState?.progress.current || 0;
      lastTimeUpdateRef.current = now;

      // Restore timing sample for continuity in estimates
      if (globalEstimate.averageTimePerManga > 0) {
        processingTimesRef.current = [globalEstimate.averageTimePerManga];
      }

      setTimeEstimate(globalEstimate);
      return globalEstimate;
    }

    return {
      startTime: now,
      averageTimePerManga: 0,
      estimatedRemainingSeconds: 0,
    };
  }, []);

  /**
   * Pauses time tracking by incrementing a counter for nested pause/resume support.
   * Prevents skewing averages during idle periods.
   * @source
   */
  const pauseTimeTracking = useCallback(() => {
    if (pauseCountRef.current === 0) {
      pauseStartRef.current = Date.now();
      setIsPaused(true);
    }
    pauseCountRef.current += 1;
  }, []);

  /**
   * Resumes time tracking by decrementing the pause counter.
   * Adjusts start time to account for paused duration only when counter reaches zero.
   * @source
   */
  const resumeTimeTracking = useCallback(() => {
    if (pauseCountRef.current === 0) {
      return;
    }

    pauseCountRef.current -= 1;

    if (pauseCountRef.current === 0 && pauseStartRef.current) {
      const now = Date.now();
      const pausedDuration = now - pauseStartRef.current;
      pauseStartRef.current = null;
      processingStartTimeRef.current += pausedDuration;
      lastTimeUpdateRef.current += pausedDuration;

      setTimeEstimate((prev) => ({
        ...prev,
        startTime: processingStartTimeRef.current,
      }));

      setIsPaused(false);
    }
  }, []);

  return {
    timeEstimate,
    calculateTimeEstimate,
    initializeTimeTracking,
    pauseTimeTracking,
    resumeTimeTracking,
    isPaused,
    setTimeEstimate,
  };
};
