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
  // Use custom mapping if provided, otherwise use default
  if (customMapping?.[status]) {
    return customMapping[status];
  }

  return DEFAULT_STATUS_MAPPING[status];
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
  // Create a reverse mapping
  const reverseMapping = new Map<MediaListStatus, KenmeiStatus>();

  // Populate with default mapping
  for (const [kenmeiStatus, anilistStatus] of Object.entries(
    DEFAULT_STATUS_MAPPING,
  )) {
    reverseMapping.set(anilistStatus, kenmeiStatus as KenmeiStatus);
  }

  // Override with custom mapping if provided
  if (customMapping) {
    for (const [kenmeiStatus, anilistStatus] of Object.entries(customMapping)) {
      // Find and remove the default entry for this AniList status
      for (const [key] of reverseMapping.entries()) {
        if (key === anilistStatus) {
          reverseMapping.delete(key);
        }
      }

      // Add the custom mapping
      reverseMapping.set(anilistStatus, kenmeiStatus as KenmeiStatus);
    }
  }

  // Find the matching Kenmei status
  const kenmeiStatus = reverseMapping.get(status);

  // Default to "reading" if no mapping is found
  return kenmeiStatus || "reading";
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
    // Validate Kenmei status
    const kenmeiStatus = validateKenmeiStatus(key);
    if (!kenmeiStatus) continue;

    // Validate AniList status
    const anilistStatus = validateAniListStatus(value);
    if (!anilistStatus) continue;

    // Add to custom mapping
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
  const validStatuses: Set<KenmeiStatus> = new Set([
    "reading",
    "completed",
    "on_hold",
    "dropped",
    "plan_to_read",
  ]);

  // Check exact match
  if (validStatuses.has(status as KenmeiStatus)) {
    return status as KenmeiStatus;
  }

  // Try to normalize the status
  const normalized = status.toLowerCase().replace(" ", "_");

  if (validStatuses.has(normalized as KenmeiStatus)) {
    return normalized as KenmeiStatus;
  }

  // Map common variations
  if (["planning", "plan"].includes(normalized)) return "plan_to_read";
  if (["hold", "paused"].includes(normalized)) return "on_hold";
  if (["complete", "finished"].includes(normalized)) return "completed";
  if (["read", "current", "reading"].includes(normalized)) return "reading";
  if (["drop", "dropped"].includes(normalized)) return "dropped";

  // No valid match found
  return undefined;
}

/**
 * Validate an AniList status string
 * @param status Status string to validate
 * @returns Valid MediaListStatus or undefined
 */
function validateAniListStatus(status: string): MediaListStatus | undefined {
  const validStatuses: Set<MediaListStatus> = new Set([
    "CURRENT",
    "PLANNING",
    "COMPLETED",
    "DROPPED",
    "PAUSED",
    "REPEATING",
  ]);

  // Check exact match
  if (validStatuses.has(status as MediaListStatus)) {
    return status as MediaListStatus;
  }

  // Try to normalize the status
  const normalized = status.toUpperCase().replace(" ", "_");

  if (validStatuses.has(normalized as MediaListStatus)) {
    return normalized as MediaListStatus;
  }

  // Map common variations
  if (["PLAN", "PLANNING_TO_READ", "PTR", "PTW"].includes(normalized))
    return "PLANNING";
  if (["WATCHING", "READING", "CURRENT"].includes(normalized)) return "CURRENT";
  if (["DONE", "COMPLETE", "FINISHED", "COMPLETED"].includes(normalized))
    return "COMPLETED";
  if (["DROP", "QUIT", "DROPPED"].includes(normalized)) return "DROPPED";
  if (["HOLD", "ON_HOLD", "PAUSED"].includes(normalized)) return "PAUSED";
  if (["REPEAT", "REREADING", "REWATCHING", "REPEATING"].includes(normalized))
    return "REPEATING";

  // No valid match found
  return undefined;
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
