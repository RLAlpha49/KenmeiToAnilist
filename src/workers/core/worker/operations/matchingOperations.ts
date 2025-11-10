import { findBestMatches } from "@/api/matching/match-engine";
import type { AniListManga } from "@/api/anilist/types";
import type { MatchBatchMessage } from "../../types";
import type { MatchEngineConfig } from "@/api/matching/match-engine";
import { getErrorDetails } from "../errorUtils";

/**
 * Performs batch matching of Kenmei manga against AniList candidates.
 * @param message - Worker message with manga list and candidate map.
 * @param activeTasks - Set tracking active task IDs.
 * @returns Promise that posts RESULT or ERROR.
 * @source
 */
export async function handleMatchBatch(
  message: MatchBatchMessage,
  activeTasks: Set<string>,
): Promise<void> {
  const { kenmeiManga, anilistCandidates, config, taskId } = message.payload;

  activeTasks.add(taskId);

  console.debug(
    `[Worker] 🔄 Starting batch match for task ${taskId} (${kenmeiManga.length} items)`,
  );

  try {
    const results = [];
    const total = kenmeiManga.length;
    const startTime = performance.now();

    const candidatesMap = new Map<string, AniListManga[]>(anilistCandidates);

    for (let i = 0; i < total; i++) {
      if (!activeTasks.has(taskId)) {
        console.warn(
          `[Worker] ⚠️ Task ${taskId} was cancelled after ${i}/${total} items`,
        );
        return;
      }

      const manga = kenmeiManga[i];

      const candidates = candidatesMap.get(String(i)) || [];

      const matchResult = findBestMatches(
        manga,
        candidates,
        config as MatchEngineConfig,
      );

      results.push(matchResult);

      globalThis.postMessage({
        type: "PROGRESS",
        payload: {
          taskId,
          current: i + 1,
          total,
          currentTitle: manga.title,
        },
      });

      if ((i + 1) % 50 === 0 || i === 0) {
        console.debug(`[Worker] 📊 Task ${taskId} progress: ${i + 1}/${total}`);
      }
    }

    const duration = performance.now() - startTime;
    console.info(
      `[Worker] ✅ Batch match task ${taskId} completed (${results.length} results in ${duration.toFixed(2)}ms)`,
    );

    globalThis.postMessage({
      type: "RESULT",
      payload: {
        taskId,
        results,
      },
    });
  } catch (error) {
    console.error(`[Worker] ❌ Error processing task ${taskId}:`, error);
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
