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
    loadingTitle = "Loading Synchronization Data";
  } else if (isRateLimited) {
    loadingTitle = "Synchronization Paused";
  } else {
    loadingTitle = "Loading Your AniList Library";
  }

  return (
    <div className="container py-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <Card className="mx-auto w-full max-w-md text-center">
          <CardContent className="pt-6">
            <output
              className="mb-4 inline-block h-8 w-8 animate-spin rounded-full border-4 border-current border-t-transparent text-blue-600"
              aria-live="polite"
              aria-label="loading"
            >
              <span className="sr-only">Loading...</span>
            </output>
            <h3 className="text-lg font-medium">{loadingTitle}</h3>
            {type === "manga" ? (
              <p className="mt-2 text-sm text-slate-500">
                Please wait while we load your matched manga data...
              </p>
            ) : (
              !isRateLimited && (
                <p className="mt-2 text-sm text-slate-500">
                  {retryCount > 0
                    ? `Server error encountered. Retrying (${retryCount}/${maxRetries})...`
                    : "Please wait while we fetch your AniList library data for comparison..."}
                </p>
              )
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
