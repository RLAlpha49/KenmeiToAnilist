/**
 * @packageDocumentation
 * @module SyncPage/LoadingStateDisplay
 * @description React component for displaying loading states with context-specific messaging.
 */

import React from "react";
import { motion } from "framer-motion";
import { Card, CardContent } from "../ui/Card";

/**
 * Props for the LoadingStateDisplay component.
 * @property type - Type of loading state: "manga" for sync data prep, "library" for AniList fetch.
 * @property isRateLimited - Whether currently rate limited by AniList API (optional, default false).
 * @property retryCount - Current retry attempt number for failed requests (optional, default 0).
 * @property maxRetries - Maximum retry attempts allowed before giving up (optional, default 3).
 * @source
 */
interface LoadingStateDisplayProps {
  type: "manga" | "library";
  isRateLimited?: boolean;
  retryCount?: number;
  maxRetries?: number;
}

/**
 * Display animated loading state with context-specific messaging and visual feedback.
 * Handles different loading scenarios: manga data preparation, library fetch, rate limiting, and retry states.
 * Provides different visual treatment based on scenario (glow colors, icons, descriptions).
 * @param props - Component props with loading type and optional rate limit/retry info.
 * @returns Animated loading card with spinner and contextual message.
 * @source
 */
export function LoadingStateDisplay({
  type,
  isRateLimited = false,
  retryCount = 0,
  maxRetries = 3,
}: Readonly<LoadingStateDisplayProps>) {
  let loadingTitle: string;
  if (type === "manga") {
    loadingTitle = "Loading synchronization data";
  } else if (isRateLimited) {
    loadingTitle = "Synchronization paused";
  } else {
    loadingTitle = "Fetching your AniList library";
  }

  let description: string;
  if (type === "manga") {
    description =
      "We're pulling in your matched manga and preparing preview data.";
  } else if (isRateLimited) {
    description =
      "AniList asked us to slow down for a moment. We'll automatically resume once the cooldown ends.";
  } else if (retryCount > 0) {
    description = `Server hiccup detected. Retrying (${retryCount}/${maxRetries}) shortly...`;
  } else {
    description =
      "Collecting your AniList entries so we can compare them against Kenmei.";
  }

  let accent: { glow: string; icon: string; text: string };
  if (type === "manga") {
    accent = {
      glow: "from-emerald-300/60 to-transparent",
      icon: "from-emerald-500 to-teal-500",
      text: "text-emerald-500 dark:text-emerald-300",
    };
  } else if (isRateLimited) {
    accent = {
      glow: "from-amber-300/60 to-transparent",
      icon: "from-amber-500 to-orange-500",
      text: "text-amber-600 dark:text-amber-300",
    };
  } else {
    accent = {
      glow: "from-blue-300/60 to-transparent",
      icon: "from-blue-500 to-indigo-500",
      text: "text-blue-600 dark:text-blue-300",
    };
  }

  return (
    <div className="relative py-10">
      <div className="pointer-events-none absolute inset-x-0 top-0 flex justify-center">
        <div
          className={`bg-linear-to-br h-56 w-56 rounded-full ${accent.glow} blur-3xl`}
        />
      </div>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <Card className="mx-auto w-full max-w-md overflow-hidden border border-slate-200/70 bg-white/80 text-center shadow-xl backdrop-blur-xl dark:border-slate-800/60 dark:bg-slate-950/60">
          <CardContent className="pb-8 pt-10">
            <div
              className={`bg-linear-to-br mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full ${accent.icon} text-white shadow-lg`}
            >
              <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-white/70 border-t-transparent" />
            </div>
            <h3 className={`text-lg font-semibold ${accent.text}`}>
              {loadingTitle}
            </h3>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
              {description}
            </p>
            {isRateLimited && (
              <p className="mt-2 text-xs text-amber-600 dark:text-amber-300">
                You can keep browsing the preview while we wait for the cool
                down.
              </p>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
