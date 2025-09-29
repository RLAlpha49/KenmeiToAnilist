/**
 * @packageDocumentation
 * @module enhanced-similarity
 * @description Enhanced title similarity calculation for manga matching with improved normalization and multiple scoring algorithms.
 */

import * as stringSimilarity from "string-similarity";

/**
 * Configuration for enhanced similarity calculation
 */
export interface SimilarityConfig {
  /** Weight for exact match bonus (0-1) */
  exactMatchWeight: number;
  /** Weight for substring match bonus (0-1) */
  substringMatchWeight: number;
  /** Weight for word order similarity (0-1) */
  wordOrderWeight: number;
  /** Weight for character-level similarity (0-1) */
  characterSimilarityWeight: number;
  /** Weight for semantic similarity (0-1) */
  semanticWeight: number;
  /** Minimum length difference ratio to heavily penalize (0-1) */
  lengthDifferenceThreshold: number;
  /** Whether to enable debug logging */
  debug: boolean;
}

/**
 * Default configuration for similarity calculation
 */
export const DEFAULT_SIMILARITY_CONFIG: SimilarityConfig = {
  exactMatchWeight: 0.5,
  substringMatchWeight: 0.15,
  wordOrderWeight: 0.1,
  characterSimilarityWeight: 0.2,
  semanticWeight: 0.05,
  lengthDifferenceThreshold: 0.7,
  debug: false,
};

/**
 * Common abbreviations and their expansions in manga titles
 */
const ABBREVIATION_MAP = new Map([
  ["vs", "versus"],
  ["&", "and"],
  ["w/", "with"],
  ["wo", "without"],
  ["no", "of"],
  ["wa", "the"],
  ["ga", ""],
  ["ni", "to"],
  ["o", ""],
  ["de", "in"],
  ["kara", "from"],
  ["made", "until"],
  ["re:", "re"],
  ["∞", "infinity"],
  ["♡", "love"],
  ["★", "star"],
  ["☆", "star"],
]);

/**
 * Common title prefixes/suffixes that can be ignored or normalized
 */
const IGNORABLE_PATTERNS = [
  /^\[.*?\]\s*/i, // [Tag] at start
  /\s*\[.*?\]$/i, // [Tag] at end
  /^\(.*?\)\s*/i, // (Text) at start
  /\s*\(.*?\)$/i, // (Text) at end
  /\s*-\s*raw$/i, // "- Raw" suffix
  /\s*raw$/i, // "Raw" suffix
  /\s*scan$/i, // "Scan" suffix
  /\s*manga$/i, // "Manga" suffix (when redundant)
  /\s*comic$/i, // "Comic" suffix
  /\s*doujin(shi)?$/i, // "Doujin/Doujinshi" suffix
  /\s*anthology$/i, // "Anthology" suffix
  /\s*collection$/i, // "Collection" suffix
  /\s*vol\.\s*\d+/i, // Volume numbers
  /\s*volume\s*\d+/i, // Volume numbers
  /\s*ch\.\s*\d+/i, // Chapter numbers
  /\s*chapter\s*\d+/i, // Chapter numbers
  /\s*oneshot$/i, // "Oneshot" suffix
  /\s*one[-\s]shot$/i, // "One-shot" variations
];

/**
 * Enhanced string normalization for manga titles
 */
export function enhancedNormalize(text: string): string {
  if (!text) return "";

  let normalized = text.trim();

  // Remove common ignorable patterns
  for (const pattern of IGNORABLE_PATTERNS) {
    normalized = normalized.replaceAll(pattern, "");
  }

  // Normalize Unicode characters
  normalized = normalized.normalize("NFD");

  // Convert full-width characters to half-width
  normalized = normalized.replaceAll(/[\uff01-\uff5e]/g, (char) =>
    String.fromCodePoint((char.codePointAt(0) ?? 0) - 0xfee0),
  );

  // Remove diacritics/accents
  normalized = normalized.replaceAll(/[\u0300-\u036f]/g, "");

  // Normalize punctuation and special characters
  normalized = normalized
    .replaceAll("'", "'") // Normalize apostrophes
    .replaceAll('" ', '"') // Normalize quotes
    .replaceAll(/[–—]/g, "-") // Normalize dashes
    .replaceAll("…", "...") // Normalize ellipsis
    .replaceAll("×", "x") // Normalize multiplication sign
    .replaceAll("！", "!") // Japanese exclamation
    .replaceAll("？", "?") // Japanese question mark
    .replaceAll("：", ":") // Japanese colon
    .replaceAll("；", ";") // Japanese semicolon
    .replaceAll("，", ",") // Japanese comma
    .replaceAll("。", ".") // Japanese period
    .replaceAll("（", "(") // Japanese left parenthesis
    .replaceAll("）", ")") // Japanese right parenthesis
    .replaceAll("「", '"') // Japanese left quote
    .replaceAll("」", '"') // Japanese right quote
    .replaceAll("『", '"') // Japanese left double quote
    .replaceAll("』", '"'); // Japanese right double quote

  // Handle common abbreviations
  for (const [abbrev, expansion] of ABBREVIATION_MAP) {
    const regex = new RegExp(`\\b${abbrev}\\b`, "gi");
    normalized = normalized.replaceAll(regex, expansion);
  }

  // Normalize whitespace and special characters
  normalized = normalized
    .replaceAll(/[^\w\s\-']/g, " ") // Replace most special chars with space
    .replaceAll(/-/g, "") // Remove dashes to match manga-search-service normalization
    .replaceAll(/\s+/g, "") // Remove all spaces for more consistent matching
    .toLowerCase()
    .trim();

  return normalized;
}

/**
 * Extract meaningful words from a title, filtering out common stop words
 */
export function extractMeaningfulWords(text: string): string[] {
  const stopWords = new Set([
    "the",
    "a",
    "an",
    "and",
    "or",
    "but",
    "in",
    "on",
    "at",
    "to",
    "for",
    "of",
    "with",
    "by",
    "wa",
    "no",
    "ga",
    "wo",
    "ni",
    "de",
    "kara",
    "made",
    "da",
    "desu",
    "desu",
    "des",
    "manga",
    "comic",
    "doujin",
    "doujinshi",
    "anthology",
    "collection",
  ]);

  // Use a lighter normalization for word extraction that preserves spaces
  let normalized = text.trim().toLowerCase();

  // Remove common ignorable patterns
  for (const pattern of IGNORABLE_PATTERNS) {
    normalized = normalized.replaceAll(pattern, "");
  }

  // Normalize punctuation but keep spaces
  normalized = normalized
    .replaceAll(/[^\w\s]/g, " ") // Replace punctuation with spaces
    .replaceAll(/\s+/g, " ") // Normalize multiple spaces to single space
    .trim();

  return normalized
    .split(/\s+/)
    .filter((word) => word.length > 1 && !stopWords.has(word));
}

/**
 * Calculate exact match score
 */
function calculateExactMatch(str1: string, str2: string): number {
  const norm1 = enhancedNormalize(str1);
  const norm2 = enhancedNormalize(str2);

  if (norm1 === norm2) return 1;

  // Check if one is exactly contained in the other
  if (norm1.includes(norm2) || norm2.includes(norm1)) {
    const shorter = Math.min(norm1.length, norm2.length);
    const longer = Math.max(norm1.length, norm2.length);
    return shorter / longer;
  }

  return 0;
}

/**
 * Calculate substring similarity
 */
function calculateSubstringMatch(str1: string, str2: string): number {
  const norm1 = enhancedNormalize(str1);
  const norm2 = enhancedNormalize(str2);

  if (norm1.length === 0 || norm2.length === 0) return 0;

  let maxSubstring = 0;

  // Find longest common substring
  for (let i = 0; i < norm1.length; i++) {
    for (let j = 0; j < norm2.length; j++) {
      let length = 0;
      while (
        i + length < norm1.length &&
        j + length < norm2.length &&
        norm1[i + length] === norm2[j + length]
      ) {
        length++;
      }
      maxSubstring = Math.max(maxSubstring, length);
    }
  }

  const maxLength = Math.max(norm1.length, norm2.length);
  return maxSubstring / maxLength;
}

/**
 * Calculate word order similarity using bag-of-words approach
 */
function calculateWordOrderSimilarity(str1: string, str2: string): number {
  const words1 = extractMeaningfulWords(str1);
  const words2 = extractMeaningfulWords(str2);

  if (words1.length === 0 && words2.length === 0) return 1;
  if (words1.length === 0 || words2.length === 0) return 0;

  // Count word matches
  const wordSet1 = new Set(words1);
  const wordSet2 = new Set(words2);

  const intersection = new Set(
    [...wordSet1].filter((word) => wordSet2.has(word)),
  );
  const union = new Set([...wordSet1, ...wordSet2]);

  // Jaccard similarity for word sets
  return intersection.size / union.size;
}

/**
 * Calculate character-level similarity using multiple algorithms
 */
function calculateCharacterSimilarity(str1: string, str2: string): number {
  const norm1 = enhancedNormalize(str1);
  const norm2 = enhancedNormalize(str2);

  if (norm1.length === 0 && norm2.length === 0) return 1;
  if (norm1.length === 0 || norm2.length === 0) return 0;

  // Use Dice coefficient from string-similarity library
  const diceScore = stringSimilarity.compareTwoStrings(norm1, norm2);

  // Also calculate Levenshtein-based similarity for comparison
  const levenshteinScore = calculateLevenshteinSimilarity(norm1, norm2);

  // Take the average of both algorithms for better accuracy
  return (diceScore + levenshteinScore) / 2;
}

/**
 * Calculate Levenshtein distance-based similarity
 */
function calculateLevenshteinSimilarity(str1: string, str2: string): number {
  if (str1 === str2) return 1;

  const len1 = str1.length;
  const len2 = str2.length;

  if (len1 === 0) return len2 === 0 ? 1 : 0;
  if (len2 === 0) return 0;

  // Create matrix for dynamic programming
  const matrix: number[][] = Array(len1 + 1)
    .fill(null)
    .map(() => new Array(len2 + 1).fill(0));

  // Initialize first row and column
  for (let i = 0; i <= len1; i++) matrix[i][0] = i;
  for (let j = 0; j <= len2; j++) matrix[0][j] = j;

  // Fill the matrix
  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1, // deletion
        matrix[i][j - 1] + 1, // insertion
        matrix[i - 1][j - 1] + cost, // substitution
      );
    }
  }

  const distance = matrix[len1][len2];
  const maxLength = Math.max(len1, len2);

  return 1 - distance / maxLength;
}

/**
 * Calculate semantic similarity (basic implementation)
 */
function calculateSemanticSimilarity(str1: string, str2: string): number {
  const words1 = extractMeaningfulWords(str1);
  const words2 = extractMeaningfulWords(str2);

  if (words1.length === 0 && words2.length === 0) return 1;
  if (words1.length === 0 || words2.length === 0) return 0;

  // Simple semantic similarity based on word overlap and positioning
  let score = 0;
  let maxPossibleScore = 0;

  for (const word1 of words1) {
    maxPossibleScore += 1;

    // Find best match in words2
    let bestMatch = 0;
    for (const word2 of words2) {
      // Exact match gets full score
      if (word1 === word2) {
        bestMatch = 1;
        break;
      }

      // Partial match based on character similarity
      const charSim = stringSimilarity.compareTwoStrings(word1, word2);
      if (charSim > 0.8) {
        // Only consider high similarity as semantic match
        bestMatch = Math.max(bestMatch, charSim);
      }
    }

    score += bestMatch;
  }

  return maxPossibleScore > 0 ? score / maxPossibleScore : 0;
}

/**
 * Enhanced title similarity calculation with multiple algorithms and weighting
 */
export function calculateEnhancedSimilarity(
  str1: string,
  str2: string,
  config: Partial<SimilarityConfig> = {},
): number {
  const finalConfig = { ...DEFAULT_SIMILARITY_CONFIG, ...config };

  if (!str1 || !str2) return 0;
  if (str1 === str2) return 100;

  const norm1 = enhancedNormalize(str1);
  const norm2 = enhancedNormalize(str2);

  if (norm1 === norm2) return 100;
  if (norm1.length === 0 || norm2.length === 0) return 0;

  // Check for extreme length differences
  const lengthRatio =
    Math.min(norm1.length, norm2.length) / Math.max(norm1.length, norm2.length);
  if (lengthRatio < finalConfig.lengthDifferenceThreshold) {
    // Apply penalty for very different lengths, but don't completely eliminate the match
    const lengthPenalty = lengthRatio;

    // Still calculate basic similarity but apply the penalty
    const basicSimilarity = stringSimilarity.compareTwoStrings(norm1, norm2);
    const penalizedScore = basicSimilarity * lengthPenalty;

    if (finalConfig.debug) {
      console.log(
        `Length penalty applied: ${str1} vs ${str2}, ratio: ${lengthRatio.toFixed(2)}, score: ${(penalizedScore * 100).toFixed(1)}`,
      );
    }

    return Math.round(penalizedScore * 100);
  }

  // Calculate different types of similarity
  const exactMatch = calculateExactMatch(str1, str2);
  const substringMatch = calculateSubstringMatch(str1, str2);
  const wordOrderSim = calculateWordOrderSimilarity(str1, str2);
  const characterSim = calculateCharacterSimilarity(str1, str2);
  const semanticSim = calculateSemanticSimilarity(str1, str2);

  // Calculate weighted average
  const totalWeight =
    finalConfig.exactMatchWeight +
    finalConfig.substringMatchWeight +
    finalConfig.wordOrderWeight +
    finalConfig.characterSimilarityWeight +
    finalConfig.semanticWeight;

  const weightedScore =
    (exactMatch * finalConfig.exactMatchWeight +
      substringMatch * finalConfig.substringMatchWeight +
      wordOrderSim * finalConfig.wordOrderWeight +
      characterSim * finalConfig.characterSimilarityWeight +
      semanticSim * finalConfig.semanticWeight) /
    totalWeight;

  const finalScore = Math.round(weightedScore * 100);

  if (finalConfig.debug) {
    console.log(`Similarity calculation for "${str1}" vs "${str2}":`);
    console.log(`  Exact: ${(exactMatch * 100).toFixed(1)}%`);
    console.log(`  Substring: ${(substringMatch * 100).toFixed(1)}%`);
    console.log(`  Word Order: ${(wordOrderSim * 100).toFixed(1)}%`);
    console.log(`  Character: ${(characterSim * 100).toFixed(1)}%`);
    console.log(`  Semantic: ${(semanticSim * 100).toFixed(1)}%`);
    console.log(`  Final: ${finalScore}%`);
  }

  return Math.min(100, Math.max(0, finalScore));
}
