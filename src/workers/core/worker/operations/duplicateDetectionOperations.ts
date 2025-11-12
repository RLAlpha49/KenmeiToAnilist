import type { MangaMatchResult } from "@/api/anilist/types";
import type {
  DuplicateDetectionMessage,
  DuplicateDetectionProgressMessage,
  DuplicateDetectionResultMessage,
} from "../../types";
import { getErrorDetails } from "../errorUtils";

/**
 * Builds a map of AniList IDs to associated match indices and titles.
 * @param matches - Match results to analyze.
 * @param taskId - Task ID for cancellation checks.
 * @param activeTasks - Set tracking active task IDs.
 * @returns Map and comparison count.
 * @source
 */
function buildAniListIdMap(
  matches: MangaMatchResult[],
  taskId: string,
  activeTasks: Set<string>,
): {
  map: Map<
    number,
    { title: string; matchIndices: number[]; kenmeiTitles: string[] }
  >;
  comparisonCount: number;
} {
  const anilistIdMap = new Map<
    number,
    { title: string; matchIndices: number[]; kenmeiTitles: string[] }
  >();
  let comparisonCount = 0;

  for (let i = 0; i < matches.length; i++) {
    const match = matches[i];
    comparisonCount++;

    if (comparisonCount % 100 === 0 && !activeTasks.has(taskId)) {
      return { map: anilistIdMap, comparisonCount };
    }

    if (
      (match.status === "matched" || match.status === "manual") &&
      match.selectedMatch
    ) {
      const anilistId = match.selectedMatch.id;
      const anilistTitle =
        match.selectedMatch.title.romaji ||
        match.selectedMatch.title.english ||
        "Unknown Title";
      const kenmeiTitle = match.kenmeiManga.title;

      if (anilistIdMap.has(anilistId)) {
        const existing = anilistIdMap.get(anilistId)!;
        existing.matchIndices.push(i);
        existing.kenmeiTitles.push(kenmeiTitle);
      } else {
        anilistIdMap.set(anilistId, {
          title: anilistTitle,
          matchIndices: [i],
          kenmeiTitles: [kenmeiTitle],
        });
      }
    }
  }

  return { map: anilistIdMap, comparisonCount };
}

/**
 * Extracts duplicate groups from the AniList ID map.
 * @param anilistIdMap - Map of AniList IDs to match metadata.
 * @param ignoredIds - AniList IDs to exclude from consideration.
 * @returns Duplicate groups.
 * @source
 */
function extractDuplicates(
  anilistIdMap: Map<
    number,
    { title: string; matchIndices: number[]; kenmeiTitles: string[] }
  >,
  ignoredIds: Set<number>,
) {
  const duplicates = [];
  for (const [anilistId, value] of anilistIdMap) {
    if (value.kenmeiTitles.length > 1 && !ignoredIds.has(anilistId)) {
      duplicates.push({
        anilistId,
        anilistTitle: value.title,
        matchIndices: value.matchIndices,
        kenmeiTitles: value.kenmeiTitles,
      });
    }
  }
  return duplicates;
}

/**
 * Detects duplicate mappings where one AniList ID maps to multiple Kenmei titles.
 * @param message - Worker message with matches and detection settings.
 * @param activeTasks - Set tracking active task IDs.
 * @returns Void; posts DUPLICATE_DETECTION_RESULT or ERROR.
 * @source
 */
export function handleDuplicateDetection(
  message: DuplicateDetectionMessage,
  activeTasks: Set<string>,
): void {
  const { taskId, matches, ignoredDuplicateIds } = message.payload;

  activeTasks.add(taskId);

  console.debug(
    `[Worker] 🔍 Starting duplicate detection for task ${taskId} (${matches.length} matches)`,
  );

  const startTime = performance.now();

  try {
    const ignoredIds = new Set(ignoredDuplicateIds);

    const { map: anilistIdMap, comparisonCount } = buildAniListIdMap(
      matches,
      taskId,
      activeTasks,
    );

    if (!activeTasks.has(taskId)) {
      console.warn(
        `[Worker] ⚠️ Duplicate detection task ${taskId} was cancelled after ${comparisonCount} comparisons`,
      );
      globalThis.postMessage({
        type: "DUP_DETECTION_CANCELLED",
        payload: {
          taskId,
          comparisonsCompleted: comparisonCount,
        },
      });
      return;
    }

    const progressMsg: DuplicateDetectionProgressMessage = {
      type: "DUPLICATE_DETECTION_PROGRESS",
      payload: {
        taskId,
        current: comparisonCount,
        total: matches.length,
        message: "Identifying duplicate groups",
      },
    };
    globalThis.postMessage(progressMsg);

    const duplicates = extractDuplicates(anilistIdMap, ignoredIds);

    if (!activeTasks.has(taskId)) {
      console.warn(
        `[Worker] ⚠️ Duplicate detection task ${taskId} was cancelled before completion`,
      );
      globalThis.postMessage({
        type: "DUP_DETECTION_CANCELLED",
        payload: {
          taskId,
          stage: "completion",
        },
      });
      return;
    }

    const processingTimeMs = performance.now() - startTime;

    const resultMsg: DuplicateDetectionResultMessage = {
      type: "DUPLICATE_DETECTION_RESULT",
      payload: {
        taskId,
        duplicates,
        timing: {
          processingTimeMs,
          comparisonCount,
        },
      },
    };

    console.info(
      `[Worker] ✅ Duplicate detection task ${taskId} completed (${duplicates.length} groups found, ${comparisonCount} comparisons, ${processingTimeMs.toFixed(2)}ms)`,
    );

    globalThis.postMessage(resultMsg);
  } catch (error) {
    console.error(
      `[Worker] ❌ Error in duplicate detection task ${taskId}:`,
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
