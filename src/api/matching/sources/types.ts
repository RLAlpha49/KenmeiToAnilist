/**
 * Types for manga source integration (Comick, MangaDex).
 *
 * @module sources/types
 * @packageDocumentation
 */

/** Comick source metadata for a manga entry. @source */
export interface ComickSourceInfo {
  title: string;
  slug: string;
  comickId: string;
  isFoundViaComick: boolean;
}

/** MangaDex source metadata for a manga entry. @source */
export interface MangaDexSourceInfo {
  title: string;
  slug: string;
  mangaDexId: string;
  isFoundViaMangaDex: boolean;
}

/** Comick source information keyed by manga ID. @source */
export type ComickSourceMap = Map<number, ComickSourceInfo>;

/** MangaDex source information keyed by manga ID. @source */
export type MangaDexSourceMap = Map<number, MangaDexSourceInfo>;

/** Unified source metadata from either Comick or MangaDex. @source */
export interface GenericSourceInfo {
  title: string;
  slug: string;
  sourceId: string;
  source: "comick" | "mangadex";
  isFoundViaAlternativeSearch: boolean;
}
