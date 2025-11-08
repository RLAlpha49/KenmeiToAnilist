/**
 * @packageDocumentation
 * @module ImportPage
 * @description Import page component for the Kenmei to AniList sync tool. Handles file upload, import, error handling, and displays import summary and data table.
 */

import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ErrorMessage } from "../components/ui/error-message";
import {
  ErrorType,
  AppError,
  createError,
  showErrorNotification,
  ErrorRecoveryAction,
} from "../utils/errorHandling";
import { KenmeiData } from "../types/kenmei";
import { saveKenmeiData, getSavedMatchResults } from "../utils/storage";
import { useOnboarding } from "../contexts/OnboardingContext";
import {
  ImportSuccessContent,
  FileUploadContent,
  FileReadyContent,
} from "../components/import/ImportPageContent";
import {
  normalizeMangaItems,
  getPreviousMangaData,
  mergeMangaData,
  validateMangaData,
  updateMatchResults,
  clearPendingMangaStorage,
} from "../utils/manga-import-utils";
import { getStatusCounts } from "../utils/manga-status-utils";
import { truncateToastMessage } from "../utils/textHighlight";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { useDebugActions } from "../contexts/DebugContext";

/**
 * Import page component for the Kenmei to AniList sync tool.
 *
 * Handles file upload, import process, error handling, and displays import summary and data table for the user.
 *
 * @source
 */
export function ImportPage() {
  const navigate = useNavigate();
  const { recordEvent } = useDebugActions();
  const { completeStep } = useOnboarding();
  const [importData, setImportData] = useState<KenmeiData | null>(null);
  const [error, setError] = useState<AppError | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [importSuccess, setImportSuccess] = useState(false);
  const [previousMatchCount, setPreviousMatchCount] = useState(0);
  const [progress, setProgress] = useState(0);

  const statusCountsSnapshot = useMemo(
    () => (importData ? getStatusCounts(importData.manga) : null),
    [importData],
  );

  const handleFileLoaded = (data: KenmeiData) => {
    console.info(
      `[Import] 📁 File loaded successfully: ${data.manga.length} manga entries`,
    );
    console.debug(`[Import] 🔍 Previous match count: ${previousMatchCount}`);

    recordEvent({
      type: "import.file-loaded",
      message: `File loaded with ${data.manga.length} manga entries`,
      level: "info",
      metadata: {
        entryCount: data.manga.length,
        hasPreviousMatches: previousMatchCount > 0,
        previousMatchCount,
      },
    });

    setImportData(data);
    setError(null);
    setImportSuccess(false);
    toast.success("File loaded", {
      description: truncateToastMessage(
        `${data.manga.length} entries queued for review.` +
          (previousMatchCount > 0
            ? " Prior matches will be reapplied automatically."
            : " We'll keep your Kenmei metadata intact."),
        200,
      ).component,
    });
  };

  /**
   * Handles import errors by logging, recording debug event, and displaying enhanced error notification.
   * @param error - The application error object to handle.
   * @param toastId - Optional ID of an existing toast to replace with error message.
   * @source
   */
  const getRetryCallback = (
    error: AppError,
  ): (() => void | Promise<void>) | undefined => {
    switch (error.type) {
      case ErrorType.VALIDATION:
        // Validation errors cannot be retried - user must fix the file
        return undefined;
      case ErrorType.STORAGE:
      case ErrorType.NETWORK:
        // Network and storage errors can be retried
        return () => handleImport();
      default:
        return undefined;
    }
  };

  /**
   * Handles import errors by logging, recording debug event, and displaying enhanced error notification.
   * @param error - The application error object to handle.
   * @param toastId - Optional ID of an existing toast to replace with error message.
   * @source
   */
  const handleError = (error: AppError, toastId?: string) => {
    console.error(`[Import] ❌ Import error (${error.type}):`, error.message);

    recordEvent({
      type: "import.error",
      message: `Import error: ${error.message}`,
      level: "error",
      metadata: {
        errorType: error.type,
        errorMessage: error.message,
      },
    });

    setError(error);
    setImportData(null);
    setImportSuccess(false);

    // Use enhanced error notification with recovery actions
    showErrorNotification(error, {
      toastId,
      onRetry: getRetryCallback(error),
      duration: 8000,
    });
  };

  /**
   * Processes the loaded manga import data and saves it to storage.
   * Merges with previous data, normalizes IDs, validates, and redirects to review page on success.
   * @source
   */
  const handleImport = async () => {
    if (!importData) {
      console.warn("[Import] ⚠️ Cannot import - no data loaded");
      return;
    }

    console.info(
      `[Import] 🚀 Starting import process for ${importData.manga.length} entries`,
    );
    recordEvent({
      type: "import.start",
      message: `Import started with ${importData.manga.length} entries`,
      level: "info",
      metadata: { entryCount: importData.manga.length },
    });
    setIsLoading(true);

    const loadingToastId = toast.loading("Processing your library", {
      description: "Merging entries and preserving previous matches...",
    }) as string;

    // Start progress animation
    setProgress(10);
    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 90) {
          clearInterval(progressInterval);
          return 90;
        }
        return prev + 10;
      });
    }, 200);

    try {
      // Normalize the imported manga with proper ID assignment
      const normalizedManga = normalizeMangaItems(importData.manga);

      // Get previously imported manga to compare against
      const previousManga = getPreviousMangaData();

      // Merge manga data and get results
      const { mergedManga, results } = mergeMangaData(
        previousManga,
        normalizedManga,
      );

      console.info(
        `[Import] Import results: Previous: ${previousManga.length}, New file: ${normalizedManga.length}, Final merged: ${mergedManga.length}`,
      );
      console.info(
        `[Import] Changes: ${results.newMangaCount} new manga, ${results.updatedMangaCount} updated manga`,
      );

      // Ensure all manga have proper IDs and required fields
      const validMergedManga = validateMangaData(mergedManga);
      saveKenmeiData({ manga: validMergedManga });

      // Update existing match results with new data if any exist
      updateMatchResults(validMergedManga);

      // Clear pending manga storage after import to force recalculation
      clearPendingMangaStorage();

      // Show success state briefly before redirecting
      console.info("[Import] ✅ Import completed successfully");
      console.debug("[Import] 🔍 Redirecting to review page...");

      recordEvent({
        type: "import.complete",
        message: `Import completed: ${results.newMangaCount} new, ${results.updatedMangaCount} updated, ${validMergedManga.length} total`,
        level: "success",
        metadata: {
          newMangaCount: results.newMangaCount,
          updatedMangaCount: results.updatedMangaCount,
          totalMangaCount: validMergedManga.length,
          previousMangaCount: previousManga.length,
          normalizedMangaCount: normalizedManga.length,
        },
      });

      setImportSuccess(true);
      setProgress(100);

      toast.success("Import ready for review", {
        id: loadingToastId,
        duration: 2800,
        description: "We'll take you to the match review in just a sec.",
      });

      // Mark import step as complete
      completeStep("import");

      // Redirect to the review page after a short delay
      setTimeout(() => {
        navigate({ to: "/review" });
      }, 1500);
    } catch (err) {
      // Handle any errors that might occur during storage
      console.error("[Import] ❌ Storage error:", err);
      handleError(
        createError(
          ErrorType.STORAGE,
          "Failed to save import data. Please try again.",
          err,
          "STORAGE_WRITE_FAILED",
          ErrorRecoveryAction.RETRY,
          "Click retry to attempt saving again.",
        ),
        loadingToastId,
      );
    } finally {
      clearInterval(progressInterval);
      setIsLoading(false);
    }
  };

  /**
   * Clears the error message from display.
   * @source
   */
  const dismissError = () => {
    console.debug("[Import] 🔍 Dismissing error message");
    setError(null);
  };

  /**
   * Resets the import form to its initial state and notifies the user.
   * @source
   */
  const resetForm = () => {
    console.info("[Import] 🔄 Resetting import form");
    recordEvent({
      type: "import.reset",
      message: "Import form reset",
      level: "info",
    });
    setImportData(null);
    setError(null);
    setImportSuccess(false);
    toast("Import reset", {
      description:
        "Upload a fresh Kenmei export whenever you're ready to try again.",
    });
  };

  useEffect(() => {
    // Check if we have previous match results
    console.debug("[Import] 🔍 Checking for previous match results...");
    const savedResults = getSavedMatchResults();
    if (savedResults && Array.isArray(savedResults)) {
      const reviewedCount = savedResults.filter(
        (m) =>
          m.status === "matched" ||
          m.status === "manual" ||
          m.status === "skipped",
      ).length;

      console.info(
        `[Import] ✅ Found ${reviewedCount} previously reviewed matches`,
      );
      setPreviousMatchCount(reviewedCount);
    } else {
      console.debug("[Import] 🔍 No previous match results found");
    }
  }, []);

  return (
    <motion.div
      className="container mx-auto space-y-10 px-4 py-8 md:px-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
    >
      <motion.header
        className="max-w-3xl space-y-3"
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Import your Kenmei library
        </h1>
        <p className="text-muted-foreground text-base">
          Upload your Kenmei export, review each match, and sync the results to
          AniList. We preserve previous match decisions so you can pick up right
          where you left off.
        </p>
      </motion.header>

      {error && (
        <motion.div
          className="mb-6"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
        >
          <ErrorMessage
            message={error.message}
            type={error.type}
            dismiss={dismissError}
            retry={importData ? handleImport : undefined}
          />
        </motion.div>
      )}

      {(() => {
        if (importSuccess && importData) {
          return (
            <ImportSuccessContent importData={importData} progress={progress} />
          );
        }

        if (!importData) {
          return (
            <FileUploadContent
              onFileLoaded={handleFileLoaded}
              onError={handleError}
            />
          );
        }

        const statusCounts =
          statusCountsSnapshot ?? getStatusCounts(importData.manga);
        return (
          <FileReadyContent
            importData={importData}
            statusCounts={statusCounts}
            previousMatchCount={previousMatchCount}
            isLoading={isLoading}
            onImport={handleImport}
            onReset={resetForm}
          />
        );
      })()}
    </motion.div>
  );
}
