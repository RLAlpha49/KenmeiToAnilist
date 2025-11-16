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
export function determineIncrementalSteps(
  mediaEntry: AniListMediaEntry,
): number[] {
  const previousValues = mediaEntry.previousValues;

  function metadataChangedForNewEntry(mediaEntry: AniListMediaEntry): boolean {
    return !!(
      (mediaEntry.status && mediaEntry.status !== "PLANNING") ||
      (typeof mediaEntry.score === "number" && mediaEntry.score > 0) ||
      mediaEntry.private !== undefined ||
      !!mediaEntry.syncMetadata?.updatedPrivate
    );
  }

  function metadataChangedForExistingEntry(
    mediaEntry: AniListMediaEntry,
    previousValues: NonNullable<AniListMediaEntry["previousValues"]>,
  ): boolean {
    return (
      mediaEntry.status !== previousValues.status ||
      mediaEntry.score !== previousValues.score ||
      mediaEntry.private !== previousValues.private ||
      !!(
        mediaEntry.syncMetadata?.updatedStatus ||
        mediaEntry.syncMetadata?.updatedScore ||
        mediaEntry.syncMetadata?.updatedPrivate
      )
    );
  }

  function determineStepsForNewEntry(mediaEntry: AniListMediaEntry): number[] {
    const steps: number[] = [];
    const targetProgress = mediaEntry.progress || 0;
    if (targetProgress > 1) steps.push(1, 2);
    else if (targetProgress === 1) steps.push(1);
    if (metadataChangedForNewEntry(mediaEntry)) steps.push(3);
    if (steps.length === 0) steps.push(1);
    return steps;
  }

  function determineStepsForExistingEntry(
    mediaEntry: AniListMediaEntry,
    previousValues: NonNullable<AniListMediaEntry["previousValues"]>,
  ): number[] {
    const steps: number[] = [];
    const progressChanged = mediaEntry.progress !== previousValues.progress;
    const progressDelta = mediaEntry.progress - previousValues.progress;

    // Add progress-based steps first
    if (progressChanged) steps.push(...progressStepsForDelta(progressDelta));

    if (metadataChangedForExistingEntry(mediaEntry, previousValues)) {
      if (progressChanged) {
        const requiredProgressSteps = progressStepsForDelta(progressDelta);
        for (const requiredStep of requiredProgressSteps) {
          if (!steps.includes(requiredStep)) steps.push(requiredStep);
        }
        steps.push(3);
      } else {
        steps.push(3);
      }
    }

    return steps.length > 0 ? steps : [1];
  }

  return previousValues
    ? determineStepsForExistingEntry(mediaEntry, previousValues)
    : determineStepsForNewEntry(mediaEntry);
}

/**
 * Build GraphQL variables for a given incremental sync step using sync-service rules.
 * This helper centralizes mapping logic so workers and the sync service use a single source of truth.
 * @param mediaEntry - The AniList media entry.
 * @param step - Step number (1, 2, 3).
 * @returns Variables to be used in GraphQL mutation for the given step.
 */
export function buildVariablesForStep(
  mediaEntry: AniListMediaEntry,
  step: number,
): Record<string, unknown> {
  const previousValues = mediaEntry.previousValues;
  switch (step) {
    case 1:
      return buildStep1Variables(mediaEntry, previousValues);
    case 2:
      return buildStep2Variables(mediaEntry);
    case 3:
      return buildStep3Variables(mediaEntry, previousValues);
    default:
      return { mediaId: mediaEntry.mediaId };
  }
}

function buildStep1Variables(
  mediaEntry: AniListMediaEntry,
  previousValues?: AniListMediaEntry["previousValues"],
) {
  const previousProgress = previousValues?.progress ?? 0;
  return { mediaId: mediaEntry.mediaId, progress: previousProgress + 1 };
}

function buildStep2Variables(mediaEntry: AniListMediaEntry) {
  return { mediaId: mediaEntry.mediaId, progress: mediaEntry.progress };
}

function buildStep3Variables(
  mediaEntry: AniListMediaEntry,
  previousValues?: AniListMediaEntry["previousValues"],
) {
  const mutationVariables: Record<string, unknown> = {
    mediaId: mediaEntry.mediaId,
  };
  if (!previousValues) {
    if (mediaEntry.status) mutationVariables.status = mediaEntry.status;
    if (typeof mediaEntry.score === "number" && mediaEntry.score > 0)
      mutationVariables.score = mediaEntry.score;
    if (mediaEntry.private !== undefined)
      mutationVariables.private = mediaEntry.private;
    return mutationVariables;
  }
  if (mediaEntry.status !== previousValues.status)
    mutationVariables.status = mediaEntry.status;
  if (
    typeof mediaEntry.score === "number" &&
    mediaEntry.score >= 0 &&
    mediaEntry.score !== previousValues.score
  ) {
    mutationVariables.score = mediaEntry.score;
  }
  if (
    (typeof mediaEntry.private === "boolean" &&
      mediaEntry.private !== previousValues.private) ||
    mediaEntry.syncMetadata?.updatedPrivate
  ) {
    mutationVariables.private = mediaEntry.private;
  }
  return mutationVariables;
}
