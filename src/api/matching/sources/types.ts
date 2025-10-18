/**
 * Types for manga source integration (Comick, MangaDex).
 *
 * @module sources/types
 * @packageDocumentation
 */

/**
 * Comick source metadata for a manga entry.
 * @source
 */
export interface ComickSourceInfo {
  title: string;
  slug: string;
  comickId: string;
  foundViaComick: boolean;
}

/**
 * MangaDex source metadata for a manga entry.
 * @source
 */
export interface MangaDexSourceInfo {
  title: string;
  slug: string;
  mangaDexId: string;
  foundViaMangaDex: boolean;
}

/**
 * Map of Comick source information keyed by manga ID.
 * @source
 */
export type ComickSourceMap = Map<number, ComickSourceInfo>;

/**
 * Map of MangaDex source information keyed by manga ID.
 * @source
 */
export type MangaDexSourceMap = Map<number, MangaDexSourceInfo>;

/**
 * Unified source information from either Comick or MangaDex.
 * @source
 */
export interface GenericSourceInfo {
  title: string;
  slug: string;
  sourceId: string;
  source: "comick" | "mangadex";
  foundViaAlternativeSearch: boolean;
}
