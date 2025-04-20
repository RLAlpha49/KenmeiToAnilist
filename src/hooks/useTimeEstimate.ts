import { useState, useRef, useCallback } from "react";
import { TimeEstimate } from "../types/matching";

/**
 * Hook for tracking and calculating time estimates during batch processes
 */
export const useTimeEstimate = () => {
  // State for time tracking
  const [timeEstimate, setTimeEstimate] = useState<TimeEstimate>({
    startTime: 0,
    averageTimePerManga: 0,
    estimatedRemainingSeconds: 0,
  });

  // Refs for stable time tracking
  const processingStartTimeRef = useRef<number>(0);
  const lastProcessedCountRef = useRef<number>(0);
  const processingTimesRef = useRef<number[]>([]);
  const lastTimeUpdateRef = useRef<number>(0);

  /**
   * Calculate a more stable time estimate using recent processing times
   */
  const calculateTimeEstimate = useCallback(
    (current: number, total: number) => {
      const now = Date.now();

      // Only update time estimate if we've made progress
      if (current <= lastProcessedCountRef.current) {
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

        // Cap at 24 hours for sanity
        const maxTimeMs = 24 * 60 * 60 * 1000;
        const cappedEstimatedMs = Math.min(estimatedRemainingMs, maxTimeMs);

        // Update state with new estimate
        const newEstimate = {
          startTime: processingStartTimeRef.current,
          averageTimePerManga: avgTimePerItem,
          estimatedRemainingSeconds: Math.round(cappedEstimatedMs / 1000),
        };

        setTimeEstimate(newEstimate);

        // Update global tracking state
        if (window.matchingProcessState) {
          // eslint-disable-next-line react-compiler/react-compiler
          window.matchingProcessState.timeEstimate = newEstimate;
          window.matchingProcessState.lastUpdated = now;
        }

        // Update refs for next calculation
        lastProcessedCountRef.current = current;
        lastTimeUpdateRef.current = now;
      }
    },
    [],
  );

  /**
   * Initialize time tracking for a new process
   */
  const initializeTimeTracking = useCallback(() => {
    processingStartTimeRef.current = Date.now();
    lastProcessedCountRef.current = 0;
    lastTimeUpdateRef.current = processingStartTimeRef.current;
    processingTimesRef.current = [];

    // Reset time estimate state
    const initialEstimate = {
      startTime: processingStartTimeRef.current,
      averageTimePerManga: 0,
      estimatedRemainingSeconds: 0,
    };

    setTimeEstimate(initialEstimate);

    return initialEstimate;
  }, []);

  return {
    timeEstimate,
    calculateTimeEstimate,
    initializeTimeTracking,
  };
};
