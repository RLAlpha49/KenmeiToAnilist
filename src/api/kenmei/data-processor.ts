/**
 * @packageDocumentation
 * @module kenmei-data-processor
 * @description Data processor for Kenmei manga data, including processing, preparation for sync, statistics extraction, batch processing, and filtering utilities.
 */

import { AniListManga } from "../anilist/types";
import { mapKenmeiToAniListStatus } from "./status-mapper";
import {
  KenmeiManga,
  KenmeiParseOptions,
  KenmeiStatus,
  ProcessingResult,
  StatusMappingConfig,
} from "./types";
import { parseKenmeiExport, processKenmeiMangaBatches } from "./parser";
import { withGroup, withGroupAsync } from "@/utils/logging";

/**
 * Configuration options for Kenmei data processing, including batch size, parsing rules, and normalization settings.
 * @source
 */
export interface ProcessOptions {
  batchSize: number;
  parseOptions: Partial<KenmeiParseOptions>;
  statusMapping?: Partial<StatusMappingConfig>;
  preferVolumes: boolean;
  normalizeScores: boolean;
}

/**
 * Default Kenmei processing configuration with 50-item batches, validation enabled, and score normalization.
 * @source
 */
export const DEFAULT_PROCESS_OPTIONS: ProcessOptions = {
  batchSize: 50,
  parseOptions: {
    validateStructure: true,
    allowPartialData: true,
    defaultStatus: "plan_to_read",
  },
  preferVolumes: false,
  normalizeScores: true,
};

/**
 * Process a Kenmei export file, parsing and validating all entries.
 * @param fileContent - Raw export file content.
 * @param options - Optional processing configuration.
 * @returns Processed manga entries with validation results.
 * @throws {Error} If parsing or processing fails.
 * @source
 */
export function processKenmeiExport(
  fileContent: string,
  options: Partial<ProcessOptions> = {},
): ProcessingResult {
  return withGroup(`[KenmeiProcessor] Process Export`, () => {
    const processOptions = { ...DEFAULT_PROCESS_OPTIONS, ...options };

    try {
      // Parse the export data
      const exportData = parseKenmeiExport(
        fileContent,
        processOptions.parseOptions,
      );

      // Process the manga entries in batches
      return processKenmeiMangaBatches(
        exportData.manga,
        processOptions.batchSize,
        processOptions.parseOptions,
      );
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      throw new Error(`Failed to process Kenmei data: ${msg}`);
    }
  });
}

/**
 * Prepare a Kenmei manga entry for AniList synchronization, mapping status and scores.
 * @param manga - Kenmei manga entry to prepare.
 * @param anilistMatch - Matched AniList manga entry with ID.
 * @param options - Optional processing configuration.
 * @returns AniList-formatted entry ready for sync with mediaId, status, progress, and optional score.
 * @source
 */
export function prepareEntryForSync(
  manga: KenmeiManga,
  anilistMatch: AniListManga,
  options: Partial<ProcessOptions> = {},
): {
  mediaId: number;
  status: string;
  progress: number;
  score?: number;
  progressVolumes?: number;
} {
  const processOptions = { ...DEFAULT_PROCESS_OPTIONS, ...options };

  // Map the status
  const status = mapKenmeiToAniListStatus(
    manga.status,
    processOptions.statusMapping,
  );

  // Determine progress (chapters vs volumes)
  // Use guard clauses and prefer explicit undefined over nullish values
  const hasVolumeData =
    manga.volumes_read !== undefined && manga.volumes_read !== null;

  // If preferVolumes and volume data exists, use volumes only; otherwise use chapters
  let progress: number;
  let progressVolumes: number | undefined;

  if (processOptions.preferVolumes && hasVolumeData) {
    // When preferring volumes, set progress to 0 and expose only progressVolumes
    progress = 0;
    progressVolumes = manga.volumes_read;
  } else {
    // Default: use chapters for progress, optionally expose volumes
    progress = manga.chapters_read ?? 0;
    progressVolumes = hasVolumeData ? manga.volumes_read : undefined;
  }

  // Normalize score if needed (Kenmei uses 1-10, AniList uses 1-100 or 1-10 depending on settings)
  let rawScore = manga.score ?? undefined;
  if (
    processOptions.normalizeScores &&
    typeof rawScore === "number" &&
    rawScore > 0
  ) {
    // We'll assume AniList is using the 100-point scale
    rawScore = Math.round(rawScore * 10);
  }

  const score =
    typeof rawScore === "number" && rawScore > 0 ? rawScore : undefined;

  return {
    mediaId: anilistMatch.id,
    status,
    progress,
    progressVolumes,
    score,
  };
}

/**
 * Extract reading statistics from Kenmei manga entries.
 * @param manga - Array of Kenmei manga entries.
 * @returns Statistics including chapter/volume totals, completion counts, and status breakdown.
 * @source
 */
export function extractReadingStats(manga: KenmeiManga[]): {
  totalChapters: number;
  totalVolumes: number;
  completedManga: number;
  inProgressManga: number;
  statusBreakdown: Record<string, number>;
} {
  let totalChapters = 0;
  let totalVolumes = 0;
  let completedManga = 0;
  let inProgressManga = 0;
  const statusBreakdown: Record<string, number> = {};

  for (const entry of manga) {
    totalChapters += entry.chapters_read ?? 0;
    totalVolumes += entry.volumes_read ?? 0;

    if (entry.status === "completed") {
      completedManga++;
    }
    if (entry.status === "reading") {
      inProgressManga++;
    }

    statusBreakdown[entry.status] = (statusBreakdown[entry.status] || 0) + 1;
  }

  return {
    totalChapters,
    totalVolumes,
    completedManga,
    inProgressManga,
    statusBreakdown,
  };
}

/**
 * Process manga entries in batches to avoid memory issues and enable progress tracking.
 * @param entries - Array of Kenmei manga entries.
 * @param processFn - Async function to process each batch.
 * @param batchSize - Batch size (default: 50).
 * @returns Aggregated results from all batches.
 * @source
 */
export async function processMangaInBatches<T>(
  entries: KenmeiManga[],
  processFn: (batch: KenmeiManga[]) => Promise<T[]>,
  batchSize = 50,
): Promise<T[]> {
  return withGroupAsync(
    `[KenmeiProcessor] Process Batches (${entries.length} entries)`,
    async () => {
      const results: T[] = [];

      // Process in batches
      for (let i = 0; i < entries.length; i += batchSize) {
        const batch = entries.slice(i, i + batchSize);
        if (batch.length === 0) continue;
        const batchResults = await processFn(batch);
        if (batchResults && batchResults.length > 0)
          results.push(...batchResults);
      }

      return results;
    },
  );
}

/**
 * Filter manga entries by status, progress, and score criteria.
 * @param entries - Array of Kenmei manga entries.
 * @param criteria - Filter options including status, minimum chapters, and score presence.
 * @returns Filtered manga entries matching all specified criteria.
 * @source
 */
export function filterMangaEntries(
  entries: KenmeiManga[],
  criteria: {
    status?: KenmeiStatus[];
    minChapters?: number;
    hasProgress?: boolean;
    hasScore?: boolean;
  },
): KenmeiManga[] {
  return entries.filter((entry) => {
    if (criteria.status?.length) {
      if (!criteria.status.includes(entry.status)) return false;
    }

    if (criteria.minChapters !== undefined) {
      if ((entry.chapters_read ?? 0) < criteria.minChapters) return false;
    }

    if (criteria.hasProgress) {
      const chapters = entry.chapters_read ?? 0;
      const volumes = entry.volumes_read ?? 0;
      if (chapters <= 0 && volumes <= 0) return false;
    }

    if (criteria.hasScore) {
      if ((entry.score ?? 0) <= 0) return false;
    }

    return true;
  });
}
