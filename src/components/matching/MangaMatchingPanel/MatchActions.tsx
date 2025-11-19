import React from "react";
import { Search, Check, X, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { MangaMatchResult } from "../../../api/anilist/types";
import { KenmeiManga } from "../../../api/kenmei/types";
import { Button } from "../../ui/Button";

/**
 * Props for the MatchActions component.
 *
 * @property match - The manga match result to display actions for.
 * @property onManualSearch - Callback to trigger manual search for the manga.
 * @property onAcceptMatch - Callback to accept the match.
 * @property onRejectMatch - Callback to reject the match.
 * @property onResetToPending - Callback to reset match to pending status.
 * @property onSelectAlternative - Callback to select an alternative match.
 * @property handleKeyDown - Handler for keyboard shortcuts on action buttons.
 * @property isLoading - Optional flag to disable buttons while operation is in progress.
 * @source
 */
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
  isLoading?: boolean;
}

/**
 * Renders action buttons for a manga match based on its current status.
 *
 * Displays different button combinations for pending, matched, manual, and skipped statuses.
 * Button styling and behavior adapts to match state and available actions.
 *
 * @param props - Component props including match state and callbacks.
 * @returns Rendered action buttons appropriate for the match status.
 * @source
 */
function MatchActionsComponent({
  match,
  onManualSearch,
  onAcceptMatch,
  onRejectMatch,
  onResetToPending,
  onSelectAlternative,
  handleKeyDown,
  isLoading = false,
}: Readonly<MatchActionsProps>) {
  // Keep onSelectAlternative referenced to preserve API and avoid unused prop warnings
  if (onSelectAlternative) {
    /* no-op to satisfy linter */
  }
  // Base styling classes for all action buttons
  const buttonBaseClass =
    "relative overflow-hidden rounded-xl px-4 py-2 text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2";

  /** Renders the shared manual search button used across match statuses. */
  const renderCommonSearchButton = (text: string, ariaLabel: string) => (
    <Button
      className={`${buttonBaseClass} bg-linear-to-r from-indigo-500 via-indigo-400 to-sky-400 text-white shadow-[0_10px_30px_-12px_rgba(79,70,229,0.65)] hover:shadow-[0_18px_40px_-15px_rgba(14,165,233,0.55)] focus-visible:ring-indigo-400/70 disabled:cursor-not-allowed disabled:opacity-60 disabled:shadow-none dark:from-indigo-500 dark:via-indigo-400 dark:to-sky-500`}
      onClick={() => {
        if (match.status === "pending") {
          console.debug(
            `[MatchActions] Clicked Search Manually for manga ID: ${match.kenmeiManga.id}, title: ${match.kenmeiManga.title}`,
          );
        }
        if (onManualSearch) onManualSearch(match.kenmeiManga);
      }}
      onKeyDown={(e) =>
        handleKeyDown(e, () => onManualSearch?.(match.kenmeiManga))
      }
      aria-label={ariaLabel}
      disabled={isLoading}
    >
      <Search className="mr-2 h-4 w-4" aria-hidden="true" />
      {text}
    </Button>
  );

  switch (match.status) {
    case "pending":
      return (
        <>
          {match.anilistMatches && match.anilistMatches.length > 0 && (
            <Button
              className={`${buttonBaseClass} bg-linear-to-r from-emerald-500 via-emerald-400 to-lime-400 text-white shadow-[0_12px_32px_-15px_rgba(16,185,129,0.6)] hover:shadow-[0_20px_45px_-18px_rgba(101,163,13,0.55)] focus-visible:ring-emerald-400/80 disabled:cursor-not-allowed disabled:opacity-60 disabled:shadow-none dark:from-emerald-500 dark:via-emerald-400 dark:to-lime-500`}
              onClick={() => {
                console.debug(
                  `[MatchActions] Clicked Accept Match for manga ID: ${match.kenmeiManga.id}, title: ${match.kenmeiManga.title}`,
                );
                if (onAcceptMatch) {
                  onAcceptMatch(match);
                  toast.success(
                    `Accepted match for ${match.kenmeiManga.title}`,
                  );
                }
              }}
              onKeyDown={(e) => handleKeyDown(e, () => onAcceptMatch?.(match))}
              aria-label={`Accept match for ${match.kenmeiManga.title}`}
              disabled={isLoading}
            >
              <Check className="mr-2 h-4 w-4" aria-hidden="true" />
              {isLoading ? "Accepting..." : "Accept Match"}
            </Button>
          )}

          {renderCommonSearchButton(
            "Search Manually",
            `Search manually for ${match.kenmeiManga.title}`,
          )}

          <Button
            className={`${buttonBaseClass} bg-slate-100/80 text-slate-700 shadow-[0_8px_28px_-15px_rgba(30,41,59,0.45)] hover:bg-slate-100 focus-visible:ring-slate-300 disabled:cursor-not-allowed disabled:opacity-60 disabled:shadow-none dark:bg-slate-800/60 dark:text-slate-200 dark:hover:bg-slate-800`}
            onClick={() => {
              if (onRejectMatch) {
                onRejectMatch(match);
                toast.info(`Skipped ${match.kenmeiManga.title}`);
              }
            }}
            onKeyDown={(e) => handleKeyDown(e, () => onRejectMatch?.(match))}
            aria-label={`Skip matching for ${match.kenmeiManga.title}`}
            disabled={isLoading}
          >
            <X className="mr-2 h-4 w-4" aria-hidden="true" />
            {isLoading ? "Skipping..." : "Skip"}
          </Button>
        </>
      );

    case "matched":
    case "manual":
      return (
        <>
          {renderCommonSearchButton(
            "Change Match",
            `Change match for ${match.kenmeiManga.title}`,
          )}
          <Button
            variant="secondary"
            className={`${buttonBaseClass} bg-slate-200/80 text-slate-800 shadow-[0_8px_28px_-15px_rgba(15,23,42,0.45)] hover:bg-slate-200 focus-visible:ring-slate-400 disabled:cursor-not-allowed disabled:opacity-60 disabled:shadow-none dark:bg-slate-800/70 dark:text-slate-200 dark:hover:bg-slate-800`}
            onClick={() => {
              if (onResetToPending) {
                onResetToPending(match);
                toast.info(`Reset ${match.kenmeiManga.title} to pending`);
              }
            }}
            onKeyDown={(e) => handleKeyDown(e, () => onResetToPending?.(match))}
            aria-label={`Reset ${match.kenmeiManga.title} to pending status`}
            disabled={isLoading}
          >
            <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
            {isLoading ? "Resetting..." : "Reset to Pending"}
          </Button>
        </>
      );

    case "skipped":
      return (
        <>
          {renderCommonSearchButton(
            "Search Manually",
            `Find match for ${match.kenmeiManga.title}`,
          )}
          <Button
            variant="secondary"
            className={`${buttonBaseClass} bg-slate-200/80 text-slate-700 shadow-[0_8px_28px_-15px_rgba(15,23,42,0.45)] hover:bg-slate-200 focus-visible:ring-slate-400 disabled:cursor-not-allowed disabled:opacity-60 disabled:shadow-none dark:bg-slate-800/70 dark:text-slate-200 dark:hover:bg-slate-800`}
            onClick={() => {
              if (onResetToPending) {
                onResetToPending(match);
                toast.info(`Reset ${match.kenmeiManga.title} to pending`);
              }
            }}
            onKeyDown={(e) => handleKeyDown(e, () => onResetToPending?.(match))}
            aria-label={`Reset ${match.kenmeiManga.title} to pending status`}
            disabled={isLoading}
          >
            <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
            {isLoading ? "Resetting..." : "Reset to Pending"}
          </Button>
        </>
      );

    default:
      return null;
  }
}

const MatchActionsMemo = React.memo(MatchActionsComponent);
MatchActionsMemo.displayName = "MatchActions";

export { MatchActionsMemo as MatchActions };
export default MatchActionsMemo;
