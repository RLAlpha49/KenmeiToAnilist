/**
 * Custom matching rules for automatic filtering and acceptance of manga.
 *
 * This module evaluates user-defined regex patterns against manga metadata.
 * Rules can skip (exclude) or accept (boost confidence) manga based on pattern matches
 * across various metadata fields: titles, author, genres, tags, format, country, source,
 * description, and status.
 *
 * @module custom-rules
 * @source
 */

import type { AniListManga } from "@/api/anilist/types";
import type { KenmeiManga } from "@/api/kenmei/types";
import type { CustomRule, CustomRuleTarget } from "@/utils/storage";
import { getMatchConfig } from "@/utils/storage";

/**
 * Confidence floor for accept rule boosts on exact title matches.
 * @source
 */
export const ACCEPT_RULE_CONFIDENCE_FLOOR_EXACT = 0.85;

/**
 * Confidence floor for accept rule boosts on regular (non-exact) matches.
 * @source
 */
export const ACCEPT_RULE_CONFIDENCE_FLOOR_REGULAR = 0.75;

/**
 * Cache for compiled regex patterns to avoid repeated compilation.
 * Keys: `${ruleId}:${pattern}:${flags}`. Size capped at 1000 entries with FIFO eviction.
 * @source
 */
const regexCache = new Map<string, RegExp>();

/**
 * Maximum number of compiled regex patterns to cache.
 * @constant
 * @source
 */
const MAX_REGEX_CACHE_SIZE = 1000;

/**
 * Gets the effective target fields for a rule, applying fallback default if needed.
 * @param rule - The custom rule
 * @returns Array of target fields, defaulting to ['titles'] if not set
 * @source
 */
function getEffectiveTargetFields(rule: CustomRule): CustomRuleTarget[] {
  return rule.targetFields?.length ? rule.targetFields : ["titles"];
}

/**
 * Clears all compiled regex patterns from the cache.
 * Called when custom rules are updated to prevent stale patterns.
 * @source
 */
export function clearRegexCache(): void {
  regexCache.clear();
  console.debug(`[CustomRules] Regex cache cleared`);
}

/**
 * Extracts all title variants from manga data.
 * @param manga - AniList manga data
 * @param kenmeiManga - Kenmei manga data
 * @returns Array of title strings
 * @source
 */
function extractTitles(
  manga: AniListManga,
  kenmeiManga: KenmeiManga,
): string[] {
  const values: string[] = [];

  // AniList titles
  if (manga.title?.romaji) values.push(manga.title.romaji);
  if (manga.title?.english) values.push(manga.title.english);
  if (manga.title?.native) values.push(manga.title.native);
  if (manga.synonyms) values.push(...manga.synonyms);

  // Kenmei titles
  if (kenmeiManga.title) values.push(kenmeiManga.title);
  if (kenmeiManga.alternativeTitles) {
    values.push(...kenmeiManga.alternativeTitles);
  }

  return values;
}

/**
 * Extracts author/staff names from manga data.
 * Filters AniList staff by relevant roles: Story, Art, Original Creator.
 * @param manga - AniList manga data
 * @param kenmeiManga - Kenmei manga data
 * @returns Array of author/staff names
 * @source
 */
function extractAuthors(
  manga: AniListManga,
  kenmeiManga: KenmeiManga,
): string[] {
  const values: string[] = [];

  // Kenmei author
  if (kenmeiManga.author) values.push(kenmeiManga.author);

  // AniList staff (filter by relevant roles)
  if (manga.staff?.edges) {
    const relevantRoles = ["Story", "Art", "Original Creator"];
    for (const edge of manga.staff.edges) {
      const role = edge.role;
      if (role && relevantRoles.some((r) => role.includes(r))) {
        if (edge.node?.name?.full) {
          values.push(edge.node.name.full);
        }
      }
    }
  }

  return values;
}

/**
 * Extracts tag names and categories from manga data.
 * @param manga - AniList manga data
 * @returns Array of tag names and categories
 * @source
 */
function extractTags(manga: AniListManga): string[] {
  const values: string[] = [];

  if (manga.tags) {
    for (const tag of manga.tags) {
      if (tag.name) values.push(tag.name);
      if (tag.category) values.push(tag.category);
    }
  }

  return values;
}

/**
 * Extracts description text with HTML stripped from manga data.
 * @param manga - AniList manga data
 * @param kenmeiManga - Kenmei manga data
 * @returns Array of description strings
 * @source
 */
function extractDescriptions(
  manga: AniListManga,
  kenmeiManga: KenmeiManga,
): string[] {
  const values: string[] = [];

  // Strip HTML tags from description
  if (manga.description) {
    const stripped = manga.description.replaceAll(/<[^>]*>/g, "");
    if (stripped) values.push(stripped);
  }
  if (kenmeiManga.notes) values.push(kenmeiManga.notes);

  return values;
}

/**
 * Extracts metadata values for a specific target field from manga data.
 * @param targetField - The metadata field to extract (titles, author, genres, tags, etc.)
 * @param manga - The AniList manga data
 * @param kenmeiManga - The Kenmei manga data
 * @returns Array of string values from the specified field
 * @source
 */
function extractMetadataValues(
  targetField: CustomRuleTarget,
  manga: AniListManga,
  kenmeiManga: KenmeiManga,
): string[] {
  switch (targetField) {
    case "titles":
      return extractTitles(manga, kenmeiManga);

    case "author":
      return extractAuthors(manga, kenmeiManga);

    case "genres":
      return manga.genres || [];

    case "tags":
      return extractTags(manga);

    case "format":
      return manga.format ? [manga.format] : [];

    case "country":
      return manga.countryOfOrigin ? [manga.countryOfOrigin] : [];

    case "source":
      return manga.source ? [manga.source] : [];

    case "description":
      return extractDescriptions(manga, kenmeiManga);

    case "status": {
      const values: string[] = [];
      if (manga.status) values.push(manga.status);
      if (kenmeiManga.status) values.push(kenmeiManga.status);
      return values;
    }

    default:
      return [];
  }
}

/**
 * Tests a custom rule pattern against manga metadata fields.
 * @param rule - The custom rule with regex pattern and target fields
 * @param manga - The AniList manga data
 * @param kenmeiManga - The Kenmei manga data
 * @returns True if the pattern matches any value in the target fields, false otherwise
 * @source
 */
function testRuleAgainstMetadata(
  rule: CustomRule,
  manga: AniListManga,
  kenmeiManga: KenmeiManga,
): boolean {
  try {
    // Use same effective target fields as used in logging
    const targetFields = getEffectiveTargetFields(rule);

    // Extract metadata values from all target fields
    const allValues: string[] = [];
    for (const targetField of targetFields) {
      const values = extractMetadataValues(targetField, manga, kenmeiManga);
      allValues.push(...values);
    }

    // If no values extracted, no match
    if (allValues.length === 0) {
      return false;
    }

    // Include Unicode flag (u) for better international title support
    const flags = `u${rule.caseSensitive ? "" : "i"}`;

    // Check regex cache to avoid repeated compilation
    const cacheKey = `${rule.id}:${rule.pattern}:${flags}`;
    let regex = regexCache.get(cacheKey);

    if (!regex) {
      regex = new RegExp(rule.pattern, flags);
      regexCache.set(cacheKey, regex);

      // Implement FIFO eviction when cache exceeds max size
      if (regexCache.size > MAX_REGEX_CACHE_SIZE) {
        const firstKey = regexCache.keys().next().value;
        if (firstKey) {
          regexCache.delete(firstKey);
          console.debug(
            `[CustomRules] Regex cache evicted oldest entry (size: ${regexCache.size}/${MAX_REGEX_CACHE_SIZE})`,
          );
        }
      }
    }

    // Cap per-value length to prevent catastrophic backtracking
    // 10,000 characters is a reasonable limit for most practical use cases
    const MAX_VALUE_LENGTH = 10000;

    return allValues.some((value) => {
      // Truncate value to prevent regex backtracking on extremely long strings
      const truncatedValue =
        value.length > MAX_VALUE_LENGTH
          ? value.substring(0, MAX_VALUE_LENGTH)
          : value;
      return regex.test(truncatedValue);
    });
  } catch (error) {
    console.error(
      `[CustomRules] Invalid regex pattern in rule "${rule.description}": ${error instanceof Error ? error.message : "Unknown error"}`,
    );
    return false;
  }
}

/**
 * Checks if manga should be skipped based on custom skip rules.
 * @param manga - The AniList manga to check
 * @param kenmeiManga - The original Kenmei manga entry
 * @param isManualSearch - Whether this is a manual search (skip rules don't apply)
 * @returns True if manga should be skipped, false otherwise
 * @source
 */
export function shouldSkipByCustomRules(
  manga: AniListManga,
  kenmeiManga: KenmeiManga,
  isManualSearch: boolean,
): boolean {
  // Custom skip rules don't apply to manual searches
  if (isManualSearch) {
    return false;
  }

  const customRules = getMatchConfig().customRules;
  if (!customRules) {
    return false;
  }

  // Normalize customRules arrays defensively to handle malformed storage
  const skipRules = Array.isArray(customRules.skipRules)
    ? customRules.skipRules
    : [];
  if (!skipRules.length) {
    return false;
  }

  // Filter to enabled rules only
  const enabledSkipRules = skipRules.filter((rule) => rule.enabled);
  if (!enabledSkipRules.length) {
    return false;
  }

  // Check each enabled skip rule
  for (const rule of enabledSkipRules) {
    if (testRuleAgainstMetadata(rule, manga, kenmeiManga)) {
      const checkedFields = getEffectiveTargetFields(rule);
      console.debug(
        `[CustomRules] ⏭️ Skipping manga "${manga.title?.romaji || manga.title?.english || "unknown"}" due to custom skip rule: "${rule.description}" (checked fields: ${checkedFields.join(", ")})`,
      );
      return true;
    }
  }

  return false;
}

/**
 * Checks if manga should be auto-accepted based on custom accept rules.
 * @param manga - The AniList manga to check
 * @param kenmeiManga - The original Kenmei manga entry
 * @returns Object with shouldAccept flag and matched rule if applicable
 * @source
 */
export function shouldAcceptByCustomRules(
  manga: AniListManga,
  kenmeiManga: KenmeiManga,
): { shouldAccept: boolean; matchedRule?: CustomRule } {
  const customRules = getMatchConfig().customRules;
  if (!customRules) {
    return { shouldAccept: false };
  }

  // Normalize customRules arrays defensively to handle malformed storage
  const acceptRules = Array.isArray(customRules.acceptRules)
    ? customRules.acceptRules
    : [];
  if (!acceptRules.length) {
    return { shouldAccept: false };
  }

  // Filter to enabled rules only
  const enabledAcceptRules = acceptRules.filter((rule) => rule.enabled);
  if (!enabledAcceptRules.length) {
    return { shouldAccept: false };
  }

  // Check each enabled accept rule
  for (const rule of enabledAcceptRules) {
    if (testRuleAgainstMetadata(rule, manga, kenmeiManga)) {
      const checkedFields = getEffectiveTargetFields(rule);
      console.debug(
        `[CustomRules] ✅ Auto-accepting manga "${manga.title?.romaji || manga.title?.english || "unknown"}" due to custom accept rule: "${rule.description}" (checked fields: ${checkedFields.join(", ")})`,
      );
      return { shouldAccept: true, matchedRule: rule };
    }
  }

  return { shouldAccept: false };
}

/**
 * Gets custom rule match information for debugging and UI display.
 * @param manga - The AniList manga to check
 * @param kenmeiManga - The original Kenmei manga entry
 * @returns Object with skip and accept rule matches if applicable
 * @source
 */
export function getCustomRuleMatchInfo(
  manga: AniListManga,
  kenmeiManga: KenmeiManga,
): { skipMatch?: CustomRule; acceptMatch?: CustomRule } {
  const customRules = getMatchConfig().customRules;
  if (!customRules) {
    return {};
  }

  // Normalize customRules arrays defensively to handle malformed storage
  const skipRules = Array.isArray(customRules.skipRules)
    ? customRules.skipRules
    : [];
  const acceptRules = Array.isArray(customRules.acceptRules)
    ? customRules.acceptRules
    : [];

  const result: { skipMatch?: CustomRule; acceptMatch?: CustomRule } = {};

  // Check skip rules
  const enabledSkipRules = skipRules.filter((rule) => rule.enabled);
  for (const rule of enabledSkipRules) {
    if (testRuleAgainstMetadata(rule, manga, kenmeiManga)) {
      result.skipMatch = rule;
      break;
    }
  }

  // Check accept rules
  const enabledAcceptRules = acceptRules.filter((rule) => rule.enabled);
  for (const rule of enabledAcceptRules) {
    if (testRuleAgainstMetadata(rule, manga, kenmeiManga)) {
      result.acceptMatch = rule;
      break;
    }
  }

  return result;
}
