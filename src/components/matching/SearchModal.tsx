/**
 * @packageDocumentation
 * @module SearchModal
 * @description React component for displaying a modal to search and select AniList manga matches for a given Kenmei manga.
 */
import React, { useEffect } from "react";
import { KenmeiManga } from "../../api/kenmei/types";
import { AniListManga } from "../../api/anilist/types";
import { MangaSearchPanel } from "./MangaSearchPanel";
import { motion, AnimatePresence } from "framer-motion";
import { createPortal } from "react-dom";

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
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    if (typeof window === "undefined" || typeof document === "undefined") {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    const previousPaddingRight = document.body.style.paddingRight;
    const previousScrollBehavior = document.body.style.scrollBehavior;

    const scrollbarWidth =
      window.innerWidth - document.documentElement.clientWidth;

    document.body.style.overflow = "hidden";
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }
    document.body.style.scrollBehavior = "auto";

    return () => {
      document.body.style.overflow = previousOverflow;
      document.body.style.paddingRight = previousPaddingRight;
      document.body.style.scrollBehavior = previousScrollBehavior;
    };
  }, [isOpen]);

  const portalTarget =
    typeof window !== "undefined" && typeof document !== "undefined"
      ? document.body
      : null;

  if (!portalTarget) {
    return null;
  }

  // Don't return null; let AnimatePresence handle the transition
  return createPortal(
    <AnimatePresence>
      {isOpen && searchTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Blurred backdrop */}
          <motion.div
            className="fixed inset-0 bg-slate-950/65 backdrop-blur-2xl transition-all"
            onClick={onClose}
            aria-hidden="true"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          ></motion.div>

          <motion.div
            className="relative z-50 m-4 max-h-[85vh] w-full max-w-6xl overflow-visible rounded-[32px] border border-white/15 bg-gradient-to-br from-blue-400/25 via-white/15 to-purple-500/20 p-[1.5px] shadow-[0_40px_160px_-60px_rgba(30,64,175,0.7)] backdrop-blur-2xl dark:border-slate-700/40"
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
            <div className="max-h-[85vh] overflow-auto rounded-[30px] bg-white/90 p-2 shadow-[inset_0_0_1px_rgba(255,255,255,0.4)] dark:bg-slate-950/85">
              <MangaSearchPanel
                key={`search-${searchTarget.id}`}
                kenmeiManga={searchTarget}
                onClose={onClose}
                onSelectMatch={onSelectMatch}
                token={accessToken || ""}
                bypassCache={bypassCache}
              />
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    portalTarget,
  );
};
