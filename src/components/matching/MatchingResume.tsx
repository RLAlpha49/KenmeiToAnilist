import React from "react";
import { motion } from "framer-motion";
import { ResumeNotification } from "./ResumeNotification";

/**
 * Props for the MatchingResume component.
 *
 * @property pendingMangaCount - Number of manga pending from a previous session.
 * @property onResumeMatching - Callback to resume the matching process.
 * @property onCancelResume - Callback to cancel resuming and continue normally.
 * @source
 */
interface Props {
  pendingMangaCount: number;
  onResumeMatching: () => void;
  onCancelResume: () => void;
}

/**
 * Container component that displays a resume notification for unfinished matching sessions.
 *
 * @param props - The component props.
 * @returns The rendered matching resume component.
 * @source
 */
export function MatchingResume({
  pendingMangaCount,
  onResumeMatching,
  onCancelResume,
}: Readonly<Props>) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4, duration: 0.3 }}
    >
      <ResumeNotification
        pendingMangaCount={pendingMangaCount}
        onResumeMatching={onResumeMatching}
        onCancelResume={onCancelResume}
      />
    </motion.div>
  );
}

export default MatchingResume;
