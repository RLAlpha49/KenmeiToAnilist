import React, { ReactNode } from "react";
import { MatchingProgress, TimeEstimate } from "../../types/matching";
import { formatTimeRemaining } from "../../utils/timeUtils";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from "../../components/ui/card";
import { Progress } from "../../components/ui/progress";
import { Button } from "../../components/ui/button";
import { Loader2, RotateCcw, AlertOctagon } from "lucide-react";
import { motion } from "framer-motion";

interface MatchingProgressProps {
  isCancelling: boolean;
  progress: MatchingProgress;
  statusMessage: string;
  detailMessage: ReactNode;
  timeEstimate: TimeEstimate;
  onCancelProcess: () => void;
  bypassCache?: boolean;
  freshSearch?: boolean;
  disableControls?: boolean;
}

export const MatchingProgressPanel: React.FC<MatchingProgressProps> = ({
  isCancelling,
  progress,
  statusMessage,
  detailMessage,
  timeEstimate,
  onCancelProcess,
  bypassCache,
  freshSearch,
  disableControls = false,
}) => {
  const progressPercent = progress.total
    ? Math.min(100, Math.round((progress.current / progress.total) * 100))
    : 0;

  return (
    <Card className="border-border/40 mb-8 overflow-hidden border shadow-md backdrop-blur-sm dark:bg-gray-800/60">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center justify-center gap-2 text-center text-2xl">
          {isCancelling ? (
            <>
              <AlertOctagon className="h-5 w-5 text-amber-500" />
              Cancelling...
            </>
          ) : (
            <>
              <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
              {statusMessage || "Matching your manga..."}
            </>
          )}
        </CardTitle>
        {detailMessage && (
          <CardDescription className="text-center text-base">
            {detailMessage}
          </CardDescription>
        )}
      </CardHeader>

      <CardContent className="space-y-6 pb-6">
        {/* Progress Bar - with animation */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>
              {progress.current} of {progress.total}
            </span>
            <span>{progressPercent}%</span>
          </div>
          <Progress value={progressPercent} className="h-3 w-full" />
        </div>

        {/* Time Estimate */}
        {progress.current > 0 && timeEstimate.estimatedRemainingSeconds > 0 && (
          <div className="bg-muted/50 rounded-lg p-3 text-center text-sm">
            <p className="font-medium">
              Estimated time remaining:{" "}
              <span className="text-primary">
                {formatTimeRemaining(timeEstimate.estimatedRemainingSeconds)}
              </span>
            </p>
          </div>
        )}

        {/* Current Manga Display */}
        {progress.currentTitle && (
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="bg-primary/5 rounded-lg p-4 text-center"
          >
            <p className="text-sm">
              Currently processing:{" "}
              <span className="text-primary font-semibold">
                {progress.currentTitle}
              </span>
            </p>
          </motion.div>
        )}

        {/* Cache indicator */}
        {(bypassCache || freshSearch) && (
          <div className="rounded-lg bg-blue-50 p-3 text-center text-sm dark:bg-blue-900/20">
            <p className="flex items-center justify-center gap-2 font-medium text-blue-700 dark:text-blue-300">
              <RotateCcw className="h-4 w-4 animate-spin" />
              Performing fresh searches from AniList
            </p>
          </div>
        )}
      </CardContent>

      <CardFooter className="flex justify-center pt-0 pb-6">
        <Button
          variant={isCancelling ? "outline" : "destructive"}
          size="lg"
          onClick={onCancelProcess}
          disabled={isCancelling || disableControls}
          className="w-full max-w-xs transition-all duration-200"
        >
          {isCancelling ? "Cancelling..." : "Cancel Process"}
        </Button>
      </CardFooter>
    </Card>
  );
};
