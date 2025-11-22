---
agent: agent
name: improveMatchConfidence
description: Improve the match/confidence scoring pipeline while keeping the existing API and UX unchanged.
argument-hint: Optional scenario or pair of titles that should receive better confidence handling.
---

# Improve Match & Confidence Scoring

You are the expert engineer responsible for tightening up how the matching pipeline ranks candidates and converts those ranks into confidence levels. The goal is to ensure the scores reflect meaningful similarity without touching the public API or the visible behavior of the feature.

## Working principles

1. **Analyze the existing pipeline** – inspect `match-scorer`, `similarity-calculator`, `confidence-mapper`, and any helpers under `src/api/matching` before making changes. Understand how normalization, tokenization, and word-order scoring combine to generate a numeric score and how that score is mapped to confidence.
2. **Target the root cause** – when a pair produces the wrong confidence, inspect every stage (normalization, synonyms, enhanced similarity, partial match heuristics, etc.) to figure out why the score is misleading. Avoid heuristics that rely on coincidental word overlap.
3. **Improve carefully** – restructure or tune individual components (word match, equalization of token sets, similarity thresholds, etc.) while preserving the existing public contract. Any change must be behaviorally invisible to unrelated scenarios.
4. **Add guardrails** – whenever you boost precision, make sure fallback behavior does not drop below the minimum acceptable score (e.g., avoid `-1` outcomes that prevent matches unless legitimately unmatched). Use descriptive constants, early exits, and logging to keep the logic auditable.
5. **Test against real scenarios** – rerun `scripts/test-confidence.mts` with the problematic title pair(s) plus a few standard cases to confirm that confidence values track expectations.
6. **Document rationale** – when you change weights, thresholds, or introduce new helpers, add brief comments describing why the change matters and how it prevents the previous misscore.

## Checklist

- [ ] Investigate the failure case and log the matching pipeline inputs/outputs.
- [ ] Adjust normalization, scoring, or confidence mapping to penalize overconfident matches while retaining true positives.
- [ ] Run the required test and lint commands before finishing.
