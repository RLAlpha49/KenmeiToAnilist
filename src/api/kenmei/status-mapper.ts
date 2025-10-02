/**
 * @packageDocumentation
 * @module status-mapper
 * @description Status mapper for Kenmei to AniList conversion, including mapping utilities and validation helpers.
 */

import { KenmeiStatus, StatusMappingConfig } from "./types";
import { MediaListStatus } from "../anilist/types";

// Default status mapping
const DEFAULT_STATUS_MAPPING: Record<KenmeiStatus, MediaListStatus> = {
  reading: "CURRENT",
  completed: "COMPLETED",
  on_hold: "PAUSED",
  dropped: "DROPPED",
  plan_to_read: "PLANNING",
};

/**
 * Map a Kenmei status to AniList status.
 *
 * @param status - Kenmei status.
 * @param customMapping - Optional custom mapping configuration.
 * @returns AniList status.
 * @source
 */
export function mapKenmeiToAniListStatus(
  status: KenmeiStatus,
  customMapping?: Partial<StatusMappingConfig>,
): MediaListStatus {
  // Prefer custom mapping when provided, otherwise fall back to default.
  return (
    (customMapping?.[status] as MediaListStatus) ??
    DEFAULT_STATUS_MAPPING[status]
  );
}

/**
 * Map an AniList status to Kenmei status.
 *
 * @param status - AniList status.
 * @param customMapping - Optional custom mapping configuration.
 * @returns Kenmei status.
 * @source
 */
export function mapAniListToKenmeiStatus(
  status: MediaListStatus,
  customMapping?: Partial<StatusMappingConfig>,
): KenmeiStatus {
  // Build reverse mapping from defaults (AniList -> Kenmei)
  const reverseMapping = new Map<MediaListStatus, KenmeiStatus>();
  for (const [k, v] of Object.entries(DEFAULT_STATUS_MAPPING)) {
    reverseMapping.set(v, k as KenmeiStatus);
  }

  // If user provided custom mappings, apply them — set() will overwrite defaults.
  if (customMapping) {
    for (const [k, v] of Object.entries(customMapping)) {
      reverseMapping.set(v, k as KenmeiStatus);
    }
  }

  return reverseMapping.get(status) ?? "reading";
}

/**
 * Create a custom status mapping from user preferences.
 *
 * @param preferences - User preferences for status mapping.
 * @returns Custom status mapping configuration.
 * @source
 */
export function createCustomStatusMapping(
  preferences: Record<string, string>,
): Partial<StatusMappingConfig> {
  const customMapping: Partial<StatusMappingConfig> = {};

  // Validate and map preferences to status mapping
  for (const [key, value] of Object.entries(preferences)) {
    const kenmeiStatus = validateKenmeiStatus(key);
    if (!kenmeiStatus) continue;

    const anilistStatus = validateAniListStatus(value);
    if (!anilistStatus) continue;

    customMapping[kenmeiStatus] = anilistStatus;
  }

  return customMapping;
}

/**
 * Validate a Kenmei status string
 * @param status Status string to validate
 * @returns Valid KenmeiStatus or undefined
 */
function validateKenmeiStatus(status: string): KenmeiStatus | undefined {
  if (!status) return undefined;

  const validStatuses: Set<KenmeiStatus> = new Set([
    "reading",
    "completed",
    "on_hold",
    "dropped",
    "plan_to_read",
  ]);

  const normalized = status.toLowerCase().trim().replace(/\s+/g, "_");

  // Exact or normalized match
  if (validStatuses.has(status as KenmeiStatus)) return status as KenmeiStatus;
  if (validStatuses.has(normalized as KenmeiStatus))
    return normalized as KenmeiStatus;

  // Lookup common variations
  const variations: Record<string, KenmeiStatus> = {
    planning: "plan_to_read",
    plan: "plan_to_read",
    hold: "on_hold",
    paused: "on_hold",
    complete: "completed",
    finished: "completed",
    read: "reading",
    current: "reading",
    drop: "dropped",
    dropped: "dropped",
  };

  return variations[normalized];
}

/**
 * Validate an AniList status string
 * @param status Status string to validate
 * @returns Valid MediaListStatus or undefined
 */
function validateAniListStatus(status: string): MediaListStatus | undefined {
  if (!status) return undefined;

  const validStatuses: Set<MediaListStatus> = new Set([
    "CURRENT",
    "PLANNING",
    "COMPLETED",
    "DROPPED",
    "PAUSED",
    "REPEATING",
  ]);

  const normalized = status.toUpperCase().trim().replace(/\s+/g, "_");

  if (validStatuses.has(status as MediaListStatus))
    return status as MediaListStatus;
  if (validStatuses.has(normalized as MediaListStatus))
    return normalized as MediaListStatus;

  const variations: Record<string, MediaListStatus> = {
    PLAN: "PLANNING",
    PTR: "PLANNING",
    PTW: "PLANNING",
    WATCHING: "CURRENT",
    READING: "CURRENT",
    CURRENT: "CURRENT",
    DONE: "COMPLETED",
    COMPLETE: "COMPLETED",
    FINISHED: "COMPLETED",
    DROPPED: "DROPPED",
    DROP: "DROPPED",
    QUIT: "DROPPED",
    HOLD: "PAUSED",
    ON_HOLD: "PAUSED",
    PAUSED: "PAUSED",
    REPEAT: "REPEATING",
    REREADING: "REPEATING",
    REWATCHING: "REPEATING",
    REPEATING: "REPEATING",
    PLANNING_TO_READ: "PLANNING",
  } as const;

  return variations[normalized];
}

/**
 * Get all possible status mappings between Kenmei and AniList statuses.
 *
 * @returns A record of all possible mappings between Kenmei and AniList statuses.
 * @source
 */
export function getAllPossibleStatusMappings(): Record<
  KenmeiStatus,
  MediaListStatus[]
> {
  return {
    reading: ["CURRENT", "REPEATING"],
    completed: ["COMPLETED"],
    on_hold: ["PAUSED"],
    dropped: ["DROPPED"],
    plan_to_read: ["PLANNING"],
  };
}
