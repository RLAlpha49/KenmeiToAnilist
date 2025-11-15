import type { AniListMediaEntry } from "./types";

function progressStepsForDelta(delta: number): number[] {
  if (delta === 1) return [1];
  if (delta > 1) return [1, 2];
  return [];
}

/**
 * Determine incremental sync steps for a given AniList media entry.
 * Returns an ordered array of steps (1, 2, 3) to execute for the entry.
 */
export function determineIncrementalSteps(entry: AniListMediaEntry): number[] {
  const prev = entry.previousValues;

  function metadataChangedForNewEntry(e: AniListMediaEntry): boolean {
    return !!(
      (e.status && e.status !== "PLANNING") ||
      (typeof e.score === "number" && e.score > 0) ||
      e.private !== undefined ||
      !!e.syncMetadata?.updatedPrivate
    );
  }

  function metadataChangedForExistingEntry(
    e: AniListMediaEntry,
    p: NonNullable<AniListMediaEntry["previousValues"]>,
  ): boolean {
    return (
      e.status !== p.status ||
      e.score !== p.score ||
      e.private !== p.private ||
      !!(
        e.syncMetadata?.updatedStatus ||
        e.syncMetadata?.updatedScore ||
        e.syncMetadata?.updatedPrivate
      )
    );
  }

  function determineStepsForNewEntry(e: AniListMediaEntry): number[] {
    const steps: number[] = [];
    const targetProgress = e.progress || 0;
    if (targetProgress > 1) steps.push(1, 2);
    else if (targetProgress === 1) steps.push(1);
    if (metadataChangedForNewEntry(e)) steps.push(3);
    if (steps.length === 0) steps.push(1);
    return steps;
  }

  function determineStepsForExistingEntry(
    e: AniListMediaEntry,
    p: NonNullable<AniListMediaEntry["previousValues"]>,
  ): number[] {
    const steps: number[] = [];
    const progressChanged = e.progress !== p.progress;
    const progressDelta = e.progress - p.progress;

    // Add progress-based steps first
    if (progressChanged) steps.push(...progressStepsForDelta(progressDelta));

    if (metadataChangedForExistingEntry(e, p)) {
      if (progressChanged) {
        const requiredProgressSteps = progressStepsForDelta(progressDelta);
        for (const s of requiredProgressSteps) {
          if (!steps.includes(s)) steps.push(s);
        }
        steps.push(3);
      } else {
        steps.push(3);
      }
    }

    return steps.length > 0 ? steps : [1];
  }

  return prev
    ? determineStepsForExistingEntry(entry, prev)
    : determineStepsForNewEntry(entry);
}

/**
 * Build GraphQL variables for a given incremental sync step using sync-service rules.
 * This helper centralizes mapping logic so workers and the sync service use a single source of truth.
 * @param entry - The AniList media entry.
 * @param step - Step number (1, 2, 3).
 * @returns Variables to be used in GraphQL mutation for the given step.
 */
export function buildVariablesForStep(
  entry: AniListMediaEntry,
  step: number,
): Record<string, unknown> {
  const prev = entry.previousValues;
  switch (step) {
    case 1:
      return buildStep1Variables(entry, prev);
    case 2:
      return buildStep2Variables(entry);
    case 3:
      return buildStep3Variables(entry, prev);
    default:
      return { mediaId: entry.mediaId };
  }
}

function buildStep1Variables(
  entry: AniListMediaEntry,
  prev?: AniListMediaEntry["previousValues"],
) {
  const previousProgress = prev?.progress ?? 0;
  return { mediaId: entry.mediaId, progress: previousProgress + 1 };
}

function buildStep2Variables(entry: AniListMediaEntry) {
  return { mediaId: entry.mediaId, progress: entry.progress };
}

function buildStep3Variables(
  entry: AniListMediaEntry,
  prev?: AniListMediaEntry["previousValues"],
) {
  const variables: Record<string, unknown> = { mediaId: entry.mediaId };
  if (!prev) {
    if (entry.status) variables.status = entry.status;
    if (typeof entry.score === "number" && entry.score > 0)
      variables.score = entry.score;
    if (entry.private !== undefined) variables.private = entry.private;
    return variables;
  }
  if (entry.status !== prev.status) variables.status = entry.status;
  if (
    typeof entry.score === "number" &&
    entry.score >= 0 &&
    entry.score !== prev.score
  ) {
    variables.score = entry.score;
  }
  if (
    (typeof entry.private === "boolean" && entry.private !== prev.private) ||
    entry.syncMetadata?.updatedPrivate
  ) {
    variables.private = entry.private;
  }
  return variables;
}
