import React from "react";
import { motion } from "framer-motion";
import { ResumeNotification } from "./ResumeNotification";

interface Props {
  pendingMangaCount: number;
  onResumeMatching: () => void;
  onCancelResume: () => void;
}

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
