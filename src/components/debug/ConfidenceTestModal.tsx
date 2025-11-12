import type React from "react";
import { useState } from "react";
import { Check, Copy, AlertCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ConfidenceTestResults } from "./ConfidenceTestResults";
import { generateConfidenceTestCommand } from "@/utils/generateConfidenceTestCommand";
import type { MangaMatchResult } from "@/api/anilist/types";

interface ConfidenceTestModalProps {
  readonly match: MangaMatchResult;
}

export function ConfidenceTestModal({
  match,
}: Readonly<ConfidenceTestModalProps>): React.ReactNode {
  const [open, setOpen] = useState(false);
  const [copiedFormat, setCopiedFormat] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const searchTitle = match.kenmeiManga.title;
  const firstMatch = match.anilistMatches?.[0];

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    try {
      setError(null);
      const testCmd = generateConfidenceTestCommand(match);
      const text = testCmd.command;

      // Use Electron's clipboard API via IPC bridge
      if (
        typeof window !== "undefined" &&
        "electronClipboard" in window &&
        typeof (window as unknown as Record<string, unknown>)
          .electronClipboard === "object"
      ) {
        const clipboard = (window as unknown as Record<string, unknown>)
          .electronClipboard as ElectronClipboard;
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
          const successful = document.execCommand("copy");
          if (!successful) {
            throw new Error("execCommand failed");
          }
        } finally {
          document.body.removeChild(textArea);
        }
      }

      setCopiedFormat("command");
      setTimeout(() => setCopiedFormat(null), 2000);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      setError(errorMessage);
      setTimeout(() => setError(null), 3000);
    }
  };

  if (!firstMatch) {
    return null;
  }

  const candidateTitle =
    firstMatch.manga.title.english || firstMatch.manga.title.romaji || "";
  const candidateRomaji = firstMatch.manga.title.romaji || "";
  const candidateNative = firstMatch.manga.title.native || "";

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
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="gap-1 text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
          title="View confidence test details"
        >
          <Copy className="h-4 w-4" />
          Confidence Details
        </Button>
      </DialogTrigger>
      <DialogContent className="lg:min-w-3xl md:min-w-2xl sm:min-w-xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Confidence Test Results</DialogTitle>
          <DialogDescription>
            Detailed breakdown of the match confidence calculation
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="results" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="results">Results</TabsTrigger>
            <TabsTrigger value="commands">Commands</TabsTrigger>
          </TabsList>

          <TabsContent value="results" className="mt-4">
            <ConfidenceTestResults
              match={firstMatch}
              searchTitle={searchTitle}
              candidateTitle={candidateTitle}
              candidateRomaji={candidateRomaji}
              candidateNative={candidateNative}
            />
          </TabsContent>

          <TabsContent value="commands" className="mt-4">
            <div className="space-y-3">
              <div>
                <h3 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-300">
                  Test Command
                </h3>
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
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
