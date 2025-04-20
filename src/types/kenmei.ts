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
 * @property chapters_read - The number of chapters read.
 * @property volumes_read - The number of volumes read.
 * @property url - The source URL for the manga.
 * @property source - The source name (e.g., site or app).
 * @property notes - Any user notes for the manga.
 * @property last_read_at - The last read timestamp.
 * @property created_at - The creation timestamp.
 * @property updated_at - The last updated timestamp.
 * @source
 */
export interface KenmeiMangaItem {
  title: string;
  status: string;
  score?: number;
  chapters_read?: number;
  volumes_read?: number;
  url?: string;
  source?: string;
  notes?: string;
  last_read_at?: string;
  created_at?: string;
  updated_at?: string;
}

/**
 * Represents the Kenmei data export structure.
 *
 * @property version - The export version.
 * @property exported_at - The export timestamp.
 * @property manga - The array of manga items in the export.
 * @source
 */
export interface KenmeiData {
  version?: string;
  exported_at?: string;
  manga: KenmeiMangaItem[];
}
