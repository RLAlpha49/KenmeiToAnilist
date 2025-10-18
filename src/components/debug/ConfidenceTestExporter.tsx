/**
 * @packageDocumentation
 * @module ConfidenceTestExporter
 * @description Component for exporting confidence test commands from match cards (debug feature)
 */

import React, { useState } from "react";
import { Copy, Check, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { MangaMatchResult } from "@/api/anilist/types";
import {
  generateConfidenceTestCommand,
  copyToClipboard,
} from "@/utils/generateConfidenceTestCommand";

export interface ConfidenceTestExporterProps {
  match: MangaMatchResult;
}

/**
 * Component that provides a button to view and copy a confidence test command
 * for debugging and bug reporting purposes.
 *
 * The test command allows users to reproduce the confidence calculation locally
 * using the npm test:confidence script.
 *
 * @param match - The manga match result to generate a test command for
 * @returns Button component with export functionality
 * @source
 */
export function ConfidenceTestExporter({
  match,
}: Readonly<ConfidenceTestExporterProps>): React.ReactNode {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCopyCommand = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    try {
      setError(null);
      const testCmd = generateConfidenceTestCommand(match);
      await copyToClipboard(testCmd.command);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      setError(errorMessage);
      setTimeout(() => setError(null), 3000);
    }
  };

  const handleShowCommand = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    try {
      setError(null);
      const testCmd = generateConfidenceTestCommand(match);
      // Show in browser console for visibility
      console.log("[Confidence Test Command]", testCmd.command);
      console.log("[Description]", testCmd.description);
      alert(`Test Command:\n\n${testCmd.command}`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      setError(errorMessage);
    }
  };

  if (error) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="gap-1 text-amber-600 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-500/10"
              title={error}
            >
              <AlertTriangle className="h-4 w-4" />
              Error
            </Button>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs">{error}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  if (copied) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="gap-1 text-emerald-600 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-500/10"
              disabled
            >
              <Check className="h-4 w-4" />
              Copied!
            </Button>
          </TooltipTrigger>
          <TooltipContent>Test command copied to clipboard</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <div className="flex gap-1">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="gap-1 text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
              onClick={handleShowCommand}
              title="Show test command"
            >
              <AlertTriangle className="h-4 w-4" />
              Show
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            Show the npm test:confidence command for this match
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="gap-1 text-indigo-600 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-500/10"
              onClick={handleCopyCommand}
              title="Copy test command to clipboard"
            >
              <Copy className="h-4 w-4" />
              Copy
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            Copy test command to clipboard for bug reports
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}

export default ConfidenceTestExporter;
