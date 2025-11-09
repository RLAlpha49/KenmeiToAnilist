/**
 * @packageDocumentation
 * @module FileDropZone
 * @description React component for uploading and parsing Kenmei CSV export files via drag-and-drop or file selection. Handles validation, progress, and error reporting.
 */
import React, { useState, useRef } from "react";
import { UploadCloud, File, FileText } from "lucide-react";
import { Button } from "../ui/button";
import { KenmeiData } from "../../types/kenmei";
import {
  createError,
  ErrorType,
  ErrorRecoveryAction,
  AppError,
  CancelledError,
} from "../../utils/errorHandling";
import { getCSVWorkerPool } from "../../workers/csv-worker-pool";
import { Progress } from "../ui/progress";

/**
 * Props for the FileDropZone component.
 * @property onFileLoaded - Callback invoked with parsed KenmeiData when file is successfully loaded and parsed.
 * @property onError - Callback invoked with an AppError if file loading or parsing fails.
 * @internal
 * @source
 */
export interface FileDropZoneProps {
  onFileLoaded: (data: KenmeiData) => void;
  onError: (error: AppError) => void;
}

/**
 * FileDropZone component for uploading and parsing Kenmei CSV export files.
 * Provides drag-and-drop and file selection UI, validates file type and size, parses CSV, and reports progress and errors.
 * @param props - Component props.
 * @returns React element displaying file upload interface.
 * @source
 */
export function FileDropZone({
  onFileLoaded,
  onError,
}: Readonly<FileDropZoneProps>) {
  const [isDragging, setIsDragging] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileSize, setFileSize] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [currentTaskId, setCurrentTaskId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(
    null,
  );

  /**
   * Handles drag-over event to highlight drop zone.
   * @source
   */
  const handleDragOver = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  /**
   * Handles drag-leave event to reset drop zone highlight.
   * @source
   */
  const handleDragLeave = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  /**
   * Handles file drop event and delegates to processFile.
   * @param e - Drag event.
   * @source
   */
  const handleDrop = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      processFile(file);
    }
  };

  /**
   * Handles file selection from input element and delegates to processFile.
   * @param e - Change event from file input.
   * @source
   */
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      // Reset state on new file selection
      resetState();
      processFile(file);
    }
  };

  /**
   * Validates and processes a file for CSV parsing.
   * Validates file type (.csv), size (max 10MB), and parses content using worker pool.
   * Calls onFileLoaded or onError callback based on result.
   * Falls back to main thread for small files.
   * @param file - File object to process.
   * @source
   */
  const processFile = async (file: File) => {
    // Clear any existing progress interval
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }

    setFileName(file.name);
    setFileSize(file.size);
    setIsLoading(true);
    setLoadingProgress(0);

    // Simulate progress increment for better UX
    progressIntervalRef.current = setInterval(() => {
      setLoadingProgress((prev) => {
        // Cap progress at 80% until file is fully processed
        return prev < 80 ? prev + 10 : 80;
      });
    }, 500);

    try {
      // Validate file type
      if (!file.name.toLowerCase().endsWith(".csv")) {
        throw new Error("Invalid file format. Please upload a CSV file.");
      }

      // Check file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        throw new Error("File is too large. Maximum size is 10MB.");
      }

      // Read file content
      const content = await file.text();

      // Use CSV worker pool for parsing
      const workerPool = getCSVWorkerPool({
        enableWorkers: true,
        fallbackToMainThread: true,
      });

      // Clear simulated progress, now use worker progress
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
      setLoadingProgress(90);

      // Parse using worker pool with progress callback and store taskId for cancellation
      const { taskId, promise } = workerPool.startParsing(
        content,
        { defaultStatus: "plan_to_read" as const },
        (progress) => {
          // Update progress bar based on worker progress (byte-based)
          if (progress.payload.processedBytes && progress.payload.totalBytes) {
            const byteProgress =
              (progress.payload.processedBytes / progress.payload.totalBytes) *
              100;
            const clampedProgress = Math.min(100, Math.max(0, byteProgress));
            setLoadingProgress(clampedProgress);
          }
        },
      );

      // Store taskId for potential cancellation
      setCurrentTaskId(taskId);

      const { manga, stats: _stats } = await promise;

      if (!manga || manga.length === 0) {
        throw new Error(
          "No manga entries found in the CSV file. Please check the file format.",
        );
      }

      const kenmeiData: KenmeiData = {
        version: "1.0.0",
        exported_at: new Date().toISOString(),
        manga: manga.map((item) => ({
          title: item.title,
          status: item.status,
          score: item.score,
          chapters_read: item.chapters_read,
          volumes_read: item.volumes_read,
          created_at: item.created_at,
          updated_at: item.updated_at,
          last_read_at: item.last_read_at,
          notes: item.notes,
          url: item.url,
        })),
      };

      setLoadingProgress(100);
      setIsLoading(false);
      onFileLoaded(kenmeiData);
    } catch (err) {
      console.error("CSV parsing error:", err);

      // Handle cancellation silently without error callback
      if (err instanceof CancelledError) {
        setIsLoading(false);
        return;
      }

      setIsLoading(false);

      // Build error based on error type
      let appError: AppError;
      if (err instanceof Error) {
        switch (err.message) {
          case "Invalid file format. Please upload a CSV file.":
            appError = createError(
              ErrorType.VALIDATION,
              err.message,
              undefined,
              "INVALID_FORMAT",
              ErrorRecoveryAction.NONE,
              "Please export a fresh CSV file from Kenmei and try again. Ensure you're using the latest Kenmei version.",
            );
            break;
          case "File is too large. Maximum size is 10MB.":
            appError = createError(
              ErrorType.VALIDATION,
              err.message,
              undefined,
              "FILE_TOO_LARGE",
              ErrorRecoveryAction.NONE,
              "Try exporting a smaller date range from Kenmei, or split your library into multiple imports.",
            );
            break;
          case "No manga entries found in the CSV file. Please check the file format.":
            appError = createError(
              ErrorType.VALIDATION,
              err.message,
              undefined,
              "NO_ENTRIES",
              ErrorRecoveryAction.NONE,
              "Verify your CSV contains manga data. Check the export settings in Kenmei.",
            );
            break;
          default:
            appError = createError(
              ErrorType.VALIDATION,
              "Failed to parse CSV file. Please ensure it's a valid Kenmei export file.",
              err,
              "PARSE_FAILED",
              ErrorRecoveryAction.NONE,
              "Ensure the file is UTF-8 encoded and hasn't been modified. Re-export from Kenmei if needed.",
            );
        }
      } else {
        appError = createError(
          ErrorType.VALIDATION,
          "Failed to parse CSV file. Please ensure it's a valid Kenmei export file.",
          err,
          "PARSE_FAILED",
          ErrorRecoveryAction.NONE,
          "Ensure the file is UTF-8 encoded and hasn't been modified. Re-export from Kenmei if needed.",
        );
      }

      onError(appError);
    } finally {
      // Ensure interval is cleared in all cases
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
      // Clear task ID as parsing is complete or failed
      setCurrentTaskId(null);
    }
  };

  /**
   * Formats file size in bytes to human-readable string.
   * @param bytes - File size in bytes.
   * @returns Formatted string (e.g., "1.5 MB", "256 KB").
   * @source
   */
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + " bytes";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  /**
   * Resets component state when new file is selected.
   * Clears previous file information and progress state.
   * @source
   */
  const resetState = () => {
    setFileName(null);
    setFileSize(null);
    setIsLoading(false);
    setLoadingProgress(0);
    setCurrentTaskId(null);
    // Clear any existing progress interval
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
  };

  return (
    <label
      htmlFor="file-input"
      aria-label="Upload Kenmei CSV Export - Click to select file or drag and drop"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`relative flex min-h-[200px] cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed transition-all ${
        isDragging
          ? "border-primary/50 bg-primary/5"
          : "border-border/50 hover:border-primary/30 hover:bg-muted/50"
      }`}
    >
      <input
        id="file-input"
        ref={fileInputRef}
        type="file"
        accept=".csv"
        className="hidden"
        onChange={handleFileSelect}
        data-onboarding="file-input"
      />

      {fileName ? (
        // File selected state
        <div className="flex w-full flex-col items-center p-6 text-center">
          {isLoading ? (
            <div className="w-full max-w-md space-y-4">
              <div className="flex items-center justify-center">
                <div className="bg-primary/20 mr-3 h-10 w-10 animate-pulse rounded-full">
                  <File className="text-primary/50 h-10 w-10" />
                </div>
                <div className="text-left">
                  <h3 className="text-sm font-medium">{fileName}</h3>
                  <p className="text-muted-foreground text-xs">
                    {fileSize && formatFileSize(fileSize)}
                  </p>
                </div>
              </div>
              <div className="space-y-2">
                <Progress value={loadingProgress} className="h-1.5 w-full" />
                <p className="text-muted-foreground text-xs">
                  Processing file...
                </p>
              </div>
              {currentTaskId && (
                <Button
                  size="sm"
                  variant="outline"
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    const workerPool = getCSVWorkerPool({
                      enableWorkers: true,
                      fallbackToMainThread: true,
                    });
                    workerPool.cancelTask(currentTaskId);
                    // Clear loading state
                    if (progressIntervalRef.current) {
                      clearInterval(progressIntervalRef.current);
                      progressIntervalRef.current = null;
                    }
                    setIsLoading(false);
                    setLoadingProgress(0);
                    setCurrentTaskId(null);
                  }}
                >
                  Cancel
                </Button>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center">
              <div className="bg-primary/10 mb-4 flex h-16 w-16 items-center justify-center rounded-full">
                <File className="text-primary h-8 w-8" />
              </div>
              <h3 className="mb-1 text-lg font-medium">{fileName}</h3>
              <p className="text-muted-foreground mb-4 text-sm">
                {fileSize && formatFileSize(fileSize)}
              </p>
              <Button
                size="sm"
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (fileInputRef.current) {
                    fileInputRef.current.value = "";
                    fileInputRef.current.click();
                  }
                }}
              >
                Choose Different File
              </Button>
            </div>
          )}
        </div>
      ) : (
        // Empty state - show upload instructions
        <div className="flex flex-col items-center justify-center space-y-3 p-6 text-center">
          <div className="bg-primary/10 text-primary mb-2 rounded-full p-3">
            <UploadCloud className="h-8 w-8" />
          </div>
          <h3 className="text-lg font-medium">Upload Kenmei CSV Export</h3>
          <p className="text-muted-foreground max-w-md text-sm">
            Drag and drop your Kenmei CSV export file here
          </p>

          <div className="mt-2">
            <Button
              type="button"
              variant="outline"
              className="mt-2"
              onClick={(e) => {
                e.preventDefault();
                fileInputRef.current?.click();
              }}
            >
              <FileText className="mr-2 h-4 w-4" />
              Browse Files
            </Button>
          </div>
        </div>
      )}
    </label>
  );
}
