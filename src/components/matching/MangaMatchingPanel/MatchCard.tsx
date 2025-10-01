import React from "react";
import { motion } from "framer-motion";
import type { MangaMatchResult } from "../../../api/anilist/types";

export interface MatchCardProps {
  match: MangaMatchResult;
  className?: string;
  children?: React.ReactNode;
}

export default function MatchCard({
  match,
  className = "",
  children,
}: MatchCardProps) {
  return (
    <motion.div
      key={`${match.kenmeiManga.id || "unknown"}-${match.status}`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.2 }}
      className={className}
      tabIndex={0}
      aria-label={`Match result for ${match.kenmeiManga.title}`}
    >
      {children}
    </motion.div>
  );
}
