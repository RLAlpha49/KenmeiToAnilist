import React from "react";
import { motion } from "framer-motion";
import { Button } from "../ui/button";
import { MangaMatchingPanel } from "./MangaMatchingPanel";
import type { MangaMatchResult } from "../../api/anilist/types";
import type { KenmeiManga } from "../../api/kenmei/types";

/**
 * Props for the MatchingPanel component.
 *
 * @property matches - List of manga match results to display and manage.
 * @property onManualSearch - Callback to trigger manual search for a Kenmei manga.
 * @property onAcceptMatch - Callback when a match is accepted.
 * @property onRejectMatch - Callback when a match is rejected.
 * @property onSelectAlternative - Callback to select an alternative match.
 * @property onResetToPending - Callback to reset a match to pending status.
 * @property searchQuery - Current search query to highlight or filter.
 * @property onProceedToSync - Callback to proceed to the sync stage.
 * @property onBackToImport - Callback to return to the import stage.
 * @property onSetMatchedToPending - Optional callback to reset matched items to pending.
 * @property disableSetMatchedToPending - Whether to disable the pending reset button.
 * @source
 */
interface Props {
  matches: MangaMatchResult[];
  onManualSearch: (manga: KenmeiManga) => void;
  onAcceptMatch: (match: MangaMatchResult) => void;
  onRejectMatch: (match: MangaMatchResult) => void;
  onSelectAlternative: (
    match: MangaMatchResult,
    alternativeIndex: number,
    autoAccept?: boolean,
    directAccept?: boolean,
  ) => void;
  onResetToPending: (match: MangaMatchResult) => void;
  searchQuery: string;
  onProceedToSync: () => void;
  onBackToImport: () => void;
  onSetMatchedToPending?: () => void;
  disableSetMatchedToPending?: boolean;
}

/**
 * Container component for reviewing and managing manga matches before syncing.
 *
 * Provides UI for accepting/rejecting matches, searching alternatives, and
 * navigating between import and sync stages.
 *
 * @param props - The component props.
 * @returns The rendered matching panel.
 * @source
 */
export function MatchingPanel({
  matches,
  onManualSearch,
  onAcceptMatch,
  onRejectMatch,
  onSelectAlternative,
  onResetToPending,
  searchQuery,
  onProceedToSync,
  onBackToImport,
  onSetMatchedToPending,
}: Readonly<Props>) {
  return (
    <motion.div
      className="mb-6 flex h-full flex-col gap-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.25, duration: 0.3 }}
    >
      <div className="relative flex-1 overflow-hidden rounded-3xl border border-white/40 bg-white/70 shadow-2xl shadow-slate-900/5 backdrop-blur dark:border-slate-800/60 dark:bg-slate-900/70">
        <div className="pointer-events-none absolute -top-24 left-8 h-64 w-64 rounded-full bg-sky-400/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 right-4 h-60 w-60 rounded-full bg-indigo-500/10 blur-3xl" />
        <div className="relative z-10 h-full overflow-y-auto px-4 py-6 sm:px-6 lg:px-8">
          <MangaMatchingPanel
            matches={matches}
            onManualSearch={onManualSearch}
            onAcceptMatch={onAcceptMatch}
            onRejectMatch={onRejectMatch}
            onSelectAlternative={onSelectAlternative}
            onResetToPending={onResetToPending}
            searchQuery={searchQuery}
            onSetMatchedToPending={onSetMatchedToPending}
            isLoadingInitial={matches.length === 0}
          />
        </div>
      </div>

      <motion.div
        className="mt-6 flex flex-col-reverse justify-end space-y-4 space-y-reverse sm:flex-row sm:space-x-4 sm:space-y-0"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35, duration: 0.3 }}
      >
        <Button
          variant="outline"
          onClick={onBackToImport}
          className="border-slate-300/60 bg-white/60 backdrop-blur hover:bg-white/90 dark:border-slate-700 dark:bg-slate-900/60 dark:hover:bg-slate-900"
        >
          Back to Import
        </Button>
        <Button
          className="bg-linear-to-r from-indigo-500 via-sky-500 to-blue-500 shadow-lg hover:from-indigo-600 hover:via-sky-600 hover:to-blue-600"
          onClick={onProceedToSync}
        >
          Proceed to Sync
        </Button>
      </motion.div>
    </motion.div>
  );
}

export default MatchingPanel;
