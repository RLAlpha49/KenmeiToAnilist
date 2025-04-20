/**
 * Data processor for Kenmei manga data
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
 * Options for processing Kenmei data
 */
export interface ProcessOptions {
  batchSize: number;
  parseOptions: Partial<KenmeiParseOptions>;
  statusMapping?: Partial<StatusMappingConfig>;
  preferVolumes: boolean;
  normalizeScores: boolean;
}

/**
 * Default processing options
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
 * Process a Kenmei export file
 * @param fileContent Raw content of the export file
 * @param options Processing options
 * @returns Processing results
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
    if (error instanceof Error) {
      throw new Error(`Failed to process Kenmei data: ${error.message}`);
    }
    throw new Error("Failed to process Kenmei data: Unknown error");
  }
}

/**
 * Prepare Kenmei manga entry for AniList synchronization
 * @param manga Kenmei manga entry
 * @param anilistMatch Matching AniList manga entry
 * @param options Processing options
 * @returns Prepared entry ready for AniList update
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
  const progress = manga.chapters_read;
  let progressVolumes: number | undefined = manga.volumes_read;

  // If we prefer volumes and have volume data, set progress to volumes
  if (processOptions.preferVolumes && manga.volumes_read !== undefined) {
    progressVolumes = manga.volumes_read;
  }

  // Normalize score if needed (Kenmei uses 1-10, AniList uses 1-100 or 1-10 depending on settings)
  let score: number | undefined = manga.score;
  if (processOptions.normalizeScores && score > 0) {
    // We'll assume AniList is using the 100-point scale
    score = Math.round(score * 10);
  }

  return {
    mediaId: anilistMatch.id,
    status,
    progress,
    progressVolumes,
    score: score > 0 ? score : undefined,
  };
}

/**
 * Extract reading statistics from Kenmei data
 * @param manga Array of Kenmei manga entries
 * @returns Reading statistics
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

  manga.forEach((entry) => {
    // Count chapters and volumes
    totalChapters += entry.chapters_read || 0;
    totalVolumes += entry.volumes_read || 0;

    // Count completed and in-progress manga
    if (entry.status === "completed") {
      completedManga++;
    } else if (entry.status === "reading") {
      inProgressManga++;
    }

    // Track status breakdown
    statusBreakdown[entry.status] = (statusBreakdown[entry.status] || 0) + 1;
  });

  return {
    totalChapters,
    totalVolumes,
    completedManga,
    inProgressManga,
    statusBreakdown,
  };
}

/**
 * Process manga entries in smaller batches to avoid memory issues
 * @param entries Array of Kenmei manga entries
 * @param processFn Function to process each batch
 * @param batchSize Size of each batch
 * @returns Aggregated results
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
    const batchResults = await processFn(batch);
    results.push(...batchResults);
  }

  return results;
}

/**
 * Filter manga entries based on criteria
 * @param entries Array of Kenmei manga entries
 * @param criteria Filter criteria
 * @returns Filtered entries
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
    // Filter by status
    if (criteria.status && !criteria.status.includes(entry.status)) {
      return false;
    }

    // Filter by minimum chapters
    if (
      criteria.minChapters !== undefined &&
      entry.chapters_read < criteria.minChapters
    ) {
      return false;
    }

    // Filter by having progress
    if (
      criteria.hasProgress &&
      entry.chapters_read <= 0 &&
      (!entry.volumes_read || entry.volumes_read <= 0)
    ) {
      return false;
    }

    // Filter by having score
    if (criteria.hasScore && (!entry.score || entry.score <= 0)) {
      return false;
    }

    return true;
  });
}
