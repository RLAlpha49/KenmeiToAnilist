import React from "react";
import { Search, Check, X, ArrowLeft } from "lucide-react";
import { MangaMatchResult } from "../../../api/anilist/types";
import { KenmeiManga } from "../../../api/kenmei/types";

export interface MatchActionsProps {
  match: MangaMatchResult;
  onManualSearch?: (kenmeiManga: KenmeiManga) => void;
  onAcceptMatch?: (match: MangaMatchResult) => void;
  onRejectMatch?: (match: MangaMatchResult) => void;
  onResetToPending?: (match: MangaMatchResult) => void;
  onSelectAlternative?: (
    match: MangaMatchResult,
    alternativeIndex: number,
    autoAccept?: boolean,
    directAccept?: boolean,
  ) => void;
  handleKeyDown: (e: React.KeyboardEvent, cb: () => void) => void;
}

export function MatchActions({
  match,
  onManualSearch,
  onAcceptMatch,
  onRejectMatch,
  onResetToPending,
  onSelectAlternative,
  handleKeyDown,
}: MatchActionsProps) {
  // keep onSelectAlternative referenced to preserve API and avoid unused prop linting
  if (onSelectAlternative) {
    /* no-op to satisfy linter */
  }
  const commonSearchButton = (text: string, ariaLabel: string) => (
    <button
      className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none"
      onClick={() => {
        if (match.status === "pending") {
          console.log(
            `Clicked Search Manually for manga ID: ${match.kenmeiManga.id}, title: ${match.kenmeiManga.title}`,
          );
        }
        if (onManualSearch) onManualSearch(match.kenmeiManga);
      }}
      onKeyDown={(e) =>
        handleKeyDown(e, () => onManualSearch?.(match.kenmeiManga))
      }
      aria-label={ariaLabel}
    >
      <Search className="mr-2 h-4 w-4" aria-hidden="true" />
      {text}
    </button>
  );

  const resetButton = (
    <button
      className="inline-flex items-center rounded-md bg-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-300 focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 focus:outline-none dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
      onClick={() => {
        if (onResetToPending) onResetToPending(match);
      }}
      onKeyDown={(e) => handleKeyDown(e, () => onResetToPending?.(match))}
      aria-label={`Reset ${match.kenmeiManga.title} to pending status`}
    >
      <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
      Reset to Pending
    </button>
  );

  switch (match.status) {
    case "pending":
      return (
        <>
          {match.anilistMatches && match.anilistMatches.length > 0 && (
            <button
              className="inline-flex items-center rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 focus:ring-2 focus:ring-green-500 focus:ring-offset-2 focus:outline-none"
              onClick={() => {
                console.log(
                  `Clicked Accept Match for manga ID: ${match.kenmeiManga.id}, title: ${match.kenmeiManga.title}`,
                );
                if (onAcceptMatch) onAcceptMatch(match);
              }}
              onKeyDown={(e) => handleKeyDown(e, () => onAcceptMatch?.(match))}
              aria-label={`Accept match for ${match.kenmeiManga.title}`}
            >
              <Check className="mr-2 h-4 w-4" aria-hidden="true" />
              Accept Match
            </button>
          )}

          {commonSearchButton(
            "Search Manually",
            `Search manually for ${match.kenmeiManga.title}`,
          )}

          <button
            className="inline-flex items-center rounded-md bg-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-300 focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 focus:outline-none dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
            onClick={() => {
              if (onRejectMatch) onRejectMatch(match);
            }}
            onKeyDown={(e) => handleKeyDown(e, () => onRejectMatch?.(match))}
            aria-label={`Skip matching for ${match.kenmeiManga.title}`}
          >
            <X className="mr-2 h-4 w-4" aria-hidden="true" />
            Skip
          </button>
        </>
      );

    case "matched":
    case "manual":
      return (
        <>
          {commonSearchButton(
            "Change Match",
            `Change match for ${match.kenmeiManga.title}`,
          )}
          {resetButton}
        </>
      );

    case "skipped":
      return (
        <>
          {commonSearchButton(
            "Search Manually",
            `Find match for ${match.kenmeiManga.title}`,
          )}
          {resetButton}
        </>
      );

    default:
      return null;
  }
}

export default MatchActions;
