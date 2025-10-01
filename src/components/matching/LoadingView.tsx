import React from "react";
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
  headerVariants: Variants;
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
  headerVariants,
  contentVariants,
  matchingProcess,
  rateLimitState,
  navigate,
  matchResultsLength,
  onRetry,
  onDismissError,
}: LoadingViewProps) {
  return (
    <motion.div
      className="container mx-auto max-w-5xl space-y-6 px-4 py-8 md:px-6"
      variants={pageVariants}
      initial="hidden"
      animate="visible"
    >
      <motion.div className="space-y-2" variants={headerVariants}>
        <h1 className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-3xl font-bold text-transparent">
          Match Your Manga
        </h1>
        <p className="text-muted-foreground max-w-2xl">
          Automatically match your imported manga with AniList entries
        </p>
      </motion.div>

      {/* Loading State with Progress and Cancel Button */}
      <motion.div variants={contentVariants}>
        <MatchingProgressPanel
          isCancelling={matchingProcess.isCancelling}
          progress={matchingProcess.progress}
          statusMessage={matchingProcess.statusMessage}
          detailMessage={matchingProcess.detailMessage}
          timeEstimate={matchingProcess.timeEstimate}
          onCancelProcess={matchingProcess.handleCancelProcess}
          bypassCache={matchingProcess.bypassCache}
          freshSearch={matchingProcess.freshSearch}
          disableControls={rateLimitState.isRateLimited}
        />
      </motion.div>

      {/* Error Display */}
      {matchingProcess.error && !matchResultsLength && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.25, duration: 0.3 }}
        >
          {matchingProcess.error.includes("Authentication Required") ? (
            <Card className="mx-auto w-full max-w-lg overflow-hidden border-amber-200 bg-amber-50/30 text-center dark:border-amber-800/30 dark:bg-amber-900/10">
              <CardContent className="pt-6 pb-4">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
                  <AlertCircle className="h-6 w-6 text-amber-600 dark:text-amber-400" />
                </div>
                <h3 className="text-lg font-medium">Authentication Required</h3>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                  You need to be authenticated with AniList to match your manga.
                </p>
                <Button
                  onClick={() => navigate({ to: "/settings" })}
                  className="mt-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
                >
                  Go to Settings
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card className="mx-auto w-full max-w-lg overflow-hidden border-slate-200 text-center">
              <CardContent className="pt-6 pb-4">
                <h3 className="text-lg font-medium">{matchingProcess.error}</h3>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                  {matchingProcess.detailMessage}
                </p>
                <div className="mt-4 flex items-center justify-center gap-3">
                  <Button onClick={() => onRetry()}>Retry</Button>
                  <Button variant="ghost" onClick={() => onDismissError()}>
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
