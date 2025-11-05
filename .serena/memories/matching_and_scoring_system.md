# Matching & Scoring System Architecture

## Overview

The matching system is a sophisticated multi-stage pipeline that searches for manga matches, applies filters, scores candidates, and determines confidence. It handles complex scenarios like duplicates, alternative titles, and regional variants.

## Pipeline Architecture

### High-Level Flow

```text
1. Search (Orchestration)
   ├─ Check cache
   ├─ Query multiple sources (AniList, ComicK fallback, MangaDex fallback)
   └─ Merge results

2. Filter
   ├─ Apply system filters (light novels, hard excludes)
   ├─ Check exact matches
   ├─ Apply user custom rules
   └─ Remove excluded entries

3. Score
   ├─ Calculate similarity (title, format, etc.)
   ├─ Apply title priority weighting
   ├─ Score alternative titles
   ├─ Normalize scores (0-100)
   └─ Apply confidence mapping

4. Rank
   ├─ Sort by final score
   ├─ Calculate confidence level
   ├─ Determine if auto-match (20-point lead)
   └─ Return ordered results
```

### Component Organization

**Location**: `src/api/matching/`

```text
matching/
├─ match-engine.ts           # Core scoring engine
├─ search-service.ts         # High-level search orchestration
├─ orchestration/            # Search pipeline orchestration
│  ├─ search-orchestrator.ts # Main orchestration
│  ├─ search-execution.ts    # Execute searches
│  ├─ ranking.ts             # Rank and confidence
│  ├─ result-processing.ts   # Post-process results
│  └─ response-builder.ts    # Build final response
├─ scoring/                  # Scoring algorithms
│  ├─ match-scorer.ts        # Score individual matches
│  ├─ similarity-calculator.ts
│  ├─ confidence-mapper.ts  # Score → confidence
│  └─ title-priority.ts      # Title weighting
├─ filtering/                # Filter candidates
│  ├─ system-filters.ts      # Hard excludes
│  ├─ custom-rules.ts        # User regex rules
│  ├─ exact-match-checker.ts
│  ├─ inclusion-rules.ts     # Include criteria
│  └─ skip-rules.ts
├─ normalization/            # Title normalization
│  ├─ title-normalizer.ts
│  ├─ pattern-detection.ts
│  └─ character-utils.ts
├─ sources/                  # Source integration
│  ├─ comick-processing.ts
│  ├─ mangadex-processing.ts
│  └─ merge-utils.ts
└─ batching/                 # Batch optimization
   ├─ batch-search.ts
   ├─ categorization.ts      # Cache/uncached/known
   ├─ known-ids.ts           # Known ID lookup
   └─ results.ts             # Compile results
```

## Scoring System

### Match Scoring Algorithm

**Location**: `src/api/matching/scoring/match-scorer.ts`

**Multi-component Scoring**:

```text
Final Score = (
  primaryTitleScore * 0.40 +          # 40% - Main title match
  alternativeTitleScore * 0.20 +      # 20% - Alt titles
  synonymScore * 0.15 +               # 15% - Synonyms
  formatMatch * 0.15 +                # 15% - Format matching
  yearProximity * 0.10                # 10% - Year proximity
)
```

### Similarity Calculations

**Location**: `src/api/matching/scoring/similarity-calculator.ts`

**Used**: `src/utils/enhanced-similarity.ts`

**Algorithm Suite**:

1. **Exact Match** (100 points if identical after normalization)
2. **Substring Match** (partial credit if title contains substring)
3. **Jaro-Winkler** (character-level similarity, 0-100)
4. **Levenshtein** (edit distance based, 0-100)
5. **N-gram Analysis** (character sequence matching)
6. **Semantic Similarity** (stemmed word matching with Jaccard coefficient)
7. **Word Order** (token sequence comparison)
8. **Meaningful Word Overlap** (ignore stop words, focus on key terms)

**Weighting**:

- Exact match: 40% weight
- Substring match: 15% weight
- Jaro-Winkler: 20% weight
- Levenshtein: 15% weight
- N-gram: 5% weight
- Semantic: 3% weight
- Word order: 2% weight

**Result**: Composite score 0-100 representing overall similarity

### Caching Strategy

**Multiple Cache Layers** (`src/api/matching/cache/`):

1. **Normalization Cache** - `normalizeCache` (10,000 entries max)
2. **Jaro-Winkler Cache** - `jaroWinklerCache` (5,000 entries)
3. **Levenshtein Cache** - `levenshteinCache` (5,000 entries)
4. **Semantic Similarity Cache** - `semanticSimilarityCache` (2,000 entries)
5. **N-gram Cache** - `ngramCache` (1,000 entries)
6. **Substring Cache** - `substringCache` (1,000 entries)
7. **Meaningful Words Cache** - `meaningfulWordsCache` (2,000 entries)
8. **Word Order Cache** - `wordOrderCache` (2,000 entries)
9. **Enhanced Similarity Cache** - `enhancedSimilarityCache` (1,000 entries)
10. **Pair Similarity Cache** - `pairSimilarityCache` (5,000 entries)

**Cache Key Strategy**: `makeOrderedPairKey(str1, str2)` for pair operations

**Benefits**:

- O(1) cache lookups
- Significant speed improvement on repeated comparisons
- Reasonable memory footprint
- Automatic eviction when limit reached

### Confidence Mapping

**Location**: `src/api/matching/scoring/confidence-mapper.ts`

**Score → Confidence Level Mapping**:

```text
Score Range    | Confidence    | Auto-Match?
≥ 90           | Very High     | ✅ Yes (if lead ≥ 20)
80-89          | High          | Maybe (if lead ≥ 20)
70-79          | Good          | ❌ No
60-69          | Medium        | ❌ No
50-59          | Low           | ❌ No
< 50           | Very Low      | ❌ No (usually filtered)
```

**Auto-Match Logic**:

- Top 2 scores differ by ≥ 20 points → Auto-match
- Manual review required otherwise

## Filtering System

### System Filters

**Location**: `src/api/matching/filtering/system-filters.ts`

**Hard Excludes** (always filtered out):

1. **Light Novels** - Detected by format or keywords
   - Pattern: "light novel", "LN", specific genres
   - Excluded because: Different from manga (Kenmei is manga-focused)

2. **Manhwa/Manhua** - Regional variants (depending on config)
   - Optional filter based on user preference
   - Sometimes wanted, sometimes not

3. **Web Comics** - Non-traditional formats
   - Detected by format tag "WEB_COMIC"

4. **One-Shots** - Individual chapters
   - Detected by format or high minimum chapters threshold

**Rationale**: These formats don't match Kenmei data which is manga-specific

### Custom Rules System

**Location**: `src/api/matching/filtering/custom-rules.ts`

**User-Defined Regex Patterns** with multiple metadata targets:

```typescript
interface CustomRule {
  id: string;
  pattern: string; // JavaScript regex
  description: string;
  enabled: boolean;
  caseSensitive: boolean;
  targetFields: CustomRuleTarget[]; // Which fields to check
  createdAt: string;
}

type CustomRuleTarget =
  | "titles" // All title variants
  | "author" // Author names
  | "genres" // Genre tags
  | "tags" // Detailed tags
  | "format" // Publication format
  | "country" // Country of origin
  | "source" // Original source
  | "description" // Manga synopsis
  | "status"; // Publishing status
```

**Validation**:

- ReDoS (Regular Expression Denial of Service) detection
- Nested quantifiers check
- Overlapping alternations detection
- Catastrophic backtracking prevention
- Basic regex syntax validation

**Operation**: `testRuleAgainstMetadata()` evaluates pattern against all targetFields

**Two Rule Types**:

1. **Skip Rules** - Exclude matches matching pattern
2. **Accept Rules** - Boost confidence for matches matching pattern

### Exact Match Checker

**Location**: `src/api/matching/filtering/exact-match-checker.ts`

**Checks for**:

- Exact title match (after normalization)
- AniList ID match
- Format + year match (additional validation)

### Inclusion Rules

**Location**: `src/api/matching/filtering/inclusion-rules.ts`

**Thresholds for inclusion**:

- Minimum score (default: 50)
- Minimum common words (default: 2)
- Format must not be excluded (light novel, etc.)

## Normalization Pipeline

### Title Normalization

**Location**: `src/api/matching/normalization/title-normalizer.ts`

**Steps**:

1. **Lowercase** - "TITLE" → "title"
2. **Remove punctuation** - "Title!" → "Title"
3. **Normalize whitespace** - "title name" → "title name"
4. **Remove special chars** - "title™" → "title"
5. **Expand abbreviations** - "Dr." → "Doctor", "St." → "Saint"
6. **Remove common stopwords** - "the", "a", "an", etc.
7. **Handle roman numerals** - "Vol. 3" → standardized format
8. **Remove edition markers** - "Revised Edition" removed
9. **Phonetic matching** - Similar sounding terms normalized

**Caching**: Normalized results cached for performance

### Pattern Detection

**Location**: `src/api/matching/normalization/pattern-detection.ts`

**Detects**:

- Volume/chapter numbers
- Edition markers
- Collection identifiers
- Author attributions
- Remake/prequel/sequel markers
- Alternative/censored versions

**Purpose**: Remove/normalize these markers before scoring

### Character Utilities

**Location**: `src/api/matching/normalization/character-utils.ts`

**Handles**:

- Unicode normalization (NFD vs NFC)
- Japanese/Korean/Chinese character handling
- Romanization (Japanese → Roman characters)
- Ligature expansion ("ﬁ" → "fi")
- Diacritic removal ("café" → "cafe")

## Ranking System

### ranking.ts

**After scoring, entries are ranked**:

1. **Sort by score** (descending)
2. **Calculate confidence** (score → confidence level)
3. **Determine auto-match** (20-point lead check)
4. **Add ranking metadata**
   - Rank number
   - Confidence level
   - Auto-match flag

**Output**: Sorted `MangaMatch[]` with confidence metadata

## Batching & Optimization

### Categorization

**Before search**: Categorize manga into 3 groups

**`src/api/matching/batching/categorization.ts`**:

1. **Cached** - Already searched in last 30 minutes
   - Skip search, use cached results
   - Reduce API calls by 40%+

2. **Known IDs** - AniList IDs already determined
   - Fetch directly by ID (no search needed)
   - Fastest possible match (1 request per batch of 25)

3. **Uncached** - Need fresh search
   - Execute GraphQL search
   - Use batching to group searches

### Results Compilation

**`src/api/matching/batching/results.ts`**:

- Combine results from all 3 categories
- Sort by original order
- Merge with alternative sources if needed
- Return unified results

## Error Handling & Resilience

**Handled Errors**:

- API rate limits (429) → Retry with backoff
- Network timeouts → Partial results + retry option
- Malformed responses → Parse gracefully, log error
- Missing fields → Use defaults, continue

**Partial Results**: If some entries fail, system returns results for successful entries + retry info for failed ones

## Performance Metrics

**Typical Performance** (500 manga):

- Cache hit rate: 20-40% (previous imports/sessions)
- Known IDs: 5-15% (user frequently imported)
- Fresh searches: 45-75% (new titles)

**API Calls** (for 500 manga):

- Uncached: ~50 batch queries (25 manga per query)
- Known IDs: ~1-2 batch queries (25 IDs per query)
- Total: ~50-60 requests (vs 500 individual searches)

**Processing Time**:

- Scoring: ~100ms for 1000 candidates
- Filtering: ~50ms for 1000 candidates
- Ranking: ~20ms for 1000 candidates
- Total pipeline: ~170ms overhead

## Configuration

**Configurable Thresholds**:

```typescript
interface MatchEngineConfig {
  confidenceThreshold?: number; // Min score to include
  autoMatchThreshold?: number; // Min lead for auto-match
  prioritizeExactMatches?: boolean;
  useAlternativeTitles?: boolean;
  useSynonymMatching?: boolean;
  enableSourceFallback?: boolean;
  cacheSearchResults?: boolean;
}
```

**Stored in**: `MATCH_CONFIG` storage key

## Limitations

- Sequential search (not parallel due to rate limits)
- Limited to top results per source (usually 5-10)
- Scoring weights are fixed (not learnable/adaptive)
- No user feedback loop to improve matching
- Alternative source scoring not weighted equally
