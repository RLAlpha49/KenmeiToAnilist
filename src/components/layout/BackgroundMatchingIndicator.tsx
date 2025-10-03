/**
 * @packageDocumentation
 * @module BackgroundMatchingIndicator
 * @description A floating indicator that shows when manga matching is happening in the background on other pages.
 */

import React, { useState, useEffect } from "react";
import { useLocation, useNavigate } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, ChevronDown, ChevronUp, Search } from "lucide-react";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { Progress } from "../ui/progress";

/**
 * A floating indicator component that displays background matching progress when user is not on the matching page.
 *
 * @returns The rendered background matching indicator or null if not applicable.
 * @source
 */
export function BackgroundMatchingIndicator() {
  const location = useLocation();
  const navigate = useNavigate();
  const [isExpanded, setIsExpanded] = useState(false);
  const [matchingState, setMatchingState] = useState<{
    isRunning: boolean;
    current: number;
    total: number;
    currentTitle: string;
    statusMessage: string;
    estimatedRemainingSeconds?: number;
    averageTimePerManga?: number;
  } | null>(null);

  // Get current pathname
  function getPathname(loc: unknown): string {
    if (typeof loc !== "object" || loc === null) return "/";

    const keyPaths: Array<string[]> = [
      ["pathname"],
      ["current", "pathname"],
      ["current", "location", "pathname"],
      ["location", "pathname"],
    ];

    for (const path of keyPaths) {
      let cur: unknown = loc;
      let i = 0;
      while (i < path.length && typeof cur === "object" && cur !== null) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        cur = (cur as any)[path[i]];
        i += 1;
      }
      if (typeof cur === "string") return cur;
    }

    return "/";
  }

  const pathname = getPathname(location);
  const isOnMatchingPage = pathname === "/review";

  // Poll for matching state updates
  useEffect(() => {
    const updateState = () => {
      if (globalThis.matchingProcessState?.isRunning) {
        const state = globalThis.matchingProcessState;
        setMatchingState({
          isRunning: true,
          current: state.progress.current,
          total: state.progress.total,
          currentTitle: state.progress.currentTitle,
          statusMessage: state.statusMessage,
          estimatedRemainingSeconds:
            state.timeEstimate?.estimatedRemainingSeconds,
          averageTimePerManga: state.timeEstimate?.averageTimePerManga,
        });
      } else {
        setMatchingState(null);
      }
    };

    // Initial update
    updateState();

    // Poll every second for updates
    const interval = setInterval(updateState, 1000);

    return () => clearInterval(interval);
  }, []);

  // Don't show if not matching or if on the matching page
  if (!matchingState?.isRunning || isOnMatchingPage) {
    return null;
  }

  const progressPercent =
    matchingState.total > 0
      ? Math.round((matchingState.current / matchingState.total) * 100)
      : 0;

  const formatTime = (seconds: number | undefined): string => {
    if (!seconds || seconds <= 0) return "calculating...";
    if (seconds < 60) return `${Math.round(seconds)}s`;
    if (seconds < 3600) {
      const mins = Math.floor(seconds / 60);
      const secs = Math.round(seconds % 60);
      return `${mins}m ${secs}s`;
    }
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${mins}m`;
  };

  return (
    <AnimatePresence>
      <motion.div
        className="fixed top-20 right-4 z-50 w-80"
        initial={{ opacity: 0, y: -20, x: 50 }}
        animate={{ opacity: 1, y: 0, x: 0 }}
        exit={{ opacity: 0, y: -20, x: 50 }}
        transition={{ duration: 0.3 }}
      >
        <Card className="border-primary/20 bg-background/95 shadow-lg backdrop-blur-md">
          {/* Header - Always visible */}
          <div className="flex items-center justify-between p-3">
            <div className="flex items-center gap-2">
              <Loader2 className="text-primary h-4 w-4 animate-spin" />
              <span className="text-sm font-medium">Matching in Progress</span>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={() => navigate({ to: "/review" })}
                title="Go to matching page"
              >
                <Search className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={() => setIsExpanded(!isExpanded)}
                title={isExpanded ? "Collapse" : "Expand"}
              >
                {isExpanded ? (
                  <ChevronUp className="h-3.5 w-3.5" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5" />
                )}
              </Button>
            </div>
          </div>

          {/* Compact progress bar - Always visible */}
          <div className="px-3 pb-3">
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="text-muted-foreground">
                {matchingState.current} / {matchingState.total}
              </span>
              <span className="text-muted-foreground font-medium">
                {progressPercent}%
              </span>
            </div>
            <Progress value={progressPercent} className="h-2" />
          </div>

          {/* Expandable details */}
          <AnimatePresence>
            {isExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden border-t"
              >
                <div className="space-y-2 p-3">
                  {/* Current manga being matched */}
                  {matchingState.currentTitle && (
                    <div className="space-y-1">
                      <div className="text-muted-foreground text-xs font-medium">
                        Currently Matching:
                      </div>
                      <div className="text-foreground truncate text-sm">
                        {matchingState.currentTitle}
                      </div>
                    </div>
                  )}

                  {/* Status message */}
                  {matchingState.statusMessage && (
                    <div className="space-y-1">
                      <div className="text-muted-foreground text-xs font-medium">
                        Status:
                      </div>
                      <div className="text-muted-foreground text-xs">
                        {matchingState.statusMessage}
                      </div>
                    </div>
                  )}

                  {/* Time estimates */}
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <div className="space-y-1">
                      <div className="text-muted-foreground text-xs">
                        Remaining:
                      </div>
                      <div className="text-foreground text-sm font-medium">
                        {formatTime(matchingState.estimatedRemainingSeconds)}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <div className="text-muted-foreground text-xs">
                        Avg per manga:
                      </div>
                      <div className="text-foreground text-sm font-medium">
                        {matchingState.averageTimePerManga
                          ? formatTime(matchingState.averageTimePerManga)
                          : "calculating..."}
                      </div>
                    </div>
                  </div>

                  {/* View button */}
                  <Button
                    variant="default"
                    size="sm"
                    className="mt-2 w-full"
                    onClick={() => navigate({ to: "/review" })}
                  >
                    <Search className="mr-2 h-3.5 w-3.5" />
                    View Matching Progress
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </Card>
      </motion.div>
    </AnimatePresence>
  );
}
