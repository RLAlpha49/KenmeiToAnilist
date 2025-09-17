/**
 * @packageDocumentation
 * @module ImportPage
 * @description Import page component for the Kenmei to AniList sync tool. Handles file upload, import, error handling, and displays import summary and data table.
 */

import React, { useState, useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ErrorMessage } from "../components/ui/error-message";
import { ErrorType, AppError, createError } from "../utils/errorHandling";
import { KenmeiData } from "../types/kenmei";
import { saveKenmeiData, getSavedMatchResults } from "../utils/storage";
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
import { toast } from "sonner";
import { motion } from "framer-motion";

/**
 * Import page component for the Kenmei to AniList sync tool.
 *
 * Handles file upload, import process, error handling, and displays import summary and data table for the user.
 *
 * @source
 */
export function ImportPage() {
  const navigate = useNavigate();
  const [importData, setImportData] = useState<KenmeiData | null>(null);
  const [error, setError] = useState<AppError | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [importSuccess, setImportSuccess] = useState(false);
  const [previousMatchCount, setPreviousMatchCount] = useState(0);
  const [progress, setProgress] = useState(0);

  const handleFileLoaded = (data: KenmeiData) => {
    setImportData(data);
    setError(null);
    setImportSuccess(false);
    toast.success("File loaded successfully");
  };

  const handleError = (error: AppError) => {
    setError(error);
    setImportData(null);
    setImportSuccess(false);
    toast.error(error.message);
  };

  const handleImport = async () => {
    if (!importData) {
      return;
    }

    setIsLoading(true);

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

      console.log(
        `Import results: Previous: ${previousManga.length}, New file: ${normalizedManga.length}, Final merged: ${mergedManga.length}`,
      );
      console.log(
        `Changes: ${results.newMangaCount} new manga, ${results.updatedMangaCount} updated manga`,
      );

      // Ensure all manga have proper IDs and required fields
      const validMergedManga = validateMangaData(mergedManga);
      saveKenmeiData({ manga: validMergedManga });

      // Update existing match results with new data if any exist
      updateMatchResults(validMergedManga);

      // Clear pending manga storage after import to force recalculation
      clearPendingMangaStorage();

      // Show success state briefly before redirecting
      setImportSuccess(true);
      setProgress(100);

      // Redirect to the review page after a short delay
      setTimeout(() => {
        navigate({ to: "/review" });
      }, 1500);
    } catch (err) {
      // Handle any errors that might occur during storage
      console.error("Storage error:", err);
      handleError(
        createError(
          ErrorType.STORAGE,
          "Failed to save import data. Please try again.",
        ),
      );
    } finally {
      clearInterval(progressInterval);
      setIsLoading(false);
    }
  };

  const dismissError = () => {
    setError(null);
  };

  const resetForm = () => {
    setImportData(null);
    setError(null);
    setImportSuccess(false);
  };

  useEffect(() => {
    // Check if we have previous match results
    const savedResults = getSavedMatchResults();
    if (savedResults && Array.isArray(savedResults)) {
      const reviewedCount = savedResults.filter(
        (m) =>
          m.status === "matched" ||
          m.status === "manual" ||
          m.status === "skipped",
      ).length;

      setPreviousMatchCount(reviewedCount);
    }
  }, []);

  return (
    <motion.div
      className="container mx-auto px-4 py-8 md:px-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
    >
      <motion.div
        className="mb-8 space-y-2"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.5 }}
      >
        <h1 className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-4xl font-bold text-transparent">
          Import Your Manga
        </h1>
        <p className="text-muted-foreground max-w-2xl">
          Transfer your manga collection from Kenmei to AniList with a single
          file import.
        </p>
      </motion.div>

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
            <ImportSuccessContent
              importData={importData}
              progress={progress}
            />
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

        const statusCounts = getStatusCounts(importData.manga);
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
