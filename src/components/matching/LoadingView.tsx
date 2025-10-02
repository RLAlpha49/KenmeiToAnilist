import React, { useMemo } from "react";
import { motion } from "framer-motion";
import { Card, CardContent } from "../ui/card";
import { Button } from "../ui/button";
import { AlertCircle } from "lucide-react";
import { MatchingProgressPanel } from "./MatchingProgress";
import type { Variants } from "framer-motion";
import { useMatchingProcess } from "../../hooks/useMatchingProcess";
import { useRateLimit } from "../../contexts/RateLimitContext";

type MatchingProcessType = ReturnType<typeof useMatchingProcess>;
type RateLimitType = ReturnType<typeof useRateLimit>;

interface LoadingViewProps {
  pageVariants: Variants;
  contentVariants: Variants;
  matchingProcess: MatchingProcessType;
  rateLimitState: RateLimitType["rateLimitState"];
  navigate: (arg: { to: string }) => void;
  matchResultsLength: number;
  onRetry: () => void;
  onDismissError: () => void;
}

export function LoadingView({
  pageVariants,
  contentVariants,
  matchingProcess,
  rateLimitState,
  navigate,
  matchResultsLength,
  onRetry,
  onDismissError,
}: Readonly<LoadingViewProps>) {
  const rateLimitCountdown = useMemo(() => {
    if (!rateLimitState.isRateLimited || !rateLimitState.retryAfter) {
      return null;
    }

    const msRemaining = Math.max(rateLimitState.retryAfter - Date.now(), 0);
    const totalSeconds = Math.ceil(msRemaining / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  }, [rateLimitState.isRateLimited, rateLimitState.retryAfter]);

  return (
    <motion.div
      className="relative mx-auto max-w-5xl space-y-8 overflow-hidden px-4 py-10 md:px-6"
      variants={pageVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Loading State with Progress and Cancel Button */}
      <motion.div variants={contentVariants} className="relative z-10">
        <MatchingProgressPanel
          isCancelling={matchingProcess.isCancelling}
          progress={matchingProcess.progress}
          statusMessage={matchingProcess.statusMessage}
          detailMessage={matchingProcess.detailMessage}
          timeEstimate={matchingProcess.timeEstimate}
          onCancelProcess={matchingProcess.handleCancelProcess}
          onPauseProcess={matchingProcess.handlePauseMatching}
          onResumeProcess={matchingProcess.handleResumeMatchingRequests}
          bypassCache={matchingProcess.bypassCache}
          freshSearch={matchingProcess.freshSearch}
          disableControls={rateLimitState.isRateLimited}
          isPaused={matchingProcess.isTimeEstimatePaused}
          isManuallyPaused={matchingProcess.isManuallyPaused}
          isRateLimitActive={
            rateLimitState.isRateLimited || matchingProcess.isRateLimitPaused
          }
        />
      </motion.div>

      {rateLimitState.isRateLimited && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="relative z-10"
        >
          <Card className="overflow-hidden border border-amber-300/60 bg-amber-50/70 shadow-lg shadow-amber-200/40 dark:border-amber-500/30 dark:bg-amber-900/25">
            <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/20 text-amber-600 dark:bg-amber-500/25 dark:text-amber-200">
                  <AlertCircle className="h-6 w-6" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-base font-semibold text-amber-700 dark:text-amber-100">
                    AniList rate limit in effect
                  </h3>
                  <p className="text-sm text-amber-700/80 dark:text-amber-100/80">
                    {rateLimitState.message ||
                      "AniList API rate limit reached. Please wait before making more requests."}
                  </p>
                </div>
              </div>
              {rateLimitCountdown && (
                <div className="flex flex-col items-start rounded-xl border border-amber-400/40 bg-white/70 px-4 py-2 text-sm font-semibold text-amber-700 shadow-sm dark:border-amber-500/40 dark:bg-amber-950/40 dark:text-amber-100">
                  <span className="text-xs font-medium tracking-[0.18em] text-amber-600/80 uppercase dark:text-amber-200/80">
                    Retry in
                  </span>
                  <span className="text-lg leading-tight font-semibold">
                    {rateLimitCountdown}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Error Display */}
      {matchingProcess.error && !matchResultsLength && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.25, duration: 0.3 }}
        >
          {matchingProcess.error.includes("Authentication Required") ? (
            <Card className="mx-auto w-full max-w-xl overflow-hidden border border-amber-300/60 bg-gradient-to-br from-amber-50/70 via-white/80 to-amber-100/70 text-center shadow-lg shadow-amber-100/60 dark:border-amber-500/40 dark:from-amber-900/30 dark:via-slate-950/40 dark:to-amber-900/20">
              <CardContent className="pt-6 pb-5">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/15 text-amber-600 dark:bg-amber-500/20 dark:text-amber-200">
                  <AlertCircle className="h-6 w-6" />
                </div>
                <h3 className="text-lg font-semibold text-amber-700 dark:text-amber-100">
                  Authentication Required
                </h3>
                <p className="mt-2 text-sm text-amber-700/80 dark:text-amber-100/80">
                  You need to connect your AniList account before matching your
                  manga library.
                </p>
                <Button
                  onClick={() => navigate({ to: "/settings" })}
                  className="mt-4 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white shadow-md hover:from-blue-700 hover:via-indigo-700 hover:to-purple-700"
                >
                  Go to Settings
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card className="mx-auto w-full max-w-xl overflow-hidden border border-rose-300/60 bg-gradient-to-br from-rose-50/70 via-white/80 to-rose-100/70 text-center shadow-lg shadow-rose-100/60 dark:border-rose-500/40 dark:from-rose-900/30 dark:via-slate-950/40 dark:to-rose-900/20">
              <CardContent className="pt-6 pb-5">
                <h3 className="text-lg font-semibold text-rose-700 dark:text-rose-100">
                  {matchingProcess.error}
                </h3>
                <p className="mt-2 text-sm text-rose-700/80 dark:text-rose-100/80">
                  {matchingProcess.detailMessage}
                </p>
                <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
                  <Button
                    className="bg-gradient-to-r from-rose-500 via-red-500 to-orange-500 text-white shadow-md hover:from-rose-600 hover:via-red-600 hover:to-orange-600"
                    onClick={() => onRetry()}
                  >
                    Retry
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => onDismissError()}
                    className="hover:bg-rose-100/60 hover:text-rose-600 dark:hover:bg-rose-900/20 dark:hover:text-rose-200"
                  >
                    Dismiss
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </motion.div>
      )}
    </motion.div>
  );
}
