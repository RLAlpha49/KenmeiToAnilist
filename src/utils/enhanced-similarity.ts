/**
 * @packageDocumentation
 * @module enhanced-similarity
 * @description Enhanced title similarity calculation for manga matching with improved normalization and multiple scoring algorithms.
 */

import * as stringSimilarity from "string-similarity";
import { distance as levenshteinDistance } from "fastest-levenshtein";

/**
 * Configuration for enhanced similarity calculation
 */
const NORMALIZE_CACHE_LIMIT = 2000;
const MEANINGFUL_WORDS_CACHE_LIMIT = 2000;
const PAIR_SIMILARITY_CACHE_LIMIT = 3000;
const LEVENSHTEIN_CACHE_LIMIT = 3000;
const SUBSTRING_CACHE_LIMIT = 3000;
const WORD_ORDER_CACHE_LIMIT = 3000;
const SEMANTIC_CACHE_LIMIT = 3000;
const JARO_WINKLER_CACHE_LIMIT = 3000;
const NGRAM_CACHE_LIMIT = 3000;

const normalizeCache = new Map<string, string>();
const enhancedSimilarityCache = new Map<string, number>();
const levenshteinCache = new Map<string, number>();
const substringCache = new Map<string, number>();
const meaningfulWordsCache = new Map<string, string[]>();
const wordOrderCache = new Map<string, number>();
const semanticSimilarityCache = new Map<string, number>();
const jaroWinklerCache = new Map<string, number>();
const ngramCache = new Map<string, number>();

const getCacheEntry = <T>(
  cache: Map<string, T>,
  key: string,
): T | undefined => {
  if (!cache.has(key)) {
    return undefined;
  }

  const value = cache.get(key) as T;
  cache.delete(key);
  cache.set(key, value);
  return value;
};

const setCacheEntry = <T>(
  cache: Map<string, T>,
  key: string,
  value: T,
  limit: number,
): void => {
  if (!cache.has(key) && cache.size >= limit) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey !== undefined) {
      cache.delete(oldestKey);
    }
  }

  cache.set(key, value);
};

const makeOrderedPairKey = (a: string, b: string): string => {
  return a <= b ? `${a}::${b}` : `${b}::${a}`;
};

/**
 * Simple Porter Stemmer implementation (browser-compatible)
 * Based on Porter Stemming Algorithm
 */
const porterStem = (word: string): string => {
  if (word.length <= 2) return word;

  let stem = word.toLowerCase();

  // Step 1a: plurals
  stem = stem.replace(/sses$/i, "ss");
  stem = stem.replace(/ies$/i, "i");
  stem = stem.replace(/ss$/i, "ss");
  stem = stem.replace(/s$/i, "");

  // Step 1b: -ed, -ing
  if (/(at|bl|iz)ed$/i.test(stem)) {
    stem = stem.replace(/ed$/i, "e");
  } else if (/([^aeiou])ed$/i.test(stem)) {
    stem = stem.replace(/ed$/i, "");
  }

  if (/ing$/i.test(stem) && /[aeiou]/i.test(stem)) {
    stem = stem.replace(/ing$/i, "");
  }

  // Step 1c: -y
  if (/([^aeiou])y$/i.test(stem)) {
    stem = stem.replace(/y$/i, "i");
  }

  // Step 2: double letter endings
  stem = stem.replace(
    /(ational|tional|enci|anci|izer|abli|alli|entli|eli|ousli|ization|ation|ator|alism|iveness|fulness|ousness|aliti|iviti|biliti)$/i,
    (match) => {
      const replacements: Record<string, string> = {
        ational: "ate",
        tional: "tion",
        enci: "ence",
        anci: "ance",
        izer: "ize",
        abli: "able",
        alli: "al",
        entli: "ent",
        eli: "e",
        ousli: "ous",
        ization: "ize",
        ation: "ate",
        ator: "ate",
        alism: "al",
        iveness: "ive",
        fulness: "ful",
        ousness: "ous",
        aliti: "al",
        iviti: "ive",
        biliti: "ble",
      };
      return replacements[match.toLowerCase()] || match;
    },
  );

  // Step 3: -icate, -ative, -alize, -iciti, -ical, -ful, -ness
  stem = stem.replace(/(icate|ative|alize|iciti|ical|ful|ness)$/i, (match) => {
    const replacements: Record<string, string> = {
      icate: "ic",
      ative: "",
      alize: "al",
      iciti: "ic",
      ical: "ic",
      ful: "",
      ness: "",
    };
    return replacements[match.toLowerCase()] || match;
  });

  // Step 4: remove -ant, -ence, -er, -ism, -able, -ible, -ment, -ent, -ou, -ism, -ate, -iti, -ous, -ive, -ize
  stem = stem.replace(
    /(al|ance|ence|er|ic|able|ible|ant|ement|ment|ent|ou|ism|ate|iti|ous|ive|ize)$/i,
    "",
  );

  return stem;
};

/**
 * Jaro-Winkler distance implementation (browser-compatible)
 * Returns similarity score between 0 and 1
 */
/**
 * Find character matches for Jaro-Winkler distance calculation
 * @internal
 */
const findCharacterMatches = (
  s1: string,
  s2: string,
  matchDistance: number,
): { matches: number; matches1: boolean[]; matches2: boolean[] } => {
  const len1 = s1.length;
  const len2 = s2.length;
  const matches1 = new Array<boolean>(len1).fill(false);
  const matches2 = new Array<boolean>(len2).fill(false);

  let matches = 0;

  for (let i = 0; i < len1; i++) {
    const start = Math.max(0, i - matchDistance);
    const end = Math.min(i + matchDistance + 1, len2);

    for (let j = start; j < end; j++) {
      if (matches2[j] || s1[i] !== s2[j]) continue;
      matches1[i] = true;
      matches2[j] = true;
      matches++;
      break;
    }
  }

  return { matches, matches1, matches2 };
};

/**
 * Calculate transpositions for Jaro-Winkler distance
 * @internal
 */
const calculateTranspositions = (
  s1: string,
  s2: string,
  matches1: boolean[],
  matches2: boolean[],
): number => {
  let transpositions = 0;
  let k = 0;

  for (let i = 0; i < s1.length; i++) {
    if (!matches1[i]) continue;
    while (!matches2[k]) k++;
    if (s1[i] !== s2[k]) transpositions++;
    k++;
  }

  return transpositions;
};

/**
 * Calculate common prefix length for Jaro-Winkler bonus
 * @internal
 */
const calculateCommonPrefixLength = (s1: string, s2: string): number => {
  let prefix = 0;
  const maxPrefixLength = Math.min(s1.length, s2.length, 4);

  for (let i = 0; i < maxPrefixLength; i++) {
    if (s1[i] === s2[i]) prefix++;
    else break;
  }

  return prefix;
};

const jaroWinklerDistance = (s1: string, s2: string): number => {
  if (s1 === s2) return 1;

  const len1 = s1.length;
  const len2 = s2.length;

  if (len1 === 0 || len2 === 0) return 0;

  const matchDistance = Math.floor(Math.max(len1, len2) / 2) - 1;
  const { matches, matches1, matches2 } = findCharacterMatches(
    s1,
    s2,
    matchDistance,
  );

  if (matches === 0) return 0;

  const transpositions = calculateTranspositions(s1, s2, matches1, matches2);

  const jaro =
    (matches / len1 +
      matches / len2 +
      (matches - transpositions / 2) / matches) /
    3;

  const prefix = calculateCommonPrefixLength(s1, s2);

  return jaro + prefix * 0.1 * (1 - jaro);
};

const createConfigKey = (config: SimilarityConfig): string => {
  return [
    config.exactMatchWeight,
    config.substringMatchWeight,
    config.wordOrderWeight,
    config.characterSimilarityWeight,
    config.semanticWeight,
    config.lengthDifferenceThreshold,
  ]
    .map((value) => value.toFixed(6))
    .join("|");
};

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
  /** Weight for Jaro-Winkler distance (0-1) */
  jaroWinklerWeight: number;
  /** Weight for n-gram similarity (0-1) */
  ngramWeight: number;
  /** Minimum length difference ratio to heavily penalize (0-1) */
  lengthDifferenceThreshold: number;
  /** Whether to enable debug logging */
  debug: boolean;
}

/**
 * Default configuration for similarity calculation
 * Weights are balanced to prioritize exact matches, then character similarity, then various fuzzy matching techniques
 */
export const DEFAULT_SIMILARITY_CONFIG: SimilarityConfig = {
  exactMatchWeight: 0.35,
  substringMatchWeight: 0.12,
  wordOrderWeight: 0.08,
  characterSimilarityWeight: 0.18,
  semanticWeight: 0.1,
  jaroWinklerWeight: 0.1,
  ngramWeight: 0.07,
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
  /^\[.*?\]\s*/gi, // [Tag] at start
  /\s*\[.*?\]$/gi, // [Tag] at end
  /^\(.*?\)\s*/gi, // (Text) at start
  /\s*\(.*?\)$/gi, // (Text) at end
  /\s*-\s*raw$/gi, // "- Raw" suffix
  /\s*raw$/gi, // "Raw" suffix
  /\s*scan$/gi, // "Scan" suffix
  /\s*manga$/gi, // "Manga" suffix (when redundant)
  /\s*comic$/gi, // "Comic" suffix
  /\s*doujin(shi)?$/gi, // "Doujin/Doujinshi" suffix
  /\s*anthology$/gi, // "Anthology" suffix
  /\s*collection$/gi, // "Collection" suffix
  /\s*vol\.\s*\d+/gi, // Volume numbers
  /\s*volume\s*\d+/gi, // Volume numbers
  /\s*ch\.\s*\d+/gi, // Chapter numbers
  /\s*chapter\s*\d+/gi, // Chapter numbers
  /\s*oneshot$/gi, // "Oneshot" suffix
  /\s*one[-\s]shot$/gi, // "One-shot" variations
];

/**
 * Enhanced string normalization for manga titles
 */
export function enhancedNormalize(text: string): string {
  if (!text) return "";

  const cached = getCacheEntry(normalizeCache, text);
  if (cached !== undefined) {
    return cached;
  }

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
    .replaceAll(/[\u2013\u2014]/g, "-") // Normalize dashes
    .replaceAll("\u2026", "...") // Normalize ellipsis
    .replaceAll("\u00d7", "x") // Normalize multiplication sign
    .replaceAll("\uff01", "!") // Japanese exclamation
    .replaceAll("\uff1f", "?") // Japanese question mark
    .replaceAll("\uff1a", ":") // Japanese colon
    .replaceAll("\uff1b", ";") // Japanese semicolon
    .replaceAll("\uff0c", ",") // Japanese comma
    .replaceAll("\u3002", ".") // Japanese period
    .replaceAll("\uff08", "(") // Japanese left parenthesis
    .replaceAll("\uff09", ")") // Japanese right parenthesis
    .replaceAll("\u300c", '"') // Japanese left quote
    .replaceAll("\u300d", '"') // Japanese right quote
    .replaceAll("\u300e", '"') // Japanese left double quote
    .replaceAll("\u300f", '"'); // Japanese right double quote

  // Handle common abbreviations
  for (const [abbrev, expansion] of ABBREVIATION_MAP) {
    const regex = new RegExp(`\\b${abbrev}\\b`, "gi");
    normalized = normalized.replaceAll(regex, expansion);
  }

  // Normalize whitespace and special characters
  normalized = normalized
    .replaceAll(/[^\w\s\-']/g, " ") // Replace most special chars with space
    .replaceAll("-", "") // Remove dashes to match manga-search-service normalization
    .replaceAll(/\s+/g, "") // Remove all spaces for more consistent matching
    .toLowerCase()
    .trim();

  setCacheEntry(normalizeCache, text, normalized, NORMALIZE_CACHE_LIMIT);

  return normalized;
}

/**
 * Extract meaningful words from a title, filtering out common stop words
 */
const STOP_WORDS = new Set([
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

export function extractMeaningfulWords(text: string): string[] {
  const cached = getCacheEntry(meaningfulWordsCache, text);
  if (cached !== undefined) {
    return cached.slice();
  }

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

  const words = normalized
    .split(/\s+/)
    .filter((word) => word.length > 1 && !STOP_WORDS.has(word));

  setCacheEntry(
    meaningfulWordsCache,
    text,
    words,
    MEANINGFUL_WORDS_CACHE_LIMIT,
  );

  return words.slice();
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

  const pairKey = makeOrderedPairKey(norm1, norm2);
  const cached = getCacheEntry(substringCache, pairKey);
  if (cached !== undefined) {
    return cached;
  }

  const len1 = norm1.length;
  const len2 = norm2.length;
  const minLength = Math.min(len1, len2);
  const maxLength = Math.max(len1, len2);

  let longest = 0;
  let previous = new Uint16Array(len2 + 1);
  let current = new Uint16Array(len2 + 1);

  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const length =
        norm1.codePointAt(i - 1) === norm2.codePointAt(j - 1)
          ? previous[j - 1] + 1
          : 0;
      current[j] = length;
      longest = Math.max(longest, length);
    }

    if (longest === minLength) {
      setCacheEntry(substringCache, pairKey, 1, SUBSTRING_CACHE_LIMIT);
      return 1;
    }

    const temp = previous;
    previous = current;
    current = temp;
    current.fill(0);
  }

  const score = longest / maxLength;
  setCacheEntry(substringCache, pairKey, score, SUBSTRING_CACHE_LIMIT);

  return score;
}

/**
 * Calculate word order similarity using bag-of-words approach
 */
function calculateWordOrderSimilarity(str1: string, str2: string): number {
  const pairKey = makeOrderedPairKey(
    enhancedNormalize(str1),
    enhancedNormalize(str2),
  );
  const cached = getCacheEntry(wordOrderCache, pairKey);
  if (cached !== undefined) {
    return cached;
  }

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
  const score = intersection.size / union.size;

  setCacheEntry(wordOrderCache, pairKey, score, WORD_ORDER_CACHE_LIMIT);

  return score;
}

/**
 * Calculate character-level similarity using multiple algorithms
 */
function calculateCharacterSimilarity(str1: string, str2: string): number {
  const norm1 = enhancedNormalize(str1);
  const norm2 = enhancedNormalize(str2);

  if (norm1.length === 0 && norm2.length === 0) return 1;
  if (norm1.length === 0 || norm2.length === 0) return 0;
  if (norm1 === norm2) return 1;

  // Use Dice coefficient from string-similarity library
  const diceScore = stringSimilarity.compareTwoStrings(norm1, norm2);
  if (diceScore === 1) {
    return 1;
  }

  // Also calculate Levenshtein-based similarity for comparison
  const levenshteinScore = calculateLevenshteinSimilarity(norm1, norm2);

  // Take the average of both algorithms for better accuracy
  return (diceScore + levenshteinScore) / 2;
}

/**
 * Calculate Levenshtein distance-based similarity using fastest-levenshtein library
 * This is significantly faster than custom implementations
 */
function calculateLevenshteinSimilarity(str1: string, str2: string): number {
  if (str1 === str2) return 1;

  const len1 = str1.length;
  const len2 = str2.length;

  if (len1 === 0) return len2 === 0 ? 1 : 0;
  if (len2 === 0) return 0;

  const pairKey = makeOrderedPairKey(str1, str2);
  const cached = getCacheEntry(levenshteinCache, pairKey);
  if (cached !== undefined) {
    return cached;
  }

  const maxLength = Math.max(len1, len2);
  const distance = levenshteinDistance(str1, str2);

  // Early exit for very dissimilar strings
  if (distance >= maxLength) {
    setCacheEntry(levenshteinCache, pairKey, 0, LEVENSHTEIN_CACHE_LIMIT);
    return 0;
  }

  const similarity = 1 - distance / maxLength;
  setCacheEntry(levenshteinCache, pairKey, similarity, LEVENSHTEIN_CACHE_LIMIT);

  return similarity;
}

/**
 * Calculate Jaro-Winkler distance-based similarity
 * Particularly effective for short strings and typos near the beginning
 */
function calculateJaroWinklerSimilarity(str1: string, str2: string): number {
  if (str1 === str2) return 1;

  const len1 = str1.length;
  const len2 = str2.length;

  if (len1 === 0 && len2 === 0) return 1;
  if (len1 === 0 || len2 === 0) return 0;

  const pairKey = makeOrderedPairKey(str1, str2);
  const cached = getCacheEntry(jaroWinklerCache, pairKey);
  if (cached !== undefined) {
    return cached;
  }

  // Use browser-compatible Jaro-Winkler implementation
  const similarity = jaroWinklerDistance(
    str1.toLowerCase(),
    str2.toLowerCase(),
  );

  setCacheEntry(
    jaroWinklerCache,
    pairKey,
    similarity,
    JARO_WINKLER_CACHE_LIMIT,
  );
  return similarity;
}

/**
 * Calculate n-gram similarity (trigram analysis)
 * Effective for catching character-level similarities and typos
 */
function calculateNgramSimilarity(str1: string, str2: string, n = 3): number {
  if (str1 === str2) return 1;

  const len1 = str1.length;
  const len2 = str2.length;

  if (len1 === 0 && len2 === 0) return 1;
  if (len1 === 0 || len2 === 0) return 0;

  const pairKey = makeOrderedPairKey(str1, str2) + `::n${n}`;
  const cached = getCacheEntry(ngramCache, pairKey);
  if (cached !== undefined) {
    return cached;
  }

  // For very short strings, use bigrams instead of trigrams
  const ngramSize = Math.min(n, Math.min(len1, len2));
  if (ngramSize < 2) {
    // Fall back to character comparison for very short strings
    return str1 === str2 ? 1 : 0;
  }

  // Generate n-grams
  const ngrams1 = new Set<string>();
  const ngrams2 = new Set<string>();

  for (let i = 0; i <= len1 - ngramSize; i++) {
    ngrams1.add(str1.slice(i, i + ngramSize));
  }

  for (let i = 0; i <= len2 - ngramSize; i++) {
    ngrams2.add(str2.slice(i, i + ngramSize));
  }

  // Calculate Jaccard similarity of n-gram sets
  const intersection = new Set([...ngrams1].filter((x) => ngrams2.has(x)));
  const union = new Set([...ngrams1, ...ngrams2]);

  const similarity = union.size > 0 ? intersection.size / union.size : 0;

  setCacheEntry(ngramCache, pairKey, similarity, NGRAM_CACHE_LIMIT);
  return similarity;
}

/**
 * Calculate semantic similarity using improved NLP techniques
 * Uses stemming and better word matching algorithms
 */
/**
 * Calculate stemmed words similarity
 * @internal
 */
function calculateStemmedSimilarity(
  stemmedWords1: string[],
  stemmedWords2: string[],
): number {
  const stemSet1 = new Set(stemmedWords1);
  const stemSet2 = new Set(stemmedWords2);
  const stemIntersection = new Set(
    [...stemSet1].filter((x) => stemSet2.has(x)),
  );
  const stemUnion = new Set([...stemSet1, ...stemSet2]);
  return stemUnion.size > 0 ? stemIntersection.size / stemUnion.size : 0;
}

/**
 * Find best word match between word1 and word2 list
 * @internal
 */
function findBestWordMatch(
  word1: string,
  stem1: string,
  words2: string[],
  stemmedWords2: string[],
): number {
  let bestMatch = 0;

  for (let j = 0; j < words2.length; j++) {
    const word2 = words2[j];
    const stem2 = stemmedWords2[j];

    if (word1 === word2) {
      return 1;
    }

    if (stem1 === stem2) {
      bestMatch = Math.max(bestMatch, 0.95);
      continue;
    }

    const jaroSim = jaroWinklerDistance(
      word1.toLowerCase(),
      word2.toLowerCase(),
    );
    if (jaroSim > 0.85) {
      bestMatch = Math.max(bestMatch, jaroSim * 0.9);
    }

    const diceSim = stringSimilarity.compareTwoStrings(word1, word2);
    if (diceSim > 0.8) {
      bestMatch = Math.max(bestMatch, diceSim * 0.85);
    }
  }

  return bestMatch;
}

/**
 * Calculate word-to-word match score
 * @internal
 */
function calculateWordMatchScore(
  words1: string[],
  stemmedWords1: string[],
  words2: string[],
  stemmedWords2: string[],
): number {
  let score = 0;

  for (let i = 0; i < words1.length; i++) {
    const bestMatch = findBestWordMatch(
      words1[i],
      stemmedWords1[i],
      words2,
      stemmedWords2,
    );
    score += bestMatch;
  }

  return words1.length > 0 ? score / words1.length : 0;
}

function calculateSemanticSimilarity(str1: string, str2: string): number {
  const pairKey = makeOrderedPairKey(
    enhancedNormalize(str1),
    enhancedNormalize(str2),
  );
  const cached = getCacheEntry(semanticSimilarityCache, pairKey);
  if (cached !== undefined) {
    return cached;
  }

  const words1 = extractMeaningfulWords(str1);
  const words2 = extractMeaningfulWords(str2);

  if (words1.length === 0 && words2.length === 0) return 1;
  if (words1.length === 0 || words2.length === 0) return 0;

  const stemmedWords1 = words1.map((w) => porterStem(w));
  const stemmedWords2 = words2.map((w) => porterStem(w));

  const stemJaccard = calculateStemmedSimilarity(stemmedWords1, stemmedWords2);

  const wordMatchScore = calculateWordMatchScore(
    words1,
    stemmedWords1,
    words2,
    stemmedWords2,
  );

  const semanticScore = wordMatchScore * 0.7 + stemJaccard * 0.3;

  setCacheEntry(
    semanticSimilarityCache,
    pairKey,
    semanticScore,
    SEMANTIC_CACHE_LIMIT,
  );

  return semanticScore;
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

  let cacheKey: string | null = null;
  if (!finalConfig.debug) {
    const pairKey = makeOrderedPairKey(norm1, norm2);
    const configKey = createConfigKey(finalConfig);
    cacheKey = `${pairKey}::${configKey}`;

    const cached = getCacheEntry(enhancedSimilarityCache, cacheKey);
    if (cached !== undefined) {
      return cached;
    }
  }

  // Check for extreme length differences
  const lengthRatio =
    Math.min(norm1.length, norm2.length) / Math.max(norm1.length, norm2.length);
  if (lengthRatio < finalConfig.lengthDifferenceThreshold) {
    // Apply penalty for very different lengths, but don't completely eliminate the match
    const lengthPenalty = lengthRatio;

    // Still calculate basic similarity but apply the penalty
    const basicSimilarity = stringSimilarity.compareTwoStrings(norm1, norm2);
    const penalizedScore = basicSimilarity * lengthPenalty;
    const roundedPenaltyScore = Math.round(penalizedScore * 100);

    if (finalConfig.debug) {
      console.debug(
        `[Similarity] Length penalty applied: ${str1} vs ${str2}, ratio: ${lengthRatio.toFixed(2)}, score: ${(penalizedScore * 100).toFixed(1)}`,
      );
    }

    const boundedPenaltyScore = Math.min(100, Math.max(0, roundedPenaltyScore));

    if (cacheKey) {
      setCacheEntry(
        enhancedSimilarityCache,
        cacheKey,
        boundedPenaltyScore,
        PAIR_SIMILARITY_CACHE_LIMIT,
      );
    }

    return boundedPenaltyScore;
  }

  // Calculate different types of similarity
  const exactMatch = calculateExactMatch(str1, str2);
  const substringMatch = calculateSubstringMatch(str1, str2);
  const wordOrderSim = calculateWordOrderSimilarity(str1, str2);
  const characterSim = calculateCharacterSimilarity(str1, str2);
  const semanticSim = calculateSemanticSimilarity(str1, str2);
  const jaroWinklerSim = calculateJaroWinklerSimilarity(norm1, norm2);
  const ngramSim = calculateNgramSimilarity(norm1, norm2);

  // Calculate weighted average with all similarity metrics
  const totalWeight =
    finalConfig.exactMatchWeight +
    finalConfig.substringMatchWeight +
    finalConfig.wordOrderWeight +
    finalConfig.characterSimilarityWeight +
    finalConfig.semanticWeight +
    finalConfig.jaroWinklerWeight +
    finalConfig.ngramWeight;

  const weightedScore =
    (exactMatch * finalConfig.exactMatchWeight +
      substringMatch * finalConfig.substringMatchWeight +
      wordOrderSim * finalConfig.wordOrderWeight +
      characterSim * finalConfig.characterSimilarityWeight +
      semanticSim * finalConfig.semanticWeight +
      jaroWinklerSim * finalConfig.jaroWinklerWeight +
      ngramSim * finalConfig.ngramWeight) /
    totalWeight;

  const roundedScore = Math.round(weightedScore * 100);
  const boundedScore = Math.min(100, Math.max(0, roundedScore));

  if (finalConfig.debug) {
    console.debug(
      `[Similarity] Similarity calculation for "${str1}" vs "${str2}":`,
    );
    console.debug(`[Similarity]   Exact: ${(exactMatch * 100).toFixed(1)}%`);
    console.debug(
      `[Similarity]   Substring: ${(substringMatch * 100).toFixed(1)}%`,
    );
    console.debug(
      `[Similarity]   Word Order: ${(wordOrderSim * 100).toFixed(1)}%`,
    );
    console.debug(
      `[Similarity]   Character: ${(characterSim * 100).toFixed(1)}%`,
    );
    console.debug(
      `[Similarity]   Semantic: ${(semanticSim * 100).toFixed(1)}%`,
    );
    console.debug(
      `[Similarity]   Jaro-Winkler: ${(jaroWinklerSim * 100).toFixed(1)}%`,
    );
    console.debug(`[Similarity]   N-gram: ${(ngramSim * 100).toFixed(1)}%`);
    console.debug(`[Similarity]   Final: ${boundedScore}%`);
  }

  if (cacheKey) {
    setCacheEntry(
      enhancedSimilarityCache,
      cacheKey,
      boundedScore,
      PAIR_SIMILARITY_CACHE_LIMIT,
    );
  }

  return boundedScore;
}
