/**
 * Custom matching rules for automatic filtering and acceptance of manga.
 *
 * This module provides functionality for evaluating user-defined regex patterns
 * against manga titles during the matching process. Rules can either skip
 * (exclude) manga or accept (boost confidence) manga based on pattern matches.
 *
 * Rules check all title variants including:
 * - AniList titles: romaji, english, native, synonyms
 * - Kenmei titles: title, alternative_titles
 *
 * @module custom-rules
 * @source
 */

import type { AniListManga } from "@/api/anilist/types";
import type { KenmeiManga } from "@/api/kenmei/types";
import type { CustomRule } from "@/utils/storage";
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
 * Tests a custom rule pattern against a list of titles.
 *
 * @param rule - The custom rule with regex pattern to test.
 * @param titles - Array of title strings to test against.
 * @returns True if the pattern matches any title, false otherwise.
 *
 * @remarks
 * Handles invalid regex patterns gracefully by logging and returning false.
 * Uses the Unicode flag (u) to properly match international characters in titles.
 * Combines Unicode flag with case-insensitive flag unless rule specifies case-sensitive mode.
 *
 * @source
 */
function testRuleAgainstTitles(rule: CustomRule, titles: string[]): boolean {
  try {
    // Include Unicode flag (u) for better international title support
    const flags = `u${rule.caseSensitive ? "" : "i"}`;
    const regex = new RegExp(rule.pattern, flags);
    return titles.some((title) => regex.test(title));
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
 * Evaluates all enabled skip rules against all title variants.
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

  // Collect all title variants to check
  const titles: string[] = [
    manga.title?.romaji,
    manga.title?.english,
    manga.title?.native,
    ...(manga.synonyms || []),
    kenmeiManga.title,
    ...(kenmeiManga.alternative_titles || []),
  ].filter(Boolean) as string[];

  // Check each enabled skip rule
  for (const rule of enabledSkipRules) {
    if (testRuleAgainstTitles(rule, titles)) {
      console.debug(
        `[CustomRules] ⏭️ Skipping manga "${manga.title?.romaji || manga.title?.english || "unknown"}" due to custom skip rule: "${rule.description}"`,
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
 * Evaluates all enabled accept rules against all title variants.
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

  // Collect all title variants to check
  const titles: string[] = [
    manga.title?.romaji,
    manga.title?.english,
    manga.title?.native,
    ...(manga.synonyms || []),
    kenmeiManga.title,
    ...(kenmeiManga.alternative_titles || []),
  ].filter(Boolean) as string[];

  // Check each enabled accept rule
  for (const rule of enabledAcceptRules) {
    if (testRuleAgainstTitles(rule, titles)) {
      console.debug(
        `[CustomRules] ✅ Auto-accepting manga "${manga.title?.romaji || manga.title?.english || "unknown"}" due to custom accept rule: "${rule.description}"`,
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
  const titles: string[] = [
    manga.title?.romaji,
    manga.title?.english,
    manga.title?.native,
    ...(manga.synonyms || []),
    kenmeiManga.title,
    ...(kenmeiManga.alternative_titles || []),
  ].filter(Boolean) as string[];

  for (const rule of enabledSkipRules) {
    if (testRuleAgainstTitles(rule, titles)) {
      result.skipMatch = rule;
      break;
    }
  }

  // Check accept rules
  const enabledAcceptRules = acceptRules.filter((rule) => rule.enabled);
  for (const rule of enabledAcceptRules) {
    if (testRuleAgainstTitles(rule, titles)) {
      result.acceptMatch = rule;
      break;
    }
  }

  return result;
}
