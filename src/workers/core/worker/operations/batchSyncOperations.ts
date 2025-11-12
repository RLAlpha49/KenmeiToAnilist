import type { AniListMediaEntry } from "@/api/anilist/types";
import type {
  BatchSyncMessage,
  BatchSyncProgressMessage,
  BatchSyncResultMessage,
  PreparedSyncOperation,
} from "../../types";
import { getErrorDetails } from "../errorUtils";

/**
 * Determines which incremental sync steps are required for an entry.
 * @param entry - The AniList media entry to evaluate.
 * @returns Step numbers indicating required updates.
 * @source
 */
function getIncrementalStepsForEntry(entry: AniListMediaEntry): number[] {
  const steps: number[] = [];

  if (
    !entry.previousValues ||
    entry.progress !== entry.previousValues.progress
  ) {
    steps.push(1);
  }

  if (
    !entry.previousValues ||
    entry.status !== entry.previousValues.status ||
    entry.score !== entry.previousValues.score
  ) {
    steps.push(2);
  }

  return steps.length > 0 ? steps : [1];
}

/**
 * Groups entries by media ID and materializes incremental steps.
 * @param entries - Flat array of AniList media entries to organize.
 * @returns Map of mediaId to step-expanded entries.
 * @source
 */
function organizeEntriesByMediaIdForWorker(
  entries: AniListMediaEntry[],
): Record<number, AniListMediaEntry[]> {
  const entriesByMediaId: Record<number, AniListMediaEntry[]> = {};

  for (const entry of entries) {
    if (!entriesByMediaId[entry.mediaId]) {
      entriesByMediaId[entry.mediaId] = [];
    }

    if (entry.syncMetadata?.useIncrementalSync) {
      const steps = getIncrementalStepsForEntry(entry);
      for (const step of steps) {
        const stepEntry = { ...entry };
        stepEntry.syncMetadata = {
          ...entry.syncMetadata,
          step,
        };
        entriesByMediaId[entry.mediaId].push(stepEntry);
      }
    } else {
      entriesByMediaId[entry.mediaId].push(entry);
    }
  }

  return entriesByMediaId;
}

/**
 * Builds GraphQL variables for a given entry and sync step.
 * @param entry - The AniList media entry to build variables for.
 * @param step - The sync step number determining which fields to include.
 * @returns Variables object for the specified step.
 * @source
 */
function buildGraphQLVariablesForEntry(
  entry: AniListMediaEntry,
  step: number,
): Record<string, unknown> {
  const baseVariables = {
    mediaId: entry.mediaId,
    status: entry.status,
  };

  if (step === 1) {
    return {
      ...baseVariables,
      progress: entry.progress,
    };
  } else if (step === 2) {
    return {
      ...baseVariables,
      score: entry.score,
      private: entry.private,
    };
  }

  return baseVariables;
}

/**
 * Prepares batch sync operations in a worker (grouping, steps, variables).
 * @param message - Worker message containing entries to sync.
 * @param activeTasks - Set tracking active task IDs for cancellation.
 * @returns Promise that posts result and progress messages.
 * @source
 */
export async function handleBatchSync(
  message: BatchSyncMessage,
  activeTasks: Set<string>,
): Promise<void> {
  const { taskId, entries } = message.payload;

  try {
    activeTasks.add(taskId);

    console.info(
      `[Worker] 📦 Starting batch sync pre-processing for ${entries.length} entries`,
    );

    const startTime = performance.now();

    if (!activeTasks.has(taskId)) {
      console.warn(
        `[Worker] ⚠️ Batch sync task ${taskId} was cancelled during organizing`,
      );
      globalThis.postMessage({
        type: "BATCH_SYNC_CANCELLED",
        payload: {
          taskId,
          phase: "organizing",
        },
      });
      return;
    }

    const progressMsg1: BatchSyncProgressMessage = {
      type: "BATCH_SYNC_PROGRESS",
      payload: {
        taskId,
        phase: "organizing",
        processed: 0,
        total: entries.length,
      },
    };
    globalThis.postMessage(progressMsg1);

    const entriesByMediaId = organizeEntriesByMediaIdForWorker(entries);
    const mediaIds = Object.keys(entriesByMediaId)
      .map(Number)
      .sort((a, b) => a - b);

    if (!activeTasks.has(taskId)) {
      console.warn(
        `[Worker] ⚠️ Batch sync task ${taskId} was cancelled during building`,
      );
      globalThis.postMessage({
        type: "BATCH_SYNC_CANCELLED",
        payload: {
          taskId,
          phase: "building",
        },
      });
      return;
    }

    const progressMsg2: BatchSyncProgressMessage = {
      type: "BATCH_SYNC_PROGRESS",
      payload: {
        taskId,
        phase: "building",
        processed: 0,
        total: mediaIds.length,
      },
    };
    globalThis.postMessage(progressMsg2);

    const operations: PreparedSyncOperation[] = [];
    const failedEntries: Array<{ mediaId: number; error: string }> = [];
    let totalApiCallsEstimate = 0;

    for (let i = 0; i < mediaIds.length; i++) {
      if (!activeTasks.has(taskId)) {
        console.warn(
          `[Worker] ⚠️ Batch sync task ${taskId} was cancelled during building`,
        );
        globalThis.postMessage({
          type: "BATCH_SYNC_CANCELLED",
          payload: {
            taskId,
            phase: "building",
          },
        });
        return;
      }

      const mediaId = mediaIds[i];
      const mediaEntries = entriesByMediaId[mediaId];

      try {
        const steps = mediaEntries
          .map((e) => e.syncMetadata?.step || 1)
          .filter((step, idx, arr) => arr.indexOf(step) === idx)
          .sort((a, b) => a - b);

        const variables = mediaEntries.map((entry) =>
          buildGraphQLVariablesForEntry(entry, entry.syncMetadata?.step || 1),
        );

        const operation: PreparedSyncOperation = {
          mediaId,
          entries: mediaEntries,
          steps,
          variables,
          estimatedApiCalls: steps.length,
        };

        operations.push(operation);
        totalApiCallsEstimate += steps.length;

        if ((i + 1) % 10 === 0) {
          const progressMsg: BatchSyncProgressMessage = {
            type: "BATCH_SYNC_PROGRESS",
            payload: {
              taskId,
              phase: "building",
              processed: i + 1,
              total: mediaIds.length,
              currentMediaId: mediaId,
            },
          };
          globalThis.postMessage(progressMsg);
        }
      } catch (error) {
        failedEntries.push({
          mediaId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    if (!activeTasks.has(taskId)) {
      console.warn(
        `[Worker] ⚠️ Batch sync task ${taskId} was cancelled before completion`,
      );
      globalThis.postMessage({
        type: "BATCH_SYNC_CANCELLED",
        payload: {
          taskId,
          phase: "completion",
        },
      });
      return;
    }

    const progressMsg3: BatchSyncProgressMessage = {
      type: "BATCH_SYNC_PROGRESS",
      payload: {
        taskId,
        phase: "ready",
        processed: mediaIds.length,
        total: mediaIds.length,
      },
    };
    globalThis.postMessage(progressMsg3);

    const totalTime = performance.now() - startTime;

    const resultMsg: BatchSyncResultMessage = {
      type: "BATCH_SYNC_RESULT",
      payload: {
        taskId,
        operations,
        totalApiCallsEstimate,
        failedEntries,
      },
    };

    console.info(
      `[Worker] ✅ Batch sync pre-processing completed: ${operations.length} operations, ${totalApiCallsEstimate} estimated API calls, ${failedEntries.length} failures (${totalTime.toFixed(2)}ms)`,
    );

    globalThis.postMessage(resultMsg);
  } catch (error) {
    console.error(`[Worker] ❌ Error in batch sync task ${taskId}:`, error);
    globalThis.postMessage({
      type: "ERROR",
      payload: {
        taskId,
        error: getErrorDetails(error),
      },
    });
  } finally {
    activeTasks.delete(taskId);
  }
}
