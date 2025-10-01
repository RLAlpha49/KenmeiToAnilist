import React from "react";
import { ArrowLeft, Check, Info, Loader2, RefreshCw, X } from "lucide-react";
import { Card } from "../../ui/card";
import { Button } from "../../ui/button";

export interface MatchBulkActionsProps {
  emptyMatchesCount: number;
  onSkipEmptyMatches: () => void;
  isSkippingEmptyMatches: boolean;
  noMatchesCount: number;
  onReSearchNoMatches: () => void;
  isReSearchingNoMatches: boolean;
  skippedMangaCount: number;
  onResetSkippedToPending: () => void;
  isResettingSkippedToPending: boolean;
  pendingMatchesCount: number;
  onAcceptAllPendingMatches: () => void;
  isAcceptingAllMatches: boolean;
}

export function MatchBulkActions({
  emptyMatchesCount,
  onSkipEmptyMatches,
  isSkippingEmptyMatches,
  noMatchesCount,
  onReSearchNoMatches,
  isReSearchingNoMatches,
  skippedMangaCount,
  onResetSkippedToPending,
  isResettingSkippedToPending,
  pendingMatchesCount,
  onAcceptAllPendingMatches,
  isAcceptingAllMatches,
}: Readonly<MatchBulkActionsProps>) {
  return (
    <div className="mb-4 flex flex-col space-y-4">
      {emptyMatchesCount > 0 && (
        <Card className="p-4">
          <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
            <Button
              variant="outline"
              onClick={onSkipEmptyMatches}
              disabled={isSkippingEmptyMatches}
              className="bg-background w-full sm:w-auto"
            >
              {isSkippingEmptyMatches ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <X className="mr-2 h-4 w-4" />
                  Skip Empty Matches ({emptyMatchesCount})
                </>
              )}
            </Button>
            <span className="text-muted-foreground text-sm">
              Mark all pending manga with no matches as skipped
            </span>
          </div>
        </Card>
      )}

      {noMatchesCount > 0 && (
        <Card className="p-4">
          <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
            <Button
              variant="outline"
              onClick={onReSearchNoMatches}
              disabled={isReSearchingNoMatches}
              className="w-full border-purple-200 bg-purple-50 text-purple-700 hover:bg-purple-100 hover:text-purple-800 sm:w-auto dark:border-purple-800 dark:bg-purple-900/20 dark:text-purple-300 dark:hover:bg-purple-900/30"
            >
              {isReSearchingNoMatches ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Re-search Empty Matches ({noMatchesCount})
                </>
              )}
            </Button>
            <span className="text-muted-foreground text-sm">
              Attempt to find matches for all manga without results
            </span>
          </div>
        </Card>
      )}

      {skippedMangaCount > 0 && (
        <Card className="p-4">
          <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
            <Button
              variant="outline"
              onClick={onResetSkippedToPending}
              disabled={isResettingSkippedToPending}
              className="w-full border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-100 hover:text-orange-800 sm:w-auto dark:border-orange-800 dark:bg-orange-900/20 dark:text-orange-300 dark:hover:bg-orange-900/30"
            >
              {isResettingSkippedToPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Reset Skipped to Pending ({skippedMangaCount})
                </>
              )}
            </Button>
            <span className="text-muted-foreground text-sm">
              Reset all skipped manga back to pending status
            </span>
          </div>
        </Card>
      )}

      {pendingMatchesCount > 0 && (
        <Card className="p-4">
          <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
            <Button
              variant="outline"
              onClick={onAcceptAllPendingMatches}
              disabled={isAcceptingAllMatches}
              className="w-full border-green-200 bg-green-50 text-green-700 hover:bg-green-100 hover:text-green-800 sm:w-auto dark:border-green-800 dark:bg-green-900/20 dark:text-green-300 dark:hover:bg-green-900/30"
            >
              {isAcceptingAllMatches ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Check className="mr-2 h-4 w-4" />
                  Accept All Matches ({pendingMatchesCount})
                </>
              )}
            </Button>
            <div className="flex items-center gap-2">
              <div className="group relative flex">
                <Info className="text-muted-foreground h-4 w-4" />
                <div className="bg-card absolute bottom-full left-1/2 mb-2 hidden w-64 -translate-x-1/2 transform rounded-md border px-3 py-2 text-xs font-medium shadow-lg group-hover:block">
                  It&apos;s still a good idea to skim over the matches to ensure
                  everything is correct before proceeding.
                </div>
              </div>
              <span className="text-muted-foreground text-sm">
                Accept all pending manga with available matches
              </span>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
