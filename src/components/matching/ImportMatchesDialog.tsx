/**
 * @packageDocumentation
 * @module ImportMatchesDialog
 * @description Dialog component for importing match results with file picker, preview, and merge strategy selection.
 */

import React, { useState, useCallback } from "react";
import { Upload, AlertCircle, CheckCircle2, Info } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../ui/alert-dialog";
import { Alert, AlertDescription } from "../ui/alert";
import {
  getImportPreview,
  importMatchResults,
  ImportMergeStrategy,
} from "../../utils/exportUtils";

/**
 * Props for ImportMatchesDialog component.
 * @property open - Dialog open state.
 * @property onOpenChange - Callback for open state changes.
 * @property onImportComplete - Callback after successful import with statistics.
 * @source
 */
export interface ImportMatchesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportComplete: (result: {
    imported: number;
    merged: number;
    skipped: number;
  }) => void;
}

/**
 * Import preview statistics.
 * @source
 */
interface ImportPreview {
  totalCount: number;
  newCount: number;
  duplicateCount: number;
  conflictCount: number;
  validationErrors: string[];
  validationWarnings: string[];
}

/**
 * Dialog component for importing match results with file picker, preview, and merge strategy selection.
 * Supports three merge strategies: Replace, Merge (preserve existing), and Skip Duplicates.
 * @param props - Component props.
 * @returns ImportMatchesDialog component.
 * @source
 */
const ImportMatchesDialog: React.FC<ImportMatchesDialogProps> = ({
  open,
  onOpenChange,
  onImportComplete,
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(
    null,
  );
  const [mergeStrategy, setMergeStrategy] =
    useState<ImportMergeStrategy>("merge");
  const [isValidating, setIsValidating] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  /**
   * Handles file selection and triggers validation/preview.
   */
  const handleFileChange = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      setSelectedFile(file);
      setValidationErrors([]);
      setImportPreview(null);

      // Validate and get preview
      setIsValidating(true);
      try {
        const preview = await getImportPreview(file);
        setImportPreview(preview);

        if (preview.validationErrors.length > 0) {
          setValidationErrors(preview.validationErrors);
        }
      } catch (error) {
        // Handle AppError or generic Error
        const errorMsg =
          error && typeof error === "object" && "message" in error
            ? (error as { message: string }).message
            : "Unknown error during validation";
        setValidationErrors([errorMsg]);
      } finally {
        setIsValidating(false);
      }
    },
    [],
  );

  /**
   * Handles the import action.
   */
  const handleImport = useCallback(async () => {
    if (!selectedFile) {
      toast.error("No file selected");
      return;
    }

    setIsImporting(true);
    try {
      const result = await importMatchResults(selectedFile, {
        strategy: mergeStrategy,
      });

      toast.success(
        `Successfully imported ${result.imported} matches (${result.merged} merged, ${result.skipped} skipped)`,
      );

      onImportComplete({
        imported: result.imported,
        merged: result.merged,
        skipped: result.skipped,
      });

      // Reset and close dialog
      setSelectedFile(null);
      setImportPreview(null);
      setValidationErrors([]);
      onOpenChange(false);
    } catch (error) {
      // Handle AppError or generic Error
      const errorMsg =
        error && typeof error === "object" && "message" in error
          ? (error as { message: string }).message
          : "Unknown error during import";
      toast.error(errorMsg);
    } finally {
      setIsImporting(false);
    }
  }, [selectedFile, mergeStrategy, onImportComplete, onOpenChange]);

  /**
   * Resets dialog state when closing.
   */
  const handleOpenChange = useCallback(
    (newOpen: boolean) => {
      if (!newOpen) {
        setSelectedFile(null);
        setImportPreview(null);
        setValidationErrors([]);
      }
      onOpenChange(newOpen);
    },
    [onOpenChange],
  );

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent className="max-w-2xl">
        <AlertDialogHeader>
          <AlertDialogTitle>Import Match Results</AlertDialogTitle>
          <AlertDialogDescription>
            Import previously exported match results to merge with your current
            data. Only JSON format is supported.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-4 py-4">
          {/* File Picker Section */}
          <div className="space-y-2">
            <label
              htmlFor="import-file"
              className="text-foreground block text-sm font-medium"
            >
              Select Import File
            </label>
            <div className="flex w-full items-center justify-center">
              <label
                htmlFor="import-file"
                className="border-muted-foreground/30 bg-muted/20 hover:bg-muted/40 flex h-32 w-full cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed transition-colors"
              >
                <div className="flex flex-col items-center justify-center pb-6 pt-5">
                  <Upload className="text-muted-foreground mb-2 h-8 w-8" />
                  <p className="text-muted-foreground text-sm">
                    {selectedFile
                      ? `Selected: ${selectedFile.name}`
                      : "Click to select JSON file or drag and drop"}
                  </p>
                </div>
                <input
                  id="import-file"
                  type="file"
                  accept=".json"
                  onChange={handleFileChange}
                  disabled={isValidating || isImporting}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          {/* Validation Errors */}
          {validationErrors.length > 0 && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <p className="mb-2 font-medium">Validation Errors:</p>
                <ul className="list-inside list-disc space-y-1 text-sm">
                  {validationErrors.map((error) => (
                    <li key={error}>{error}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          {/* Preview Section */}
          {importPreview && validationErrors.length === 0 && (
            <div className="space-y-3">
              <div className="bg-muted/40 space-y-3 rounded-lg p-4">
                <div className="flex items-start gap-2">
                  <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
                  <div className="space-y-1 text-sm">
                    <p className="font-medium">Import Preview</p>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <div>
                        <span className="text-muted-foreground">
                          Total Matches:
                        </span>
                        <p className="font-semibold">
                          {importPreview.totalCount}
                        </p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">
                          New Matches:
                        </span>
                        <p className="font-semibold text-green-600">
                          {importPreview.newCount}
                        </p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">
                          Duplicates:
                        </span>
                        <p className="font-semibold">
                          {importPreview.duplicateCount}
                        </p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">
                          Conflicts:
                        </span>
                        <p className="font-semibold text-orange-600">
                          {importPreview.conflictCount}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Warnings */}
              {importPreview.validationWarnings.length > 0 && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <p className="mb-2 font-medium">Warnings:</p>
                    <ul className="list-inside list-disc space-y-1 text-sm">
                      {importPreview.validationWarnings
                        .slice(0, 5)
                        .map((warning) => (
                          <li key={warning}>{warning}</li>
                        ))}
                      {importPreview.validationWarnings.length > 5 && (
                        <li>
                          ... and {importPreview.validationWarnings.length - 5}{" "}
                          more
                        </li>
                      )}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}

              {/* Merge Strategy Selection */}
              <fieldset className="space-y-2">
                <legend className="text-foreground block text-sm font-medium">
                  Merge Strategy
                </legend>
                <div className="space-y-2">
                  <label className="hover:bg-muted/50 flex cursor-pointer items-center gap-3 rounded-lg border p-3">
                    <input
                      type="radio"
                      name="strategy"
                      value="replace"
                      checked={mergeStrategy === "replace"}
                      onChange={(e) =>
                        setMergeStrategy(e.target.value as ImportMergeStrategy)
                      }
                      className="h-4 w-4"
                      aria-label="Replace all existing matches"
                    />
                    <div>
                      <p className="font-medium">Replace All</p>
                      <p className="text-muted-foreground text-sm">
                        Overwrite all existing matches with imported data
                      </p>
                    </div>
                  </label>

                  <label className="hover:bg-muted/50 bg-muted/20 flex cursor-pointer items-center gap-3 rounded-lg border p-3">
                    <input
                      type="radio"
                      name="strategy"
                      value="merge"
                      checked={mergeStrategy === "merge"}
                      onChange={(e) =>
                        setMergeStrategy(e.target.value as ImportMergeStrategy)
                      }
                      className="h-4 w-4"
                      aria-label="Merge with existing matches"
                    />
                    <div>
                      <p className="font-medium">
                        Merge (Recommended)
                        <CheckCircle2 className="ml-2 inline h-4 w-4 text-green-600" />
                      </p>
                      <p className="text-muted-foreground text-sm">
                        Combine with existing matches, preserving your
                        selections
                      </p>
                    </div>
                  </label>

                  <label className="hover:bg-muted/50 flex cursor-pointer items-center gap-3 rounded-lg border p-3">
                    <input
                      type="radio"
                      name="strategy"
                      value="skip-duplicates"
                      checked={mergeStrategy === "skip-duplicates"}
                      onChange={(e) =>
                        setMergeStrategy(e.target.value as ImportMergeStrategy)
                      }
                      className="h-4 w-4"
                      aria-label="Skip duplicate entries"
                    />
                    <div>
                      <p className="font-medium">Skip Duplicates</p>
                      <p className="text-muted-foreground text-sm">
                        Only import new manga not in your current results
                      </p>
                    </div>
                  </label>
                </div>
              </fieldset>
            </div>
          )}

          {isValidating && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>Validating file...</AlertDescription>
            </Alert>
          )}
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isImporting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleImport}
            disabled={
              !selectedFile ||
              validationErrors.length > 0 ||
              isValidating ||
              isImporting
            }
          >
            {isImporting ? "Importing..." : "Import"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default ImportMatchesDialog;
