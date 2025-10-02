import React from "react";
import { Search, Check, X, ArrowLeft } from "lucide-react";
import { MangaMatchResult } from "../../../api/anilist/types";
import { KenmeiManga } from "../../../api/kenmei/types";
import { Button } from "../../ui/button";

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
}: Readonly<MatchActionsProps>) {
  // keep onSelectAlternative referenced to preserve API and avoid unused prop linting
  if (onSelectAlternative) {
    /* no-op to satisfy linter */
  }
  const buttonBaseClass =
    "relative overflow-hidden rounded-xl px-4 py-2 text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2";

  const commonSearchButton = (text: string, ariaLabel: string) => (
    <Button
      className={`${buttonBaseClass} bg-gradient-to-r from-indigo-500 via-indigo-400 to-sky-400 text-white shadow-[0_10px_30px_-12px_rgba(79,70,229,0.65)] hover:shadow-[0_18px_40px_-15px_rgba(14,165,233,0.55)] focus-visible:ring-indigo-400/70 dark:from-indigo-500 dark:via-indigo-400 dark:to-sky-500`}
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
    </Button>
  );

  const resetButton = (
    <Button
      variant="secondary"
      className={`${buttonBaseClass} bg-slate-200/80 text-slate-800 shadow-[0_8px_28px_-15px_rgba(15,23,42,0.45)] hover:bg-slate-200 focus-visible:ring-slate-400 dark:bg-slate-800/70 dark:text-slate-200 dark:hover:bg-slate-800`}
      onClick={() => {
        if (onResetToPending) onResetToPending(match);
      }}
      onKeyDown={(e) => handleKeyDown(e, () => onResetToPending?.(match))}
      aria-label={`Reset ${match.kenmeiManga.title} to pending status`}
    >
      <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
      Reset to Pending
    </Button>
  );

  switch (match.status) {
    case "pending":
      return (
        <>
          {match.anilistMatches && match.anilistMatches.length > 0 && (
            <Button
              className={`${buttonBaseClass} bg-gradient-to-r from-emerald-500 via-emerald-400 to-lime-400 text-white shadow-[0_12px_32px_-15px_rgba(16,185,129,0.6)] hover:shadow-[0_20px_45px_-18px_rgba(101,163,13,0.55)] focus-visible:ring-emerald-400/80 dark:from-emerald-500 dark:via-emerald-400 dark:to-lime-500`}
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
            </Button>
          )}

          {commonSearchButton(
            "Search Manually",
            `Search manually for ${match.kenmeiManga.title}`,
          )}

          <Button
            className={`${buttonBaseClass} bg-slate-100/80 text-slate-700 shadow-[0_8px_28px_-15px_rgba(30,41,59,0.45)] hover:bg-slate-100 focus-visible:ring-slate-300 dark:bg-slate-800/60 dark:text-slate-200 dark:hover:bg-slate-800`}
            onClick={() => {
              if (onRejectMatch) onRejectMatch(match);
            }}
            onKeyDown={(e) => handleKeyDown(e, () => onRejectMatch?.(match))}
            aria-label={`Skip matching for ${match.kenmeiManga.title}`}
          >
            <X className="mr-2 h-4 w-4" aria-hidden="true" />
            Skip
          </Button>
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
