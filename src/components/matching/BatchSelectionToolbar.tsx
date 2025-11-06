/**
 * @packageDocumentation
 * @module BatchSelectionToolbar
 * @description Floating toolbar component for batch selection operations
 */
import React from "react";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../ui/tooltip";
import {
  CheckSquare,
  Check,
  X,
  RotateCcw,
  Loader2,
  XCircle,
} from "lucide-react";
import { motion } from "framer-motion";
import { Progress } from "../ui/progress";

/**
 * Props for the BatchSelectionToolbar component.
 * @property selectedCount - Number of currently selected matches.
 * @property onAccept - Callback to accept all selected matches.
 * @property onReject - Callback to reject all selected matches.
 * @property onReset - Callback to reset all selected matches to pending.
 * @property onClearSelection - Callback to clear current selection.
 * @property isProcessing - Optional flag indicating if a batch operation is in progress.
 * @property progress - Optional progress state with current and total counts.
 * @property onCancel - Optional callback to cancel the current batch operation.
 * @source
 */
export interface BatchSelectionToolbarProps {
  selectedCount: number;
  onAccept: () => void;
  onReject: () => void;
  onReset: () => void;
  onClearSelection: () => void;
  progress?: { current: number; total: number } | null;
  onCancel?: () => void;
  isBatchBusy?: boolean;
}

/**
 * Floating toolbar for batch selection operations on manga matches.
 * Displays selection count and provides action buttons to accept, reject, reset, or clear selections.
 * @param props - Component props including selection count and action callbacks.
 * @returns Rendered toolbar with animated entrance and accessibility features.
 * @source
 */
function BatchSelectionToolbarComponent({
  selectedCount,
  onAccept,
  onReject,
  onReset,
  onClearSelection,
  progress = null,
  onCancel,
  isBatchBusy = false,
}: Readonly<BatchSelectionToolbarProps>) {
  const progressPercent = progress
    ? Math.round((progress.current / progress.total) * 100)
    : 0;
  const isInProgress = progress !== null && progress.current < progress.total;
  // Keep buttons disabled if batch operation is in progress or cleanup is happening
  const isActuallyBusy = isInProgress || isBatchBusy;
  return (
    <div className="sticky top-4 z-50 mb-4 flex justify-center">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        transition={{ duration: 0.2 }}
        role="toolbar"
        aria-label="Batch selection actions"
        aria-orientation="horizontal"
      >
        {/* Selection count announcement */}
        <output className="sr-only" aria-live="polite" aria-atomic="true">
          {selectedCount} {selectedCount === 1 ? "item" : "items"} selected
        </output>

        <Card className="border-blue-400/40 bg-white/90 p-4 shadow-lg shadow-slate-900/10 backdrop-blur-md dark:border-blue-500/30 dark:bg-slate-900/90">
          <div className="flex flex-col items-center gap-4 sm:flex-row">
            {/* Selection Count Badge */}
            <div className="flex items-center gap-2 text-sm font-semibold text-blue-700 dark:text-blue-300">
              <CheckSquare className="h-4 w-4" />
              <span>
                {selectedCount} {selectedCount === 1 ? "match" : "matches"}{" "}
                selected
              </span>
            </div>

            {/* Progress Bar */}
            {progress !== null && (
              <div className="flex flex-col items-center gap-2">
                <Progress value={progressPercent} className="w-48" />
                <div className="text-xs text-slate-600 dark:text-slate-400">
                  {progress.current} / {progress.total} processed
                </div>
              </div>
            )}
            <div className="flex items-center gap-2">
              <TooltipProvider>
                {/* Accept Button */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="sm"
                      onClick={onAccept}
                      disabled={isActuallyBusy}
                      className="bg-emerald-500 text-white hover:bg-emerald-600 dark:bg-emerald-600 dark:hover:bg-emerald-700"
                      aria-label={`Accept ${selectedCount} selected ${selectedCount === 1 ? "match" : "matches"}`}
                    >
                      {isInProgress ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Check className="h-4 w-4" />
                      )}
                      <span className="hidden sm:inline">Accept Selected</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Accept all selected matches</p>
                  </TooltipContent>
                </Tooltip>

                {/* Reject Button */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="sm"
                      onClick={onReject}
                      disabled={isActuallyBusy}
                      className="bg-rose-500 text-white hover:bg-rose-600 dark:bg-rose-600 dark:hover:bg-rose-700"
                      aria-label={`Reject ${selectedCount} selected ${selectedCount === 1 ? "match" : "matches"}`}
                    >
                      {isInProgress ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <X className="h-4 w-4" />
                      )}
                      <span className="hidden sm:inline">Reject Selected</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Reject all selected matches</p>
                  </TooltipContent>
                </Tooltip>

                {/* Reset Button */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="sm"
                      onClick={onReset}
                      disabled={isActuallyBusy}
                      className="bg-orange-500 text-white hover:bg-orange-600 dark:bg-orange-600 dark:hover:bg-orange-700"
                      aria-label={`Reset ${selectedCount} selected ${selectedCount === 1 ? "match" : "matches"} to pending`}
                    >
                      {isInProgress ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <RotateCcw className="h-4 w-4" />
                      )}
                      <span className="hidden sm:inline">Reset Selected</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Reset all selected matches to pending</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>

            {/* Clear Selection Button */}
            {!isInProgress && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={onClearSelection}
                      disabled={false}
                      className="text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
                      aria-label="Clear selection"
                    >
                      <X className="h-4 w-4" />
                      <span className="hidden sm:inline">Clear</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Clear selection (Esc)</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}

            {/* Cancel Button */}
            {isInProgress && onCancel && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={onCancel}
                      className="text-rose-600 hover:text-rose-900 dark:text-rose-400 dark:hover:text-rose-100"
                      aria-label="Cancel batch operation"
                    >
                      <XCircle className="h-4 w-4" />
                      <span className="hidden sm:inline">Cancel</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Cancel operation</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
        </Card>
      </motion.div>
    </div>
  );
}

/**
 * Memoized BatchSelectionToolbar component to prevent unnecessary re-renders.
 * @source
 */
export const BatchSelectionToolbar = React.memo(BatchSelectionToolbarComponent);
