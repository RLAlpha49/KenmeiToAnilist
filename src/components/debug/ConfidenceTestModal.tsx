import React, { useState } from "react";
import { Check, Copy, AlertCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/Tooltip";
import { generateConfidenceTestCommand } from "@/utils/generate-confidence-test-command";
import type { MangaMatchResult } from "@/api/anilist/types";

// Declare ElectronClipboard interface for type checking
interface ElectronClipboard {
  writeText: (text: string) => Promise<void>;
}

interface ConfidenceTestModalProps {
  readonly match: MangaMatchResult;
}

export function ConfidenceTestModal({
  match,
}: Readonly<ConfidenceTestModalProps>): React.ReactNode {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [copiedFormat, setCopiedFormat] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const firstMatch = match.anilistMatches?.[0];

  const handleCopy = async (event: React.MouseEvent) => {
    event.stopPropagation();
    event.preventDefault();

    try {
      setError(null);
      const testCmd = generateConfidenceTestCommand(match);
      const text = testCmd.command;

      // Use Electron's clipboard API via IPC bridge
      if (
        globalThis.window !== undefined &&
        "electronClipboard" in globalThis &&
        typeof (globalThis as unknown as Record<string, unknown>)
          .electronClipboard === "object"
      ) {
        const clipboard = (
          globalThis as unknown as Record<string, ElectronClipboard>
        ).electronClipboard;
        await clipboard.writeText(text);
      } else if (
        navigator.clipboard &&
        typeof navigator.clipboard.writeText === "function"
      ) {
        // Fallback to modern Clipboard API for non-Electron environments
        await navigator.clipboard.writeText(text);
      } else {
        // Last resort: execCommand fallback
        const textArea = document.createElement("textarea");
        textArea.value = text;
        textArea.style.position = "fixed";
        textArea.style.left = "0";
        textArea.style.top = "0";
        textArea.style.opacity = "0";
        textArea.style.pointerEvents = "none";
        document.body.appendChild(textArea);

        try {
          textArea.focus();
          textArea.select();
          const successful = (
            document as { execCommand(command: string): boolean }
          ).execCommand("copy");
          if (!successful) {
            throw new Error("execCommand failed");
          }
        } finally {
          textArea.remove();
        }
      }

      setCopiedFormat("command");
      setTimeout(() => setCopiedFormat(null), 2000);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      setError(errorMessage);
      setTimeout(() => setError(null), 3000);
    }
  };

  if (!firstMatch) {
    return null;
  }

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
              <AlertCircle className="h-4 w-4" />
              Error
            </Button>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs">{error}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="gap-1 text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
          title="View confidence test details"
        >
          <Copy className="h-4 w-4" />
          Confidence Test Command
        </Button>
      </DialogTrigger>
      <DialogContent className="lg:min-w-3xl md:min-w-2xl sm:min-w-xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Confidence Test Command</DialogTitle>
        </DialogHeader>

        <div className="mt-4">
          <div className="space-y-3">
              <div>
                <div className="mb-3 rounded-lg border border-slate-200 bg-slate-50 p-3 font-mono text-sm dark:border-slate-700 dark:bg-slate-900">
                  <code className="break-all text-slate-900 dark:text-slate-100">
                    {generateConfidenceTestCommand(match).command}
                  </code>
                </div>
                <div className="flex gap-2">
                  {copiedFormat === "command" ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="flex-1 gap-1 text-emerald-600 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-500/10"
                      disabled
                    >
                      <Check className="h-4 w-4" />
                      Copied!
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleCopy}
                      className="flex-1 gap-1"
                    >
                      <Copy className="h-4 w-4" />
                      Copy Command
                    </Button>
                  )}
                </div>
              </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setIsModalOpen(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
