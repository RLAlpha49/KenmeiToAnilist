/**
 * @packageDocumentation
 * @module SearchModal
 * @description React component for displaying a modal to search and select AniList manga matches for a given Kenmei manga.
 */
import React from "react";
import { KenmeiManga } from "../../api/kenmei/types";
import { AniListManga } from "../../api/anilist/types";
import { MangaSearchPanel } from "./MangaSearchPanel";
import { motion, AnimatePresence } from "framer-motion";

/**
 * Props for the SearchModal component.
 *
 * @property isOpen - Whether the modal is open.
 * @property searchTarget - The Kenmei manga to search for a match.
 * @property accessToken - The AniList access token.
 * @property bypassCache - Whether to bypass the cache for searching.
 * @property onClose - Callback to close the modal.
 * @property onSelectMatch - Callback when a manga match is selected.
 * @source
 */
export interface SearchModalProps {
  isOpen: boolean;
  searchTarget?: KenmeiManga;
  accessToken: string;
  bypassCache: boolean;
  onClose: () => void;
  onSelectMatch: (manga: AniListManga) => void;
}

/**
 * Displays a modal for searching and selecting AniList manga matches for a given Kenmei manga.
 *
 * @param props - The props for the SearchModal component.
 * @returns The rendered search modal React element.
 * @source
 * @example
 * ```tsx
 * <SearchModal isOpen={isOpen} searchTarget={manga} accessToken={token} bypassCache={false} onClose={handleClose} onSelectMatch={handleSelect} />
 * ```
 */
export const SearchModal: React.FC<SearchModalProps> = ({
  isOpen,
  searchTarget,
  accessToken,
  bypassCache,
  onClose,
  onSelectMatch,
}) => {
  // Don't return null; let AnimatePresence handle the transition
  return (
    <AnimatePresence>
      {isOpen && searchTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-x-hidden overflow-y-auto">
          {/* Blurred backdrop */}
          <motion.div
            className="fixed inset-0 bg-white/10 backdrop-blur-sm transition-all"
            onClick={onClose}
            aria-hidden="true"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          ></motion.div>

          {/* Modal panel with max height and width constraints */}
          <motion.div
            className="relative z-50 m-4 max-h-[85vh] w-full max-w-6xl overflow-auto rounded-lg bg-white shadow-xl dark:bg-gray-800"
            initial={{ opacity: 0, y: 20, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.98 }}
            transition={{
              duration: 0.25,
              type: "spring",
              stiffness: 400,
              damping: 30,
            }}
          >
            <MangaSearchPanel
              key={`search-${searchTarget.id}`}
              kenmeiManga={searchTarget}
              onClose={onClose}
              onSelectMatch={onSelectMatch}
              token={accessToken || ""}
              bypassCache={bypassCache}
            />
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
