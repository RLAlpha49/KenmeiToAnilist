/**
 * @packageDocumentation
 * @module SyncResumeNotification
 * @description React component for notifying the user about interrupted sync sessions and providing resume/discard actions.
 */
import React from "react";
import { motion } from "framer-motion";
import { AlertTriangle, Play, XCircle } from "lucide-react";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";

/**
 * Props for the SyncResumeNotification component.
 *
 * @property remainingCount - The number of entries remaining from the interrupted sync.
 * @property totalCount - The total number of entries in the original sync.
 * @property lastSyncTime - Timestamp when the sync was last checkpointed.
 * @property onResume - Callback to resume the sync from the checkpoint.
 * @property onDiscard - Callback to discard the checkpoint and start fresh.
 * @source
 */
export interface SyncResumeNotificationProps {
  remainingCount: number;
  totalCount: number;
  lastSyncTime: number;
  onResume: () => void;
  onDiscard: () => void;
}

/**
 * Formats a timestamp into a human-readable relative or absolute time string.
 * @param timestamp - The timestamp to format.
 * @returns A formatted time string.
 */
const formatTimestamp = (timestamp: number): string => {
  const now = Date.now();
  const diffMs = now - timestamp;
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

  if (diffMinutes < 1) return "just now";
  if (diffMinutes < 60)
    return `${diffMinutes} minute${diffMinutes === 1 ? "" : "s"} ago`;
  if (diffHours < 24)
    return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;

  // For older syncs, use absolute time
  const date = new Date(timestamp);
  const yesterday = new Date(now - 24 * 60 * 60 * 1000);

  if (date.toDateString() === yesterday.toDateString()) {
    return `Yesterday at ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  }

  return date.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

/**
 * Displays a notification card for interrupted sync sessions, allowing the user to resume or discard the checkpoint.
 *
 * @param props - The props for the SyncResumeNotification component.
 * @returns The rendered resume notification React element, or null if no remaining entries.
 * @source
 */
const SyncResumeNotificationComponent: React.FC<
  SyncResumeNotificationProps
> = ({ remainingCount, totalCount, lastSyncTime, onResume, onDiscard }) => {
  // Don't render anything if there are no remaining entries
  if (remainingCount <= 0) {
    return null;
  }

  const formattedTime = formatTimestamp(lastSyncTime);

  return (
    <motion.div
      initial={{ opacity: 0, y: -16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      role="alert"
      className="bg-linear-to-br supports-backdrop-filter:backdrop-blur-md relative mb-6 overflow-hidden rounded-3xl border border-yellow-200/75 from-amber-50/90 via-yellow-100/80 to-white/75 shadow-lg shadow-yellow-200/40 dark:border-amber-900/60 dark:from-amber-950/65 dark:via-amber-950/45 dark:to-slate-950/50"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(250,204,21,0.25)_0%,rgba(255,255,255,0)_68%)] opacity-90 dark:bg-[radial-gradient(circle_at_top_left,rgba(250,204,21,0.22)_0%,rgba(17,24,39,0)_72%)]" />
      <div className="relative flex flex-col gap-5 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 items-start gap-4">
          <span className="dark:bg-yellow-500/18 flex h-12 w-12 items-center justify-center rounded-2xl bg-yellow-500/15 text-yellow-700 shadow-inner shadow-yellow-200/40 dark:text-yellow-200">
            <AlertTriangle className="h-6 w-6" />
          </span>
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-lg font-semibold text-yellow-900 dark:text-yellow-200">
                Resume interrupted sync
              </h3>
              <Badge className="rounded-full border border-yellow-300/70 bg-yellow-200/45 text-[11px] font-semibold uppercase tracking-[0.18em] text-yellow-700 dark:border-yellow-800/70 dark:bg-yellow-900/40 dark:text-yellow-300">
                {remainingCount} remaining
              </Badge>
            </div>
            <p className="max-w-xl text-sm text-yellow-800/90 dark:text-yellow-300/90">
              Your previous sync was interrupted with {remainingCount} of{" "}
              {totalCount} entries remaining. Last checkpoint: {formattedTime}.
              Resume from where you left off or start fresh.
            </p>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-3">
          <Button
            onClick={onResume}
            aria-label="Resume interrupted sync"
            className="bg-linear-to-r h-11 min-w-44 gap-2 rounded-full from-yellow-500 to-amber-500 px-4 text-sm font-semibold uppercase tracking-[0.18em] text-white shadow-md shadow-yellow-400/40 transition hover:from-yellow-500/90 hover:to-amber-500/90 dark:from-yellow-600 dark:to-amber-600 dark:hover:from-yellow-500 dark:hover:to-amber-500"
          >
            <Play className="h-4 w-4" /> Resume Sync
          </Button>
          <Button
            variant="outline"
            onClick={onDiscard}
            aria-label="Discard checkpoint and start fresh"
            className="h-11 gap-2 rounded-full border-yellow-300/60 bg-white/70 px-4 text-sm font-semibold uppercase tracking-[0.18em] text-yellow-700 transition hover:border-yellow-400 hover:bg-yellow-100 dark:border-yellow-800/60 dark:bg-amber-950/60 dark:text-yellow-200 dark:hover:border-yellow-700"
          >
            <XCircle className="h-4 w-4" /> Start Fresh
          </Button>
        </div>
      </div>
    </motion.div>
  );
};

export const SyncResumeNotification = React.memo(
  SyncResumeNotificationComponent,
);
