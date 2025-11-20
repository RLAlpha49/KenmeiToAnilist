/**
 * High-level helper for recalculating confidence values using workers when available.
 * Falls back to a chunked main-thread implementation to keep the UI responsive.
 * @source
 */

import type { MangaMatchResult } from "@/api/anilist/types";
import type { MatchEngineConfig } from "@/api/matching/match-engine";
import { getGenericWorkerPool } from "@/workers/internal";
import type { WorkerTask, WorkerMessage } from "@/workers/internal";
import { recalculateConfidenceForMatches } from "@/workers/core/worker/operations/confidence-recalculation-helper";
import type { ConfidenceRecalculationCancelledMessage } from "@/workers/core/types";

export interface ConfidenceRecalculationMetadata {
  durationMs?: number;
  processed?: number;
  totalItems?: number;
  cancelled?: boolean;
}

export interface ConfidenceRecalculationResult {
  results: MangaMatchResult[];
  metadata?: ConfidenceRecalculationMetadata;
}

const isConfidenceRecalculationCancelledMessage = (
  value: unknown,
): value is ConfidenceRecalculationCancelledMessage => {
  const candidate = value as Record<string, unknown>;
  if (candidate.type !== "CONFIDENCE_RECALC_CANCELLED") {
    return false;
  }
  const payload = candidate.payload;
  return typeof payload === "object" && payload !== null;
};

const toNumberOrDefault = (value: unknown, fallback: number): number =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback;

const normalizeConfidenceRecalculationResult = (
  value: unknown,
  matches: MangaMatchResult[],
): ConfidenceRecalculationResult => {
  if (isConfidenceRecalculationCancelledMessage(value)) {
    const { payload } = value;
    const processed = toNumberOrDefault(payload.itemsProcessed, 0);
    const totalItems = toNumberOrDefault(payload.totalItems, matches.length);
    return {
      results: matches,
      metadata: {
        cancelled: true,
        processed,
        totalItems,
      },
    };
  }

  const candidate = value as ConfidenceRecalculationResult | undefined;
  const incomingMetadata = candidate?.metadata;
  const normalizedResults = Array.isArray(candidate?.results)
    ? candidate.results
    : matches;
  const normalizedMetadata: ConfidenceRecalculationMetadata = {
    durationMs: incomingMetadata?.durationMs,
    cancelled: incomingMetadata?.cancelled,
    processed: toNumberOrDefault(
      incomingMetadata?.processed,
      normalizedResults.length,
    ),
    totalItems: toNumberOrDefault(incomingMetadata?.totalItems, matches.length),
  };

  return {
    results: normalizedResults,
    metadata: normalizedMetadata,
  };
};

export interface ConfidenceRecalculationExecution {
  taskId: string;
  promise: Promise<ConfidenceRecalculationResult>;
  cancel: () => void;
}

export interface ConfidenceRecalculationOptions {
  useWorkers?: boolean;
  onProgress?: (current: number, total: number, currentTitle?: string) => void;
  shouldContinue?: () => boolean;
  /** How many matches to process before yielding back to the event loop. */
  yieldEvery?: number;
}

const LARGE_MATCH_YIELD_THRESHOLD = 5000;
const LARGE_MATCH_YIELD_COUNT = 20;

const createTaskId = () =>
  `confidence-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

/**
 * Executes confidence recalculation using a worker when possible.
 * Falls back to main-thread processing if workers are not available.
 * @source
 */
export function recalculateConfidenceScores(
  matches: MangaMatchResult[],
  config: Partial<MatchEngineConfig>,
  options: ConfidenceRecalculationOptions = {},
): ConfidenceRecalculationExecution {
  const taskId = createTaskId();
  const pool = getGenericWorkerPool();
  const { useWorkers = true, onProgress, shouldContinue, yieldEvery } = options;
  const effectiveYieldEvery =
    yieldEvery ??
    (matches.length > LARGE_MATCH_YIELD_THRESHOLD
      ? LARGE_MATCH_YIELD_COUNT
      : undefined);

  const promise = (async () => {
    if (useWorkers) {
      try {
        const result = await executeViaWorker(
          pool,
          taskId,
          matches,
          config,
          onProgress,
          shouldContinue,
          effectiveYieldEvery,
        );
        if (result) {
          return result;
        }
      } catch (error) {
        console.warn(
          "[ConfidenceRecalc] Worker execution failed, falling back to main thread",
          error,
        );
      }
    }

    return recalculateOnMainThread(matches, config, {
      onProgress,
      shouldContinue,
      yieldEvery: effectiveYieldEvery,
    });
  })();

  return {
    taskId,
    promise,
    cancel: () => {
      if (useWorkers) {
        pool.cancelTask(taskId);
      }
    },
  };
}

async function executeViaWorker(
  pool: ReturnType<typeof getGenericWorkerPool>,
  taskId: string,
  matches: MangaMatchResult[],
  config: Partial<MatchEngineConfig>,
  onProgress?: (current: number, total: number, currentTitle?: string) => void,
  shouldContinue?: () => boolean,
  yieldEvery?: number,
): Promise<ConfidenceRecalculationResult | null> {
  await pool.ensureInitialized();

  if (!pool.isAvailable()) {
    return null;
  }

  return new Promise<ConfidenceRecalculationResult>(
    (resolvePromise, reject) => {
      const workerIndex = pool.selectWorker();
      if (workerIndex === -1) {
        recalculateOnMainThread(matches, config, {
          onProgress,
          shouldContinue,
          yieldEvery,
        })
          .then(resolvePromise)
          .catch(reject);
        return;
      }

      const worker = pool.getWorker(workerIndex);
      if (!worker) {
        recalculateOnMainThread(matches, config, {
          onProgress,
          shouldContinue,
          yieldEvery,
        })
          .then(resolvePromise)
          .catch(reject);
        return;
      }

      const task: WorkerTask = {
        taskId,
        isCancelled: false,
        processedItems: 0,
        totalItems: matches.length,
        buildTimeoutResult: ({ processedItems, totalItems }) => ({
          results: matches,
          metadata: {
            cancelled: true,
            processed: processedItems,
            totalItems: totalItems ?? matches.length,
          },
        }),
        resolve: (message) => {
          const normalized = normalizeConfidenceRecalculationResult(
            message,
            matches,
          );
          resolvePromise(normalized);
        },
        reject: (error) => reject(error),
        onProgress: (message: WorkerMessage) => {
          if (message.type !== "PROGRESS") {
            return;
          }
          const payload = (message.payload ?? {}) as Record<string, unknown>;

          if (
            onProgress &&
            typeof payload.current === "number" &&
            typeof payload.total === "number"
          ) {
            onProgress(
              payload.current,
              payload.total,
              payload.currentTitle as string | undefined,
            );
          }

          if (typeof payload.current === "number") {
            task.processedItems = payload.current;
          }
          if (typeof payload.total === "number") {
            task.totalItems = payload.total;
          }
        },
        workerIndex,
      };

      pool.registerTask(taskId, task);

      worker.postMessage({
        type: "CONFIDENCE_RECALC",
        payload: {
          taskId,
          matches,
          config,
          yieldEvery,
        },
      });
    },
  );
}

async function recalculateOnMainThread(
  matches: MangaMatchResult[],
  config: Partial<MatchEngineConfig>,
  options: {
    onProgress?: (
      current: number,
      total: number,
      currentTitle?: string,
    ) => void;
    shouldContinue?: () => boolean;
    yieldEvery?: number;
  } = {},
): Promise<ConfidenceRecalculationResult> {
  const total = matches.length;
  const start = performance.now();
  const { onProgress, shouldContinue, yieldEvery } = options;

  const {
    results: updatedResults,
    processed,
    cancelled,
  } = await recalculateConfidenceForMatches(matches, config, {
    onMatchProcessed: ({ index, match }) => {
      onProgress?.(index + 1, total, match.kenmeiManga.title);
    },
    logPrefix: "[ConfidenceRecalc]",
    shouldContinue,
    yieldEvery,
  });

  return {
    results: updatedResults,
    metadata: {
      durationMs: performance.now() - start,
      processed: processed ?? matches.length,
      totalItems: total,
      cancelled: Boolean(cancelled),
    },
  };
}
