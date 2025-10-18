/**
 * @packageDocumentation
 * @module status-mapper
 * @description Status mapper for Kenmei to AniList conversion, including mapping utilities and validation helpers.
 */

import { KenmeiStatus, StatusMappingConfig } from "./types";
import { MediaListStatus } from "../anilist/types";

/**
 * Default bidirectional status mapping between Kenmei and AniList media list statuses.
 * @source
 */
const DEFAULT_STATUS_MAPPING: Record<KenmeiStatus, MediaListStatus> = {
  reading: "CURRENT",
  completed: "COMPLETED",
  on_hold: "PAUSED",
  dropped: "DROPPED",
  plan_to_read: "PLANNING",
};

/**
 * Map a Kenmei status to an AniList media list status.
 * @param status - Kenmei status value to convert.
 * @param customMapping - Optional custom status mapping to apply first.
 * @returns Corresponding AniList media list status.
 * @source
 */
export function mapKenmeiToAniListStatus(
  status: KenmeiStatus,
  customMapping?: Partial<StatusMappingConfig>,
): MediaListStatus {
  // Apply custom mapping if provided, otherwise use default
  return (
    (customMapping?.[status] as MediaListStatus) ??
    DEFAULT_STATUS_MAPPING[status]
  );
}

/**
 * Map an AniList media list status to a Kenmei status.
 * @param status - AniList media list status to convert.
 * @param customMapping - Optional custom status mapping to apply first.
 * @returns Corresponding Kenmei status (defaults to 'reading' if unmapped).
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

  // Apply custom mappings, overwriting defaults if provided
  if (customMapping) {
    for (const [k, v] of Object.entries(customMapping)) {
      reverseMapping.set(v, k as KenmeiStatus);
    }
  }

  return reverseMapping.get(status) ?? "reading";
}

/**
 * Create a custom Kenmei-to-AniList status mapping from user preferences.
 * @param preferences - Object mapping Kenmei status strings to desired AniList status strings.
 * @returns Validated custom status mapping configuration.
 * @source
 */
export function createCustomStatusMapping(
  preferences: Record<string, string>,
): Partial<StatusMappingConfig> {
  const customMapping: Partial<StatusMappingConfig> = {};

  // Validate and map each preference to status enum values
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
 * Validate and normalize a Kenmei status string to a valid enum value.
 * @param status - Status string to validate.
 * @returns Valid KenmeiStatus or undefined if the input doesn't match any valid status.
 * @source
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

  const normalized = status.toLowerCase().trim().replaceAll(" ", "_");

  // Check exact or normalized match
  if (validStatuses.has(status as KenmeiStatus)) return status as KenmeiStatus;
  if (validStatuses.has(normalized as KenmeiStatus))
    return normalized as KenmeiStatus;

  // Check common variations
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
 * Validate and normalize an AniList status string to a valid MediaListStatus enum value.
 * @param status - Status string to validate.
 * @returns Valid MediaListStatus or undefined if the input doesn't match any valid status.
 * @source
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

  const normalized = status.toUpperCase().trim().replaceAll(" ", "_");

  // Check exact or normalized match
  if (validStatuses.has(status as MediaListStatus))
    return status as MediaListStatus;
  if (validStatuses.has(normalized as MediaListStatus))
    return normalized as MediaListStatus;

  // Check common variations
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
 * Get all possible AniList statuses that each Kenmei status can map to.
 * @returns Record mapping each KenmeiStatus to an array of possible AniList statuses.
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
