/**
 * @packageDocumentation
 * @module MatchImportExportSection
 * @description Match results import/export section for the Data tab.
 */

import React, { useRef } from "react";
import {
  Upload,
  Download,
  FileJson,
  AlertCircle,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/utils/tailwind";

/**
 * Props for MatchImportExportSection component.
 * @source
 */
interface MatchImportExportSectionProps {
  /** Currently selected match import file. */
  matchImportFile: File | null;
  /** Error message if match import file validation fails. */
  matchImportError: string | null;
  /** Whether match import is currently in progress. */
  isImportingMatches: boolean;
  /** Callback when user selects a match import file. */
  onMatchImportFileSelect: (event: React.ChangeEvent<HTMLInputElement>) => void;
  /** Callback to trigger match import with selected strategy. */
  onImportMatches: (
    file: File,
    strategy: "replace" | "merge" | "skip-duplicates",
  ) => void;
}

/**
 * Match import/export section component for the Data Management tab.
 * Provides file selection for match imports with strategy selection and export link.
 *
 * @param props - Component props.
 * @returns The rendered match import/export section.
 * @source
 */
export function MatchImportExportSection({
  matchImportFile,
  matchImportError,
  isImportingMatches,
  onMatchImportFileSelect,
  onImportMatches,
}: Readonly<MatchImportExportSectionProps>) {
  const [selectedStrategy, setSelectedStrategy] = React.useState<
    "replace" | "merge" | "skip-duplicates"
  >("merge");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImport = () => {
    if (!matchImportFile) return;

    onImportMatches(matchImportFile, selectedStrategy);
  };

  return (
    <div className="space-y-5">
      {/* Import Subsection */}
      <div className="space-y-3">
        <div>
          <h4 className="text-foreground text-sm font-semibold">Import</h4>
          <p className="text-muted-foreground text-xs">
            Import match results from a JSON file
          </p>
        </div>

        {/* File Upload Area */}
        <Card
          className={cn(
            "border-dashed transition-colors",
            matchImportFile
              ? "border-emerald-500/50 bg-emerald-50/30 dark:bg-emerald-950/10"
              : "border-slate-300 dark:border-slate-600",
          )}
        >
          <CardContent className="pt-6">
            <div className="space-y-3">
              {/* File Input */}
              <div className="flex items-center justify-center">
                <label className="cursor-pointer">
                  <div className="flex flex-col items-center gap-2 px-4 py-3">
                    <FileJson
                      className="h-8 w-8 text-slate-400 dark:text-slate-500"
                      aria-hidden="true"
                    />
                    <div className="text-center">
                      <p className="text-foreground text-sm font-medium">
                        Click to select or drag & drop
                      </p>
                      <p className="text-muted-foreground text-xs">
                        JSON files only
                      </p>
                    </div>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".json"
                    onChange={onMatchImportFileSelect}
                    className="hidden"
                    aria-label="Select match import file"
                  />
                </label>
              </div>

              {/* Selected File Display */}
              {matchImportFile && (
                <div className="flex items-center justify-between rounded-md bg-white/50 p-2 dark:bg-slate-950/50">
                  <div className="flex min-w-0 items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                    <span className="text-foreground truncate text-sm">
                      {matchImportFile.name}
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      if (fileInputRef.current) {
                        fileInputRef.current.value = "";
                      }
                    }}
                    className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                  >
                    Clear
                  </button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Error Message */}
        {matchImportError && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{matchImportError}</AlertDescription>
          </Alert>
        )}

        {/* Import Strategy Selection */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Import Strategy</Label>
          <RadioGroup
            value={selectedStrategy}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            onValueChange={(value: any) => setSelectedStrategy(value)}
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="replace" id="strategy-replace" />
              <Label
                htmlFor="strategy-replace"
                className="cursor-pointer font-normal"
              >
                <span className="font-medium">Replace</span>
                <span className="text-muted-foreground ml-1 text-xs">
                  - Remove all existing matches and import new ones
                </span>
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="merge" id="strategy-merge" />
              <Label
                htmlFor="strategy-merge"
                className="cursor-pointer font-normal"
              >
                <span className="font-medium">Merge</span>
                <span className="text-muted-foreground ml-1 text-xs">
                  - Add imported matches to existing ones
                </span>
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="skip-duplicates" id="strategy-skip" />
              <Label
                htmlFor="strategy-skip"
                className="cursor-pointer font-normal"
              >
                <span className="font-medium">Skip Duplicates</span>
                <span className="text-muted-foreground ml-1 text-xs">
                  - Merge but skip matches already present (by ID)
                </span>
              </Label>
            </div>
          </RadioGroup>
        </div>

        {/* Import Button */}
        <Button
          onClick={handleImport}
          disabled={!matchImportFile || isImportingMatches}
          className="w-full"
          variant="default"
        >
          {isImportingMatches && (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          )}
          {isImportingMatches ? (
            "Importing..."
          ) : (
            <>
              <Upload className="mr-2 h-4 w-4" />
              Import Matches
            </>
          )}
        </Button>
      </div>

      {/* Export Subsection */}
      <div className="space-y-3 border-t border-slate-200 pt-3 dark:border-slate-700">
        <div>
          <h4 className="text-foreground text-sm font-semibold">Export</h4>
          <p className="text-muted-foreground text-xs">
            Export your matches for backup or sharing
          </p>
        </div>

        <Button variant="outline" className="w-full" disabled>
          <Download className="mr-2 h-4 w-4" />
          Export Matches (via Matching Page)
        </Button>

        <p className="text-muted-foreground text-center text-xs">
          Go to the Matching page to export with advanced options (field
          selection, formatting)
        </p>
      </div>
    </div>
  );
}
