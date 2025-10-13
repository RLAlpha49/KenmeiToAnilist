/**
 * Types for manga source integration (Comick, MangaDex).
 *
 * @module sources/types
 * @packageDocumentation
 */

/**
 * Comick source information for a manga entry
 */
export interface ComickSourceInfo {
  title: string;
  slug: string;
  comickId: string;
  foundViaComick: boolean;
}

/**
 * MangaDex source information for a manga entry
 */
export interface MangaDexSourceInfo {
  title: string;
  slug: string;
  mangaDexId: string;
  foundViaMangaDex: boolean;
}

/**
 * Source map for Comick results indexed by manga ID
 */
export type ComickSourceMap = Map<number, ComickSourceInfo>;

/**
 * Source map for MangaDex results indexed by manga ID
 */
export type MangaDexSourceMap = Map<number, MangaDexSourceInfo>;

/**
 * Generic source information that can be from either Comick or MangaDex
 */
export interface GenericSourceInfo {
  title: string;
  slug: string;
  sourceId: string;
  source: "comick" | "mangadex";
  foundViaAlternativeSearch: boolean;
}
