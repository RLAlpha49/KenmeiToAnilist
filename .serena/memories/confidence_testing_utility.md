# Confidence Testing Utility

## Overview

CLI tool to directly test manga matching confidence calculations without running the full Electron app. Located in `scripts/test-confidence.mts`.

## Command Syntax

```bash
npx tsx scripts/test-confidence.mts <search-title> <candidate-title> [romaji] [native] [--synonyms="..."] [--json]
```

### Parameters

- `<search-title>` - The title being searched for
- `<candidate-title>` - The AniList candidate title
- `[romaji]` - Optional: Romanized version of candidate
- `[native]` - Optional: Native language version of candidate (e.g., Japanese)
- `--synonyms="..."` - Optional: Comma-separated alternative titles
- `--json` - Optional: Output as JSON instead of human-readable

## Usage Examples

### Basic Tests

```bash
# Exact match
npx tsx scripts/test-confidence.mts "Death Note" "Death Note"

# Different titles
npx tsx scripts/test-confidence.mts "Search Title" "Candidate Title"

# With romaji
npx tsx scripts/test-confidence.mts "Attack on Titan" "進撃の巨人" "Shingeki no Kyojin"

# With native title
npx tsx scripts/test-confidence.mts "Attack on Titan" "Attack on Titan" "進撃の巨人" "進撃の巨人"
```

### With Synonyms

```bash
# Single synonym
npx tsx scripts/test-confidence.mts "Attack on Titan" "Shingeki no Kyojin" --synonyms="AoT"

# Multiple synonyms (comma-separated)
npx tsx scripts/test-confidence.mts "Attack on Titan" "Shingeki no Kyojin" --synonyms="AoT,Attack on Titans,SnK"

# Full example: romaji, native, multiple synonyms
npx tsx scripts/test-confidence.mts "Attack on Titan" "進撃の巨人" "Shingeki no Kyojin" "進撃の巨人" --synonyms="AoT,Attack on Titans"
```

### JSON Output

```bash
# For piping to other tools
npx tsx scripts/test-confidence.mts "Death Note" "Death Note" --json

# Full example with JSON
npx tsx scripts/test-confidence.mts "Attack on Titan" "進撃の巨人" "Shingeki no Kyojin" "進撃の巨人" --synonyms="AoT" --json
```

## Output Examples

### Human-Readable

```text
╔════════════════════════════════════════════════════════════╗
║          CONFIDENCE CALCULATION TEST RESULTS               ║
╚════════════════════════════════════════════════════════════╝

Search Title:        Shingeki no Kyojin
Candidate Title:     Attack on Titan
Candidate Romaji:    Shingeki no Kyojin
Candidate Native:    進撃の巨人

────────────────────────────────────────────────────────────
Match Score:         1.0000 (0-1 scale)
Confidence:          99% (0-100 scale)
Confidence Level:    Near-perfect match
────────────────────────────────────────────────────────────

Confidence Brackets:
  90+%: Near-perfect match (actual: ✓)
  80-89%: Strong match (actual: ✗)
  65-79%: Good match (actual: ✗)
  50-64%: Reasonable match (actual: ✗)
  30-49%: Weak match (actual: ✗)
  15-29%: Very weak match (actual: ✗)
  1-14%: Extremely weak match (actual: ✗)
```

### JSON Output

```json
{
  "searchTitle": "Shingeki no Kyojin",
  "candidateTitle": "Attack on Titan",
  "candidateRomaji": "Shingeki no Kyojin",
  "candidateNative": "進撃の巨人",
  "matchScore": 1,
  "confidence": 99,
  "confidenceLevel": "Near-perfect match"
}
```

## Confidence Brackets

- **90+%** - Near-perfect match
- **80-89%** - Strong match
- **65-79%** - Good match
- **50-64%** - Reasonable match
- **30-49%** - Weak match
- **15-29%** - Very weak match
- **1-14%** - Extremely weak match

## Implementation Details

The utility:

1. Takes titles as CLI input
2. Creates minimal mock AniListManga object
3. Calls `calculateMatchScore()` from `src/api/matching/scoring/match-scorer.ts`
4. Maps score to confidence using `calculateConfidence()` from `src/utils/matchingConfidence.ts`
5. Outputs results (human-readable or JSON)

## Workflow: Testing Confidence Improvements

### 1. Identify Problem Cases (from user reports)

Example GitHub issues:

- "Death Note: 35% (should be 95%)"
- "One Piece Blu-ray Edition: 45% (should be 85%)"

### 2. Test Current Behavior

```bash
npx tsx scripts/test-confidence.mts "Death Note" "Death Note"
```

Check why confidence is lower than expected.

### 3. Improve Algorithm

Edit relevant scoring logic:

- `src/api/matching/scoring/match-scorer.ts` - Match score calculation
- `src/api/matching/scoring/similarity-calculator.ts` - String similarity
- `src/utils/matchingConfidence.ts` - Score to confidence mapping

### 4. Test Changes

```bash
npx tsx scripts/test-confidence.mts "Death Note" "Death Note"
```

Verify confidence improved.

### 5. Regression Test

Test other cases to avoid breaking existing matches:

```bash
# Different titles
npx tsx scripts/test-confidence.mts "One Piece" "Bleach"

# With synonyms
npx tsx scripts/test-confidence.mts "Attack on Titan" "進撃の巨人" "Shingeki no Kyojin" --synonyms="AoT"

# With native title
npx tsx scripts/test-confidence.mts "Attack on Titan" "Attack on Titan" "進撃の巨人" "進撃の巨人"
```

## Batch Testing

Create test suite from file:

```bash
cat << 'EOF' > test-cases.json
[
  { "search": "Death Note", "candidate": "Death Note", "romaji": "", "native": "", "synonyms": "" },
  { "search": "One Piece", "candidate": "One Piece", "romaji": "", "native": "", "synonyms": "" },
  { "search": "Shingeki no Kyojin", "candidate": "Attack on Titan", "romaji": "Shingeki no Kyojin", "native": "進撃の巨人", "synonyms": "AoT,Attack on Titans" }
]
EOF

# Run each with jq
jq -r '.[] | "\(.search)|\(.candidate)|\(.romaji)|\(.native)|\(.synonyms)"' test-cases.json | while read line; do
  IFS='|' read -r search candidate romaji native synonyms <<< "$line"
  search=$(echo "$search" | xargs)
  candidate=$(echo "$candidate" | xargs)
  romaji=$(echo "$romaji" | xargs)
  native=$(echo "$native" | xargs)
  synonyms=$(echo "$synonyms" | xargs)

  if [ -z "$synonyms" ]; then
    npx tsx scripts/test-confidence.mts "$search" "$candidate" "$romaji" "$native" --json
  else
    npx tsx scripts/test-confidence.mts "$search" "$candidate" "$romaji" "$native" --synonyms="$synonyms" --json
  fi
done
```

## Key Features

- ✅ Direct testing without running full app
- ✅ Supports multiple title formats (English, Romaji, Native)
- ✅ Synonym support for alternative titles
- ✅ Confidence bracket display
- ✅ JSON output for automation
- ✅ Quick iteration on scoring algorithm improvements
- ✅ Regression testing before deployment

## Files Involved

- `scripts/test-confidence.mts` - CLI tool
- `src/api/matching/scoring/match-scorer.ts` - Score calculation
- `src/api/matching/scoring/similarity-calculator.ts` - String similarity
- `src/utils/matchingConfidence.ts` - Score to confidence mapping
