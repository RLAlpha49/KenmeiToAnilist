/**
 * Custom matching rules for automatic filtering and acceptance of manga.
 *
 * This module provides functionality for evaluating user-defined regex patterns
 * against manga metadata during the matching process. Rules can either skip
 * (exclude) manga or accept (boost confidence) manga based on pattern matches.
 *
 * Rules can check various metadata fields including:
 * - Titles: All title variants (romaji, english, native, synonyms, alternative_titles)
 * - Author: Author/staff names (filtered by Story, Art, Original Creator roles)
 * - Genres: Genre array
 * - Tags: Tag names and categories
 * - Format: Publication format
 * - Country: Country of origin
 * - Source: Source material type
 * - Description: Description text and notes
 * - Status: Publishing status
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
 * Ensures exact matches are prioritized with high confidence when matched by an accept rule.
 * @constant
 */
export const ACCEPT_RULE_CONFIDENCE_FLOOR_EXACT = 0.85;

/**
 * Confidence floor for accept rule boosts on regular (non-exact) matches.
 * Ensures regular matches are boosted to high confidence when matched by an accept rule.
 * @constant
 */
export const ACCEPT_RULE_CONFIDENCE_FLOOR_REGULAR = 0.75;

/**
 * Cache for compiled regex patterns to avoid repeated compilation during evaluation.
 * Keys are formatted as `${ruleId}:${pattern}:${flags}` for deduplication.
 * Entries persist across evaluations to optimize repeated rule matching.
 *
 * @remarks
 * The cache should be cleared or entries invalidated if a rule's pattern or flags change.
 * Size is capped at 1000 entries to prevent unbounded growth across sessions.
 * When the limit is exceeded, the oldest entries are evicted (FIFO).
 */
const regexCache = new Map<string, RegExp>();

/**
 * Maximum number of compiled regex patterns to cache.
 * When exceeded, the oldest entry is removed (FIFO eviction).
 * @constant
 */
const MAX_REGEX_CACHE_SIZE = 1000;

/**
 * Get the effective target fields for a rule, applying fallback default if needed.
 * This ensures consistency between evaluation and logging.
 *
 * @param rule - The custom rule
 * @returns Array of target fields, defaulting to ['titles'] if not set
 *
 * @remarks
 * Used by both testRuleAgainstMetadata() and logging functions to ensure
 * the reported fields match the fields actually evaluated.
 */
function getEffectiveTargetFields(rule: CustomRule): CustomRuleTarget[] {
  return rule.targetFields?.length ? rule.targetFields : ["titles"];
}

/**
 * Clears all compiled regex patterns from the cache.
 * Useful when rules are updated in the settings flow to avoid stale patterns.
 *
 * @remarks
 * This function is called automatically when custom rules are modified,
 * ensuring that any pattern changes are reflected in the next evaluation.
 *
 * @source
 */
export function clearRegexCache(): void {
  regexCache.clear();
  console.debug(`[CustomRules] Regex cache cleared`);
}

/**
 * Extracts title values from manga data.
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
  if (kenmeiManga.alternative_titles) {
    values.push(...kenmeiManga.alternative_titles);
  }

  return values;
}

/**
 * Extracts author/staff names from manga data.
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
 *
 * @param targetField - The metadata field to extract
 * @param manga - The AniList manga data
 * @param kenmeiManga - The Kenmei manga data
 * @returns Array of string values from the specified field
 *
 * @remarks
 * Handles different field types appropriately:
 * - Array fields (genres, tags, synonyms): Flattened to strings
 * - Staff: Filtered by relevant roles (Story, Art, Original Creator)
 * - Description: HTML tags stripped using regex
 * - Missing/null fields: Returns empty array (not error)
 *
 * @example
 * ```typescript
 * const genres = extractMetadataValues('genres', manga, kenmeiManga);
 * // Returns: ['Action', 'Fantasy', 'Adventure']
 *
 * const authors = extractMetadataValues('author', manga, kenmeiManga);
 * // Returns: ['Author Name', 'Staff Name']
 * ```
 *
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
 *
 * @param rule - The custom rule with regex pattern and target fields
 * @param manga - The AniList manga data
 * @param kenmeiManga - The Kenmei manga data
 * @returns True if the pattern matches any value in the target fields, false otherwise
 *
 * @remarks
 * Handles invalid regex patterns gracefully by logging and returning false.
 * Uses the Unicode flag (u) to properly match international characters.
 * Combines Unicode flag with case-insensitive flag unless rule specifies case-sensitive mode.
 * Extracts values from all specified target fields and tests pattern against combined array.
 *
 * Per-value length is capped at 10,000 characters to prevent catastrophic regex backtracking.
 * Long strings are truncated to this limit before testing, which prevents performance issues
 * while still allowing most practical patterns to match meaningful content.
 *
 * @example
 * ```typescript
 * const rule = {
 *   pattern: 'isekai|reincarnation',
 *   targetFields: ['genres', 'tags'],
 *   caseSensitive: false,
 *   ...
 * };
 * const matches = testRuleAgainstMetadata(rule, manga, kenmeiManga);
 * ```
 *
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
 *
 * @param manga - The AniList manga to check.
 * @param kenmeiManga - The original Kenmei manga entry.
 * @param isManualSearch - Whether this is a manual search (skip rules don't apply).
 * @returns True if manga should be skipped, false otherwise.
 *
 * @remarks
 * Custom skip rules only apply to automatic matching, not manual searches.
 * Evaluates all enabled skip rules against selected metadata fields.
 * First matching rule triggers a skip (short-circuit evaluation).
 *
 * @example
 * ```typescript
 * const shouldSkip = shouldSkipByCustomRules(anilistManga, kenmeiManga, false);
 * if (shouldSkip) {
 *   console.log("Manga skipped by custom rule");
 * }
 * ```
 *
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
 *
 * @param manga - The AniList manga to check.
 * @param kenmeiManga - The original Kenmei manga entry.
 * @returns Object with shouldAccept flag and matched rule if applicable.
 *
 * @remarks
 * Custom accept rules boost confidence scores to ensure inclusion.
 * Evaluates all enabled accept rules against selected metadata fields.
 * First matching rule triggers acceptance (short-circuit evaluation).
 *
 * Note: kenmeiManga context is required to evaluate accept rules.
 * Manual searches without kenmeiManga will never trigger accept rules
 * (by design - ensures proper context for rule evaluation).
 *
 * @example
 * ```typescript
 * const { shouldAccept, matchedRule } = shouldAcceptByCustomRules(anilistManga, kenmeiManga);
 * if (shouldAccept) {
 *   console.log(`Auto-accepted by rule: ${matchedRule?.description}`);
 * }
 * ```
 *
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
 * Gets custom rule match information for debugging purposes.
 *
 * @param manga - The AniList manga to check.
 * @param kenmeiManga - The original Kenmei manga entry.
 * @returns Object with skip and accept rule matches if applicable.
 *
 * @remarks
 * Convenience function that checks both skip and accept rules.
 * Useful for UI display to show which custom rules matched.
 *
 * @example
 * ```typescript
 * const { skipMatch, acceptMatch } = getCustomRuleMatchInfo(anilistManga, kenmeiManga);
 * if (skipMatch) {
 *   console.log(`Skipped by: ${skipMatch.description}`);
 * }
 * if (acceptMatch) {
 *   console.log(`Accepted by: ${acceptMatch.description}`);
 * }
 * ```
 *
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
