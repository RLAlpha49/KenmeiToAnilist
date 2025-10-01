import React from "react";
import { motion, type Variants } from "framer-motion";
import { Button } from "../ui/button";

interface Props {
  headerVariants: Variants;
  matchResultsLength: number;
  showRematchOptions: boolean;
  setShowRematchOptions: (v: boolean) => void;
  handleSetAllMatchedToPending: () => void;
  matchingProcessIsLoading: boolean;
  rateLimitIsRateLimited: boolean;
}

export function MatchingPageHeader({
  headerVariants,
  matchResultsLength,
  showRematchOptions,
  setShowRematchOptions,
  handleSetAllMatchedToPending,
  matchingProcessIsLoading,
  rateLimitIsRateLimited,
}: Props) {
  return (
    <motion.header className="mb-6 space-y-2" variants={headerVariants}>
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <h1 className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-3xl font-bold text-transparent">
          Review Your Manga
        </h1>
        {matchResultsLength > 0 && !matchingProcessIsLoading && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2, duration: 0.25 }}
          >
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                onClick={() => setShowRematchOptions(!showRematchOptions)}
                variant="default"
                className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
              >
                {showRematchOptions
                  ? "Hide Rematch Options"
                  : "Fresh Search (Clear Cache)"}
              </Button>
              <Button
                variant="outline"
                onClick={handleSetAllMatchedToPending}
                disabled={matchingProcessIsLoading || rateLimitIsRateLimited}
              >
                Set Matched To Pending
              </Button>
            </div>
          </motion.div>
        )}
      </div>
      <p className="text-muted-foreground max-w-2xl">
        Review the matches found between your Kenmei manga and AniList.
      </p>
    </motion.header>
  );
}

export default MatchingPageHeader;
