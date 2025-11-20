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

The CLI also understands a JSON-formatted `--synonyms` value, which is useful when synonyms include commas or other punctuation. You can pass the array directly as shown by the auto-generated command from the app, for example:

```bash
npx tsx scripts/test-confidence.mts "Title" "Candidate" --synonyms='["Synonym, With, Commas","Another Synonym"]'
```

If you copy the test command from the UI, it safely wraps every argument in single quotes and escapes embedded quotes, so you can paste it verbatim into your shell without additional escaping.

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
5. **Maps score to confidence** using `calculateConfidence()` from `src/api/matching/scoring/confidence-mapper.ts`. The confidence calculation lives alongside match scoring under `src/api/matching/scoring/`, so changes to mapping logic are kept close to the scorer implementation.
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
- `src/api/matching/scoring/confidence-mapper.ts` - Score to confidence mapping

### Step 4: Test Changes

```bash
npx tsx scripts/test-confidence.mts "Death Note" "Death Note"
# Check if confidence improved
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

## Comparison Mode

Comparison mode lets you run the same scoring logic against a previously saved baseline file so you can spot regressions or unexpected improvements. Baselines are stored as timestamped JSON in `scripts/.baselines/` (relative to the repo root), and each file captures the search and candidate titles, synonyms, match score, confidence, and the app version that produced the result. Run comparison mode with `--compare` to compare the current result set against the latest baseline (or use `--baseline-file=...` to point to a specific file.)

Comparison mode calculates deltas for both the confidence percentage and the match score, classifies each comparison as `improved`, `regressed`, or `unchanged`, and annotates the output with visual indicators (`↑/↓/=/✓/✗`) so you can grasp the impact quickly. Use `--threshold=<number>` to tune the sensitivity (expressed as a percentage for confidence; the match-score threshold tracks at least `0.05`).

## Baseline Management

Running `npx tsx scripts/test-confidence.mts "Search" "Candidate" --save-baseline` captures the current result as a new baseline. Each baseline file resides in `scripts/.baselines/` and uses the pattern `confidence-baseline-{timestamp}.json`. The exported JSON contains top-level metadata (`savedAt`, `appVersion`, and the arguments that produced the result) and a `testCases` array with one or more entries. Each entry records the search/candidate titles, optional romaji/native values, synonyms array, match score, confidence, confidence level, and the timestamp of when the baseline was created.

When you need to experiment with multiple cases at once, you can manually combine the JSON files by concatenating `testCases` entries or run the CLI repeatedly with `--save-baseline` and then copy the relevant entries into a single file for batch comparison.

## Running Comparisons

Use `--compare` to execute comparison mode. Without additional flags, the script uses the most recent baseline from `scripts/.baselines/`. Pass `--baseline-file=<path>` to compare against a specific snapshot (the path may be relative to the repo root or absolute). Use `--threshold=<number>` to adjust sensitivity; the value represents the minimum confidence delta (in percentage points) required to mark a change as significant. The script also tracks a match-score threshold (at least `0.05` on the 0-1 scale) to catch smaller shifts in the normalized match score.

When the comparison completes, the CLI prints a summary table plus human-readable details by default. Add `--json` to stream the structured comparison report, or combine `--compare` with `--export=<json|csv|markdown>` to persist the comparison for later review.

## Understanding Comparison Results

Each comparison entry contains:

- **Status** (`improved`, `regressed`, `unchanged`) based on configured thresholds for confidence and match score.
- **Indicator** (`↑` for improvement, `↓` for regression, `=` for no change, `✓` for maintained high confidence, `✗` for maintained low confidence).
- **Confidence Delta** (current minus baseline, in percentage points).
- **Match Score Delta** (current minus baseline, on the 0-1 scale).
- **Baseline and current confidence levels** (e.g. "Near-perfect match").

The comparison metadata also reports the timestamp of the baseline, current and baseline app versions, total test cases, and the number of improved/regressed/unchanged entries so you can track the overall trend.

## Exporting Comparison Results

Use `--export=json`, `--export=csv`, or `--export=markdown` to write the report to `scripts/.baselines/exports/comparison-report-{timestamp}.{ext}`. Each export includes:

- Metadata about the comparison (`comparedAt`, baseline timestamp, app versions, thresholds, export timestamp).
- Every comparison result with search/title, baseline/current confidence, deltas, status, and visual indicator.

CSV exports prepend metadata lines (prefixed with `#`) followed by a header row and one row per test case. Markdown exports include a bullet list of metadata followed by a tidy table, while JSON exports embed both the comparison and export metadata for programmatic consumption.

## Use Cases and Workflows

- **Algorithm regression testing** – Save a baseline before touching the scoring logic, then run `--compare` after your change to verify no regressions slip through.
- **Performance tracking** – Compare results across releases by keeping a dated baseline for each build and using the built-in metadata to track the app versions in the comparison report.
- **A/B experimentation** – Create baselines for different scoring tweaks and compare the current branch against each to see which approach moves the needle more.
- **Quality assurance** – Send the exported comparisons to stakeholders or automation suites to ensure confidence calculations stay stable over time.

## Examples

- Save a baseline for the current algorithm:

  ```bash
  npx tsx scripts/test-confidence.mts "Death Note" "Death Note" --save-baseline
  ```

- Run a comparison against the latest baseline:

  ```bash
  npx tsx scripts/test-confidence.mts --compare
  ```

- Compare against a specific baseline file:

  ```bash
  npx tsx scripts/test-confidence.mts --compare --baseline-file=scripts/.baselines/confidence-baseline-2025-10-01T12-00-00-000Z.json
  ```

- Export comparison results to CSV for further analysis:

  ```bash
  npx tsx scripts/test-confidence.mts --compare --export=csv
  ```

- Batch comparison with a tighter threshold:

  ```bash
  npx tsx scripts/test-confidence.mts --compare --threshold=3 --export=markdown
  ```

## Troubleshooting

- **Missing baseline file** – The CLI will prompt you to create a baseline if none exist. Run with `--save-baseline` first and rerun with `--compare`.
- **Corrupted baseline** – Delete the offending file (they reside in `scripts/.baselines/`) and regenerate it with the same test case.
- **App version mismatch** – Comparison reports include both the baseline app version and the current app version; ensure you rebaseline whenever the calibration logic changes significantly.
- **Resetting baselines** – Remove the contents of `scripts/.baselines/` (or delete the individual JSON files) to start with a fresh set of snapshots.

- **Exit codes** – The CLI uses explicit exit codes so automation can differentiate the cause:
  - `0` – Success
  - `1` – Validation / CLI misuse (e.g. missing required arguments)
  - `2` – Runtime scoring errors or unexpected exceptions
  - `3` – Filesystem or baseline errors (missing compiled dist/, missing baseline path, etc.)
