import React from "react";
import { motion } from "framer-motion";
import { Card, CardContent } from "../ui/card";

interface LoadingStateDisplayProps {
  type: "manga" | "library";
  isRateLimited?: boolean;
  retryCount?: number;
  maxRetries?: number;
}

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
          className={`h-56 w-56 rounded-full bg-gradient-to-br ${accent.glow} blur-3xl`}
        />
      </div>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <Card className="mx-auto w-full max-w-md overflow-hidden border border-slate-200/70 bg-white/80 text-center shadow-xl backdrop-blur-xl dark:border-slate-800/60 dark:bg-slate-950/60">
          <CardContent className="pt-10 pb-8">
            <div
              className={`mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br ${accent.icon} text-white shadow-lg`}
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
