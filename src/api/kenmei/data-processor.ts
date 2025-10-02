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

/**
 * Options for processing Kenmei data.
 *
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
 * Default processing options.
 *
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
 * Process a Kenmei export file.
 *
 * @param fileContent - Raw content of the export file.
 * @param options - Processing options.
 * @returns Processing results.
 * @source
 */
export function processKenmeiExport(
  fileContent: string,
  options: Partial<ProcessOptions> = {},
): ProcessingResult {
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
}

/**
 * Prepare Kenmei manga entry for AniList synchronization.
 *
 * @param manga - Kenmei manga entry.
 * @param anilistMatch - Matching AniList manga entry.
 * @param options - Processing options.
 * @returns Prepared entry ready for AniList update.
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
  const progress = manga.chapters_read ?? 0;
  const hasVolumeData =
    manga.volumes_read !== undefined && manga.volumes_read !== null;
  // If preferVolumes and volume data exists, expose progressVolumes else undefined
  const progressVolumes =
    processOptions.preferVolumes && hasVolumeData
      ? manga.volumes_read
      : (manga.volumes_read ?? undefined);

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
 * Extract reading statistics from Kenmei data.
 *
 * @param manga - Array of Kenmei manga entries.
 * @returns Reading statistics.
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
 * Process manga entries in smaller batches to avoid memory issues.
 *
 * @param entries - Array of Kenmei manga entries.
 * @param processFn - Function to process each batch.
 * @param batchSize - Size of each batch.
 * @returns Aggregated results.
 * @source
 */
export async function processMangaInBatches<T>(
  entries: KenmeiManga[],
  processFn: (batch: KenmeiManga[]) => Promise<T[]>,
  batchSize = 50,
): Promise<T[]> {
  const results: T[] = [];

  // Process in batches
  for (let i = 0; i < entries.length; i += batchSize) {
    const batch = entries.slice(i, i + batchSize);
    if (batch.length === 0) continue;
    const batchResults = await processFn(batch);
    if (batchResults && batchResults.length > 0) results.push(...batchResults);
  }

  return results;
}

/**
 * Filter manga entries based on criteria.
 *
 * @param entries - Array of Kenmei manga entries.
 * @param criteria - Filter criteria.
 * @returns Filtered entries.
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
