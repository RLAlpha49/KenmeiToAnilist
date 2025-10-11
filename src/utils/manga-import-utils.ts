/**
 * @packageDocumentation
 * @module MangaImportUtils
 * @description Utility functions for manga import operations including data processing, merging, and status handling.
 */

import { KenmeiMangaItem } from "../types/kenmei";
import { MatchResult, KenmeiManga } from "./storage";

/**
 * Interface for normalized manga item with guaranteed ID
 */
export interface NormalizedMangaItem extends KenmeiMangaItem {
  id: string | number;
}

/**
 * Interface for import results statistics
 */
export interface ImportResults {
  newMangaCount: number;
  updatedMangaCount: number;
  totalManga: number;
}

/**
 * Normalize manga items with proper ID assignment
 */
export function normalizeMangaItems(
  manga: KenmeiMangaItem[],
): NormalizedMangaItem[] {
  console.debug(`[MangaImport] Normalizing ${manga.length} manga items`);

  const normalized = manga.map((item, idx) => ({
    id: (item as { id?: string | number }).id ?? `import_${Date.now()}_${idx}`,
    title: item.title,
    status: item.status,
    score: item.score ?? 0,
    chapters_read: item.chapters_read ?? 0,
    volumes_read: item.volumes_read ?? 0,
    notes: item.notes ?? "",
    created_at: item.created_at,
    updated_at: item.updated_at,
    last_read_at: item.last_read_at,
  }));

  console.debug(
    `[MangaImport] Successfully normalized ${normalized.length} items`,
  );
  return normalized;
}

/**
 * Get previous manga data from localStorage
 */
export function getPreviousMangaData(): NormalizedMangaItem[] {
  console.debug(
    "[MangaImport] Retrieving previous manga data from localStorage",
  );

  const previousKenmeiData = localStorage.getItem("kenmei_data");
  if (!previousKenmeiData) {
    console.debug("[MangaImport] No previous kenmei data found");
    return [];
  }

  try {
    const parsedData = JSON.parse(previousKenmeiData);
    const manga = parsedData.manga || [];
    console.info(
      `[MangaImport] Retrieved ${manga.length} previous manga entries`,
    );
    return manga;
  } catch (e) {
    console.error("[MangaImport] ❌ Failed to parse previous kenmei data:", e);
    return [];
  }
}

/**
 * Merge new manga with existing manga data
 */
export function mergeMangaData(
  previousManga: NormalizedMangaItem[],
  normalizedManga: NormalizedMangaItem[],
): { mergedManga: NormalizedMangaItem[]; results: ImportResults } {
  console.debug(
    `[MangaImport] Merging ${normalizedManga.length} new items with ${previousManga.length} existing items`,
  );

  const mergedManga = [...previousManga];
  const previousTitles = new Set(
    previousManga.map((m) => m.title.toLowerCase()),
  );
  const previousIds = new Set(
    previousManga.map((m) => m.id?.toString()).filter(Boolean),
  );

  let newMangaCount = 0;
  let updatedMangaCount = 0;

  for (const manga of normalizedManga) {
    const idMatch = manga.id && previousIds.has(manga.id.toString());
    const titleMatch = previousTitles.has(manga.title.toLowerCase());

    if (idMatch || titleMatch) {
      // Update existing manga
      const existingIndex = mergedManga.findIndex(
        (existing) =>
          existing.id?.toString() === manga.id.toString() ||
          existing.title.toLowerCase() === manga.title.toLowerCase(),
      );

      if (existingIndex !== -1) {
        const existing = mergedManga[existingIndex];
        mergedManga[existingIndex] = {
          ...existing,
          ...manga,
        };
        updatedMangaCount++;
      }
    } else {
      // Add new manga
      mergedManga.push(manga);
      newMangaCount++;
      previousTitles.add(manga.title.toLowerCase());
      if (manga.id) {
        previousIds.add(manga.id.toString());
      }
    }
  }

  console.info(
    `[MangaImport] ✅ Merge complete: ${newMangaCount} new, ${updatedMangaCount} updated, ${mergedManga.length} total`,
  );

  return {
    mergedManga,
    results: {
      newMangaCount,
      updatedMangaCount,
      totalManga: mergedManga.length,
    },
  };
}

/**
 * Ensure all manga have proper IDs and required fields
 */
export function validateMangaData(manga: NormalizedMangaItem[]): KenmeiManga[] {
  console.debug(`[MangaImport] Validating ${manga.length} manga items`);

  const validated = manga.map((mangaItem, idx) => ({
    id: mangaItem.id ?? `merged_${Date.now()}_${idx}`,
    title: mangaItem.title,
    status: mangaItem.status,
    score: mangaItem.score ?? 0,
    chapters_read: mangaItem.chapters_read ?? 0,
    volumes_read: mangaItem.volumes_read ?? 0,
    notes: mangaItem.notes ?? "",
    created_at: mangaItem.created_at ?? new Date().toISOString(),
    updated_at: mangaItem.updated_at ?? new Date().toISOString(),
    last_read_at: mangaItem.last_read_at,
  }));

  console.debug(
    `[MangaImport] Validation complete for ${validated.length} items`,
  );
  return validated;
}

/**
 * Update existing match results with new manga data
 */
export function updateMatchResults(validMergedManga: KenmeiManga[]): boolean {
  console.debug("[MangaImport] Attempting to update existing match results");

  const matchResultsRaw = localStorage.getItem("match_results");
  if (!matchResultsRaw) {
    console.debug("[MangaImport] No existing match results found");
    return false;
  }

  const matchResults: MatchResult[] = JSON.parse(matchResultsRaw);
  console.debug(
    `[MangaImport] Found ${matchResults.length} existing match results to update`,
  );

  // Create maps for quick lookup by id or title with better null handling
  const mangaById = new Map(
    validMergedManga
      .filter((m) => m.id != null)
      .map((m) => [m.id.toString(), m]),
  );
  const mangaByTitle = new Map(
    validMergedManga
      .filter((m) => m.title != null)
      .map((m) => [m.title.toLowerCase(), m]),
  );

  let updated = false;
  const updatedResults = matchResults.map((result: MatchResult) => {
    let newMangaData = null;

    // Try to find by ID first
    if (
      result.kenmeiManga?.id != null &&
      mangaById.has(result.kenmeiManga.id.toString())
    ) {
      newMangaData = mangaById.get(result.kenmeiManga.id.toString());
    }
    // If not found by ID, try by title
    else if (
      result.kenmeiManga?.title != null &&
      mangaByTitle.has(result.kenmeiManga.title.toLowerCase())
    ) {
      newMangaData = mangaByTitle.get(result.kenmeiManga.title.toLowerCase());
    }

    if (newMangaData) {
      updated = true;
      return {
        ...result,
        kenmeiManga: { ...result.kenmeiManga, ...newMangaData },
      };
    }
    return result;
  });

  if (updated) {
    const updatedCount = updatedResults.filter(
      (_, i) => updatedResults[i] !== matchResults[i],
    ).length;
    console.info(
      `[MangaImport] Updated ${updatedCount} existing matches with new import data`,
    );
    const updatedResultsJson = JSON.stringify(updatedResults);
    if (globalThis.electronStore) {
      globalThis.electronStore.setItem("match_results", updatedResultsJson);
    }
  }

  return updated;
}

/**
 * Clear pending manga storage after import
 */
export function clearPendingMangaStorage(): void {
  console.debug(
    "[MangaImport] Clearing pending manga storage after import to force recalculation",
  );
  if (globalThis.electronStore) {
    globalThis.electronStore.removeItem("pending_manga");
  }
  // Also clear from localStorage as fallback
  localStorage.removeItem("pending_manga");
}
