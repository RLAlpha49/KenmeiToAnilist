/**
 * Web Worker script for CPU-intensive manga matching operations.
 *
 * This worker executes matching operations in a separate thread to keep the main thread responsive.
 * Each worker maintains its own LRU caches for similarity calculations, providing optimal performance
 * without cache contention between workers.
 *
 * @module workers/matching-worker
 */

import { findBestMatches } from "@/api/matching/match-engine";
import type { AniListManga } from "@/api/anilist/types";
import type { MatchBatchMessage, CancelMessage, WorkerMessage } from "./types";
import type { MatchEngineConfig } from "@/api/matching/match-engine";

/**
 * Track active tasks for cancellation support.
 */
const activeTasks = new Set<string>();

/**
 * Handle incoming messages from the main thread.
 */
globalThis.onmessage = async (event: MessageEvent<WorkerMessage>) => {
  const message = event.data;

  try {
    switch (message.type) {
      case "MATCH_BATCH":
        await handleMatchBatch(message);
        break;

      case "CANCEL":
        handleCancel(message);
        break;

      default:
        console.warn("Unknown message type received in worker:", message);
    }
  } catch (error) {
    // Post error message for any unhandled exceptions
    if ("payload" in message && "taskId" in message.payload) {
      globalThis.postMessage({
        type: "ERROR",
        payload: {
          taskId: message.payload.taskId,
          error: {
            message: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
          },
        },
      });
    }
  }
};

/**
 * Handle a batch matching operation.
 */
async function handleMatchBatch(message: MatchBatchMessage): Promise<void> {
  const { kenmeiManga, anilistCandidates, config, taskId } = message.payload;

  // Register task as active
  activeTasks.add(taskId);

  console.debug(
    `[Worker] 🔄 Starting batch match for task ${taskId} (${kenmeiManga.length} items)`,
  );

  try {
    const results = [];
    const total = kenmeiManga.length;
    const startTime = performance.now();

    // Convert candidates array back to Map
    const candidatesMap = new Map<string, AniListManga[]>(anilistCandidates);

    for (let i = 0; i < total; i++) {
      // Check for cancellation
      if (!activeTasks.has(taskId)) {
        console.warn(
          `[Worker] ⚠️ Task ${taskId} was cancelled after ${i}/${total} items`,
        );
        return; // Task was cancelled, exit silently
      }

      const manga = kenmeiManga[i];

      // Get candidates for this manga using index-based key to match results.ts
      const candidates = candidatesMap.get(String(i)) || [];

      // Find best matches using the match engine
      const matchResult = findBestMatches(
        manga,
        candidates,
        config as MatchEngineConfig,
      );

      // Add to results
      results.push(matchResult);

      // Report progress
      globalThis.postMessage({
        type: "PROGRESS",
        payload: {
          taskId,
          current: i + 1,
          total,
          currentTitle: manga.title,
        },
      });

      // Log progress at intervals
      if ((i + 1) % 50 === 0 || i === 0) {
        console.debug(`[Worker] 📊 Task ${taskId} progress: ${i + 1}/${total}`);
      }
    }

    const duration = performance.now() - startTime;
    console.info(
      `[Worker] ✅ Batch match task ${taskId} completed (${results.length} results in ${duration.toFixed(2)}ms)`,
    );

    // Send final results
    globalThis.postMessage({
      type: "RESULT",
      payload: {
        taskId,
        results,
      },
    });
  } catch (error) {
    console.error(`[Worker] ❌ Error processing task ${taskId}:`, error);
    // Post error message
    globalThis.postMessage({
      type: "ERROR",
      payload: {
        taskId,
        error: {
          message: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        },
      },
    });
  } finally {
    // Clean up task
    activeTasks.delete(taskId);
  }
}

/**
 * Handle a cancellation request.
 */
function handleCancel(message: CancelMessage): void {
  const { taskId } = message.payload;
  console.debug(`[Worker] ⏹️ Cancel requested for task ${taskId}`);
  activeTasks.delete(taskId);
}
