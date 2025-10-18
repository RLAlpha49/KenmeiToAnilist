# Debugging Confidence Calculations

This guide explains how to use the confidence test exporter feature to debug and report issues with confidence scores in the Kenmei → AniList matching algorithm.

## Quick Start

### 1. Enable the Feature

1. Open the Kenmei → AniList app
2. Go to **Settings**
3. Select the **Debug** tab
4. Toggle **Debug menu** to enable
5. Toggle **Confidence Test Exporter** to enable

You'll now see debug buttons on each match card in the matching panel.

### 2. Get the Test Command

1. Go to the **Matching** section of the app
2. Find the match card with an unexpected confidence score
3. Look for the **Show** and **Copy** buttons next to the confidence badge
4. Click **Copy** to copy the command to your clipboard, or **Show** to display it

The command will look like:

```bash
npx tsx scripts/test-confidence.mts "Attack on Titan" "Shingeki no Kyojin" --synonyms="AoT,Titan"
```

### 3. Run the Command

1. Open a terminal (PowerShell, bash, etc.)
2. Navigate to the project directory
3. Paste and run the command:

```bash
npx tsx scripts/test-confidence.mts "Attack on Titan" "Shingeki no Kyojin" --synonyms="AoT,Titan"
```

### 4. Capture the Output

The command will output the confidence calculation details, including:

- **Search similarity score** - How similar the search term is to candidates
- **Title match score** - Matching the candidate's English and Romaji titles
- **Final confidence** - The calculated percentage (0-100)
- **Breakdown** - How the algorithm weighted different factors

## Under the Hood

The test command calls the same scoring functions that the app uses:

- `calculateMatchScore()` - Computes similarity between titles
- `calculateConfidence()` - Converts the score to a 0-100 percentage
- Considers English titles, Romaji, and synonyms

This means the test command output exactly reflects how the app calculated the confidence.

## Next Steps

- If you found a bug, report it with the test command
- If you want to improve the algorithm, the test command helps verify any changes
- Review the matching algorithm in `src/api/matching/scoring/` for implementation details
