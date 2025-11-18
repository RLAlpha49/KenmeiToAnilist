/**
 * @packageDocumentation
 * @module kenmei-types
 * @description TypeScript types for Kenmei manga data and export format.
 */

/**
 * Represents a manga item in Kenmei's data export.
 *
 * @property title - The manga title.
 * @property status - The reading status (e.g., reading, completed).
 * @property score - The user's score for the manga.
 * @property chaptersRead - The number of chapters read.
 * @property volumesRead - The number of volumes read.
 * @property url - The source URL for the manga.
 * @property source - The source name (e.g., site or app).
 * @property notes - Any user notes for the manga.
 * @property lastReadAt - The last read timestamp.
 * @property createdAt - The creation timestamp.
 * @property updatedAt - The last updated timestamp.
 * @source
 */
export interface KenmeiMangaItem {
  title: string;
  status: string;
  score?: number;
  chaptersRead?: number;
  volumesRead?: number;
  url?: string;
  source?: string;
  notes?: string;
  lastReadAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Represents the Kenmei data export structure.
 *
 * @property version - The export version.
 * @property exportedAt - The export timestamp.
 * @property manga - The array of manga items in the export.
 * @source
 */
export interface KenmeiData {
  version?: string;
  exportedAt?: string;
  manga: KenmeiMangaItem[];
}
