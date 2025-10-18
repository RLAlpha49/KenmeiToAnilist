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
  // State for time tracking
  const [timeEstimate, setTimeEstimate] = useState<TimeEstimate>({
    startTime: 0,
    averageTimePerManga: 0,
    estimatedRemainingSeconds: 0,
  });

  const [isPaused, setIsPaused] = useState(false);

  // Refs for stable time tracking
  const processingStartTimeRef = useRef<number>(0);
  const lastProcessedCountRef = useRef<number>(0);
  const processingTimesRef = useRef<number[]>([]);
  const lastTimeUpdateRef = useRef<number>(0);
  const pauseCountRef = useRef<number>(0);
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

      // Only update time estimate if we've made progress
      if (current <= lastProcessedCountRef.current) {
        return;
      }

      // Skip updates while paused to prevent skewed averages
      if (pauseCountRef.current > 0) {
        return;
      }

      // Calculate time since last update
      const timeSinceLastUpdate = now - lastTimeUpdateRef.current;

      // Calculate items processed since last update
      const itemsProcessed = current - lastProcessedCountRef.current;

      // Only update if we've processed at least one item and time has passed
      if (itemsProcessed > 0 && timeSinceLastUpdate > 0) {
        // Calculate time per item for this batch
        const timePerItem = timeSinceLastUpdate / itemsProcessed;

        // Add to our processing times array (limit to last 10 values for a moving average)
        processingTimesRef.current.push(timePerItem);
        if (processingTimesRef.current.length > 10) {
          processingTimesRef.current.shift();
        }

        // Calculate average time per item from our collected samples
        const avgTimePerItem =
          processingTimesRef.current.reduce((sum, time) => sum + time, 0) /
          processingTimesRef.current.length;

        // Calculate remaining time based on average speed
        const remainingItems = total - current;
        const estimatedRemainingMs = avgTimePerItem * remainingItems;

        // Cap at 24 hours for sanity and add validation
        const maxTimeMs = 24 * 60 * 60 * 1000;

        // Validate that the estimated time is reasonable (not NaN, Infinity, or negative)
        const isValidEstimate =
          Number.isFinite(estimatedRemainingMs) &&
          estimatedRemainingMs >= 0 &&
          estimatedRemainingMs < Number.MAX_SAFE_INTEGER;

        const cappedEstimatedMs = isValidEstimate
          ? Math.min(estimatedRemainingMs, maxTimeMs)
          : 0;

        // Update state with new estimate
        const newEstimate = {
          startTime: processingStartTimeRef.current,
          averageTimePerManga: avgTimePerItem,
          estimatedRemainingSeconds: Math.round(cappedEstimatedMs / 1000),
        };

        setTimeEstimate(newEstimate);

        // Update global tracking state
        if (globalThis.matchingProcessState) {
          // eslint-disable-next-line react-compiler/react-compiler
          globalThis.matchingProcessState.timeEstimate = newEstimate;
          globalThis.matchingProcessState.lastUpdated = now;
        }

        // Update refs for next calculation
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

    // Only reset if we don't have a running process with valid timing data
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

      // Reset time estimate state
      const initialEstimate = {
        startTime: now,
        averageTimePerManga: 0,
        estimatedRemainingSeconds: 0,
      };

      setTimeEstimate(initialEstimate);
      return initialEstimate;
    } else {
      // Restore from global state and populate refs for continued tracking
      console.debug("[TimeEstimate] Preserving existing time tracking data");
      const globalEstimate = globalThis.matchingProcessState?.timeEstimate;

      if (globalEstimate) {
        // Restore refs so calculateTimeEstimate can continue working
        processingStartTimeRef.current = globalEstimate.startTime;
        lastProcessedCountRef.current =
          globalThis.matchingProcessState?.progress.current || 0;
        lastTimeUpdateRef.current = now;

        // If we have an average time, populate processingTimesRef with it
        // so we maintain continuity in time estimates
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
    }
  }, []);

  /**
   * Pauses time tracking to prevent skewing of average times during idle periods.
   * Increments a pause counter for nested pause/resume support.
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
   * Resumes time tracking after pause, adjusting start time by paused duration.
   * Decrements pause counter, only resuming when count reaches zero.
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
