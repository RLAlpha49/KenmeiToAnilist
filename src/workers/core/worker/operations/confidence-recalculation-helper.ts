import type { MangaMatchResult } from "@/api/anilist/types";
import type { MatchEngineConfig } from "@/api/matching/match-engine";
import { calculateConfidence } from "@/api/matching/scoring";

export interface ConfidenceRecalculationMatchContext {
  index: number;
  total: number;
  match: MangaMatchResult;
  updatedMatch: MangaMatchResult;
}

export interface ConfidenceRecalculationLoopOptions {
  /** Callback invoked after each match is recalculated. */
  onMatchProcessed?: (
    context: ConfidenceRecalculationMatchContext,
  ) => void | Promise<void>;
  /** Return false to abort before processing the next match. */
  shouldContinue?: () => boolean;
  /** How frequently to yield back to the event loop (default: 50). */
  yieldEvery?: number;
  /** Optional prefix inserted before error logging. */
  logPrefix?: string;
  /** Logger used when recalculation fails for a candidate. */
  logger?: (message: string, error: unknown) => void;
}

export interface ConfidenceRecalculationLoopResult {
  results: MangaMatchResult[];
  processed: number;
  cancelled: boolean;
}

const DEFAULT_YIELD_FREQUENCY = 50;
const DEFAULT_LOGGER = console.error;

const ERROR_DETAIL_LIMIT = 3;
const ERROR_SUMMARY_INTERVAL = 50;

function recordFailure(
  failureCounters: Map<string, { count: number }>,
  candidateId: number,
  message: string,
): {
  shouldLogDetail: boolean;
  shouldLogSummary: boolean;
  suppressionCount: number;
} {
  const key = `${candidateId}:${message}`;
  const existing = failureCounters.get(key);
  const nextCount = (existing?.count ?? 0) + 1;
  failureCounters.set(key, { count: nextCount });

  const shouldLogDetail = nextCount <= ERROR_DETAIL_LIMIT;
  const shouldLogSummary =
    nextCount > ERROR_DETAIL_LIMIT && nextCount % ERROR_SUMMARY_INTERVAL === 0;

  return {
    shouldLogDetail,
    shouldLogSummary,
    suppressionCount: Math.max(0, nextCount - ERROR_DETAIL_LIMIT),
  };
}

export async function recalculateConfidenceForMatches(
  matches: MangaMatchResult[],
  _config: Partial<MatchEngineConfig>,
  options: ConfidenceRecalculationLoopOptions = {},
): Promise<ConfidenceRecalculationLoopResult> {
  const total = matches.length;
  const {
    onMatchProcessed,
    shouldContinue,
    yieldEvery = DEFAULT_YIELD_FREQUENCY,
    logPrefix,
    logger = DEFAULT_LOGGER,
  } = options;

  const updatedResults: MangaMatchResult[] = [];
  const prefix = logPrefix ? `${logPrefix} ` : "";
  const failureCounters = new Map<string, { count: number }>();

  for (let index = 0; index < total; index += 1) {
    if (shouldContinue && !shouldContinue()) {
      return {
        results: updatedResults,
        processed: index,
        cancelled: true,
      };
    }

    const match = matches[index];
    let updatedMatch: MangaMatchResult = match;

    if (match.anilistMatches?.length) {
      const recalculatedMatches = match.anilistMatches.map((candidate) => {
        let nextConfidence = candidate.confidence;
        try {
          nextConfidence = calculateConfidence(
            match.kenmeiManga.title,
            candidate.manga,
          );
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          const { shouldLogDetail, shouldLogSummary, suppressionCount } =
            recordFailure(failureCounters, candidate.manga.id, errorMessage);

          if (shouldLogDetail) {
            logger(
              `${prefix}Failed to recalculate confidence for AniList ID ${candidate.manga.id}:`,
              error,
            );
          } else if (shouldLogSummary) {
            logger(
              `${prefix}Suppressed ${suppressionCount} repeated failures for AniList ID ${candidate.manga.id}.`,
              error,
            );
          }
        }

        return {
          ...candidate,
          confidence: nextConfidence,
        };
      });

      updatedMatch = {
        ...match,
        anilistMatches: recalculatedMatches,
      };
    }

    if (!updatedMatch.anilistMatches?.length && match.selectedMatch) {
      const selectedConfidence = calculateConfidence(
        match.kenmeiManga.title,
        match.selectedMatch,
      );

      updatedMatch = {
        ...updatedMatch,
        anilistMatches: [
          {
            manga: match.selectedMatch,
            confidence: selectedConfidence,
          },
        ],
      };
    }

    updatedResults.push(updatedMatch);

    if (onMatchProcessed) {
      await onMatchProcessed({
        index,
        total,
        match,
        updatedMatch,
      });
    }

    if (yieldEvery > 0 && (index + 1) % yieldEvery === 0) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }

  return {
    results: updatedResults,
    processed: total,
    cancelled: false,
  };
}
