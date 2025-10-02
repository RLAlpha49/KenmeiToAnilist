/**
 * @packageDocumentation
 * @module ResumeNotification
 * @description React component for notifying the user about unfinished manga matching processes and providing resume/cancel actions.
 */
import React from "react";
import { motion } from "framer-motion";
import { AlertTriangle, Play, XCircle } from "lucide-react";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";

/**
 * Props for the ResumeNotification component.
 *
 * @property pendingMangaCount - The number of manga pending from a previous session.
 * @property onResumeMatching - Callback to resume the matching process.
 * @property onCancelResume - Callback to cancel resuming the matching process.
 * @source
 */
export interface ResumeNotificationProps {
  pendingMangaCount: number;
  onResumeMatching: () => void;
  onCancelResume: () => void;
}

/**
 * Displays a notification card if there are unfinished manga matching processes, allowing the user to resume or cancel.
 *
 * @param props - The props for the ResumeNotification component.
 * @returns The rendered resume notification React element, or null if no pending manga.
 * @source
 * @example
 * ```tsx
 * <ResumeNotification pendingMangaCount={3} onResumeMatching={handleResume} onCancelResume={handleCancel} />
 * ```
 */
export const ResumeNotification: React.FC<ResumeNotificationProps> = ({
  pendingMangaCount,
  onResumeMatching,
  onCancelResume,
}) => {
  // Don't render anything if there are no pending manga
  if (pendingMangaCount <= 0) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="relative mb-6 overflow-hidden rounded-3xl border border-yellow-200/75 bg-gradient-to-br from-amber-50/90 via-yellow-100/80 to-white/75 shadow-lg shadow-yellow-200/40 supports-[backdrop-filter]:backdrop-blur-md dark:border-amber-900/60 dark:from-amber-950/65 dark:via-amber-950/45 dark:to-slate-950/50"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(250,204,21,0.25)_0%,rgba(255,255,255,0)_68%)] opacity-90 dark:bg-[radial-gradient(circle_at_top_left,_rgba(250,204,21,0.22)_0%,rgba(17,24,39,0)_72%)]" />
      <div className="relative flex flex-col gap-5 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 items-start gap-4">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-yellow-500/15 text-yellow-700 shadow-inner shadow-yellow-200/40 dark:bg-yellow-500/18 dark:text-yellow-200">
            <AlertTriangle className="h-6 w-6" />
          </span>
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-lg font-semibold text-yellow-900 dark:text-yellow-200">
                Resume your unfinished sync
              </h3>
              <Badge className="rounded-full border border-yellow-300/70 bg-yellow-200/45 text-[11px] font-semibold tracking-[0.18em] text-yellow-700 uppercase dark:border-yellow-800/70 dark:bg-yellow-900/40 dark:text-yellow-300">
                {pendingMangaCount} pending
              </Badge>
            </div>
            <p className="max-w-xl text-sm text-yellow-800/90 dark:text-yellow-300/90">
              We found {pendingMangaCount} manga that weren&apos;t processed in
              your previous session. Pick up where you left off, or clear the
              queue if you&apos;d like a fresh start.
            </p>
          </div>
        </div>
        <div className="flex flex-shrink-0 flex-wrap items-center gap-3">
          <Button
            onClick={onResumeMatching}
            className="h-11 min-w-[11rem] gap-2 rounded-full bg-gradient-to-r from-yellow-500 to-amber-500 px-4 text-sm font-semibold tracking-[0.18em] text-white uppercase shadow-md shadow-yellow-400/40 transition hover:from-yellow-500/90 hover:to-amber-500/90 dark:from-yellow-600 dark:to-amber-600 dark:hover:from-yellow-500 dark:hover:to-amber-500"
          >
            <Play className="h-4 w-4" /> Resume Matching
          </Button>
          <Button
            variant="outline"
            onClick={onCancelResume}
            className="h-11 gap-2 rounded-full border-yellow-300/60 bg-white/70 px-4 text-sm font-semibold tracking-[0.18em] text-yellow-700 uppercase transition hover:border-yellow-400 hover:bg-yellow-100 dark:border-yellow-800/60 dark:bg-amber-950/60 dark:text-yellow-200 dark:hover:border-yellow-700"
          >
            <XCircle className="h-4 w-4" /> Cancel
          </Button>
        </div>
      </div>
    </motion.div>
  );
};
