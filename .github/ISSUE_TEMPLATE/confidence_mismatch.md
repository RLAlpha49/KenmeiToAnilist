---
name: Confidence percentage mismatch
about: Report when a match's confidence score doesn't reflect the actual quality of the match
title: "Confidence mismatch: [manga title]"
labels: invalid
assignees: "RLAlpha49"
---

## Which manga had the mismatch?

Provide the title of the manga from your Kenmei library that had an unexpected confidence score.

## What was the confidence percentage?

What confidence score did the app assign to the match? [e.g., 85%]

## Was the match quality accurate?

- [ ] Too high - The match was poor but received high confidence
- [ ] Too low - The match was good but received low confidence
- [ ] Incorrect - The suggested match was wrong

## Expected confidence

What confidence percentage would have been more appropriate? [e.g., 45%]

## Details about the manga

Provide information that helps identify why the confidence was off:

- **Kenmei title**: [e.g., "Attack on Titan"]
- **Suggested AniList match**: [e.g., "Shingeki no Kyojin"]
- **Reason for mismatch**: [e.g., Alternate title/edition, similar series, ambiguous search results]

## Screenshots

If applicable, attach a screenshot of the matching panel showing the confidence badge and suggested match.

## Test Command (Optional, you may remove this section)

To help debug this issue faster, you can optionally include a test command that reproduces the confidence calculation locally. You should only include the command, you don't need to run it yourself and provide output.

**See [DEBUGGING_CONFIDENCE.md](https://github.com/RLAlpha49/KenmeiToAnilist/blob/master/docs/guides/DEBUGGING_CONFIDENCE.md) for:**

- How to enable the debug feature in Settings
- How to get the test command from the match card
- How to run the command and capture output

**Example command**:

```bash
npx tsx scripts/test-confidence.mts "Shingeki no Kyojin" "Attack on Titan" "Shingeki no Kyojin" "進撃の巨人" --synonyms="AoT,Titan"
```

_If you don't include this initially and maintainers need it to debug further, we'll ask you to provide it in a follow-up comment._

## Pattern or commonality (optional, you may remove this section)

Does this happen with:

- [ ] Manga with similar titles
- [ ] Alternate editions or translations
- [ ] Multiple adaptations of the same source material
- [ ] Specific genres or types of manga
- [ ] Other (describe below)

## Additional context

Any other details that might help improve the matching algorithm for this case.
