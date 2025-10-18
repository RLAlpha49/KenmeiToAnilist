# Confidence Percentage Test Utility

A CLI tool to directly test the confidence percentage calculations for manga matching without running the full Electron app.

## Usage

### Basic Usage

```bash
# Test an exact match
npx tsx scripts/test-confidence.mts "Death Note" "Death Note"

# Test against different titles
npx tsx scripts/test-confidence.mts "Search Title" "Candidate Title"

# Test with Romaji (optional third parameter)
npx tsx scripts/test-confidence.mts "Attack on Titan" "進撃の巨人" "Shingeki no Kyojin"

# Test with Native title (optional fourth parameter)
npx tsx scripts/test-confidence.mts "Attack on Titan" "Attack on Titan" "進撃の巨人" "進撃の巨人"
```

### With Synonyms

Define synonyms that the candidate manga should match against:

```bash
# Test with a single synonym
npx tsx scripts/test-confidence.mts "Attack on Titan" "Shingeki no Kyojin" --synonyms="AoT"

# Test with multiple synonyms
npx tsx scripts/test-confidence.mts "Attack on Titan" "Shingeki no Kyojin" --synonyms="AoT,Attack on Titans"

# Test with romaji, native, and synonyms
npx tsx scripts/test-confidence.mts "Attack on Titan" "進撃の巨人" "Shingeki no Kyojin" "進撃の巨人" --synonyms="AoT,Attack on Titans"
```

### With JSON Output

For programmatic usage or piping to other tools:

```bash
npx tsx scripts/test-confidence.mts "Death Note" "Death Note" --json

# JSON with synonyms and native title
npx tsx scripts/test-confidence.mts "Attack on Titan" "進撃の巨人" "Shingeki no Kyojin" "進撃の巨人" --synonyms="AoT" --json
```

### Help

```bash
npx tsx scripts/test-confidence.mts --help
```

## Output Examples

### Human-Readable Output

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

## How It Works

The utility:

1. **Takes titles as input** - Search title, candidate title, optional candidate Romaji, optional candidate Native
2. **Accepts synonyms** - Optional comma-separated synonyms for the candidate manga
3. **Creates mock manga** - Builds a minimal AniListManga object with your provided data
4. **Calculates match score** using `calculateMatchScore()` from `src/api/matching/scoring/match-scorer.ts`
5. **Maps score to confidence** using `calculateConfidence()` from `src/utils/matchingConfidence.ts` which now includes native title matching
6. **Outputs results** in your chosen format (human-readable or JSON)

## Workflow: Testing Confidence Improvements

### Step 1: Identify Problem Cases

When users report confidence mismatches via the GitHub issue template, collect examples:

- "Death Note: 35% (should be 95%)"
- "One Piece Blu-ray Edition: 45% (should be 85%)"

### Step 2: Test Current Behavior

```bash
npx tsx scripts/test-confidence.mts "Death Note" "Death Note"
# Output shows why it's 35%
```

### Step 3: Improve Algorithm

Edit the relevant scoring logic in:

- `src/api/matching/scoring/match-scorer.ts` - Match score calculation
- `src/api/matching/scoring/similarity-calculator.ts` - String similarity
- `src/utils/matchingConfidence.ts` - Score to confidence mapping

### Step 4: Test Changes

```bash
npx tsx scripts/test-confidence.mts "Death Note" "Death Note"
# Check if confidence improved
```

### Step 5: Regression Test

Test other cases to ensure you didn't break anything:

```bash
# Test with different titles (no synonyms)
npx tsx scripts/test-confidence.mts "One Piece" "Bleach"

# Test with synonyms
npx tsx scripts/test-confidence.mts "Attack on Titan" "進撃の巨人" "Shingeki no Kyojin" --synonyms="AoT"

# Test with native title
npx tsx scripts/test-confidence.mts "Attack on Titan" "Attack on Titan" "進撃の巨人" "進撃の巨人" --synonyms="AoT"
```

## Creating Test Cases

You can define custom test cases based on user reports. Always specify synonyms that should help with matching:

```bash
# Create a test suite with synonyms and native titles
cat << EOF > test-cases.json
[
  { "search": "Death Note", "candidate": "Death Note", "romaji": "", "native": "", "synonyms": "" },
  { "search": "One Piece", "candidate": "One Piece", "romaji": "", "native": "", "synonyms": "" },
  { "search": "Shingeki no Kyojin", "candidate": "Attack on Titan", "romaji": "Shingeki no Kyojin", "native": "進撃の巨人", "synonyms": "AoT,Attack on Titans" }
]
EOF

# Run each test (example using jq)
jq -r '.[] | "\(.search) | \(.candidate) | \(.romaji) | \(.native) | \(.synonyms)"' test-cases.json | while read line; do
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
