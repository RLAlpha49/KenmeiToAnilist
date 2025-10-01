import React from "react";
import { motion } from "framer-motion";
import { Button } from "../ui/button";
import { MangaMatchingPanel } from "./MangaMatchingPanel";
import type { MangaMatchResult } from "../../api/anilist/types";
import type { KenmeiManga } from "../../api/kenmei/types";

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
}

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
}: Props) {
  return (
    <>
      <motion.div
        className="mb-6 flex h-full flex-col"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.25, duration: 0.3 }}
      >
        <MangaMatchingPanel
          matches={matches}
          onManualSearch={onManualSearch}
          onAcceptMatch={onAcceptMatch}
          onRejectMatch={onRejectMatch}
          onSelectAlternative={onSelectAlternative}
          onResetToPending={onResetToPending}
          searchQuery={searchQuery}
        />

        <motion.div
          className="mt-6 flex flex-col-reverse justify-end space-y-4 space-y-reverse sm:flex-row sm:space-y-0 sm:space-x-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35, duration: 0.3 }}
        >
          <Button variant="outline" onClick={onBackToImport}>
            Back to Import
          </Button>
          <Button
            className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
            onClick={onProceedToSync}
          >
            Proceed to Sync
          </Button>
        </motion.div>
      </motion.div>
    </>
  );
}

export default MatchingPanel;
