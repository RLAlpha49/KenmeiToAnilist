/**
 * Worker-side handler to recalculate confidence scores without re-searching.
 * Processes existing match results and updates each confidence value using the
 * latest scoring algorithm while streaming progress updates back to the main thread.
 * @source
 */

import type { ConfidenceRecalculationMessage } from "../../types";
import { getErrorDetails } from "../error-utils";
import { recalculateConfidenceForMatches } from "./confidence-recalculation-helper";

/**
 * Recalculate confidence values for cached matches in a worker context.
 * @param message - Worker message containing matches and config overrides.
 * @param activeTasks - Shared task registry for cancellation tracking.
 * @source
 */
export async function handleConfidenceRecalculation(
  message: ConfidenceRecalculationMessage,
  activeTasks: Set<string>,
): Promise<void> {
  const {
    payload: { taskId, matches, config, yieldEvery },
  } = message;

  activeTasks.add(taskId);

  try {
    const total = matches.length;
    const startedAt = performance.now();

    const {
      results: updatedResults,
      processed,
      cancelled,
    } = await recalculateConfidenceForMatches(matches, config, {
      shouldContinue: () => activeTasks.has(taskId),
      onMatchProcessed: ({ index, match }) => {
        globalThis.postMessage({
          type: "PROGRESS",
          payload: {
            taskId,
            current: index + 1,
            total,
            currentTitle: match.kenmeiManga.title,
          },
        });
      },
      logPrefix: "[Worker] ❌",
      yieldEvery,
    });

    if (cancelled) {
      console.warn(
        `[Worker] ⚠️ Confidence recalculation task ${taskId} cancelled at ${processed}/${total}`,
      );
      globalThis.postMessage({
        type: "CONFIDENCE_RECALC_CANCELLED",
        payload: {
          taskId,
          itemsProcessed: processed,
          totalItems: total,
        },
      });
      return;
    }

    const durationMs = performance.now() - startedAt;

    globalThis.postMessage({
      type: "RESULT",
      payload: {
        taskId,
        results: updatedResults,
        metadata: {
          durationMs,
          processed: matches.length,
        },
      },
    });
  } catch (error) {
    console.error(
      "[Worker] ❌ Unhandled error during confidence recalculation:",
      error,
    );
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
