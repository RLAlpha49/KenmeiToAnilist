/**
 * @packageDocumentation
 * @module ImportPageContent
 * @description Content components for different states of the ImportPage.
 */

import React from "react";
import { motion } from "framer-motion";
import { KenmeiData } from "../../types/kenmei";
import { AppError } from "../../utils/errorHandling";
import { FileDropZone } from "./FileDropZone";
import { DataTable } from "./DataTable";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Separator } from "../ui/separator";
import { Progress } from "../ui/progress";
import { Alert, AlertDescription } from "../ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import {
  FileCheck,
  BarChart,
  FilesIcon,
  CheckCircle2,
  Upload,
  Info,
  Clock,
} from "lucide-react";
import {
  getStatusColor,
  getStatusIcon,
  formatStatusLabel,
  type StatusCounts,
} from "../../utils/manga-status-utils";

/** Animation variants for container entrance with staggered children. @source */
const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.1,
    },
  },
};

/** Animation variants for individual items with spring physics. @source */
const itemVariants = {
  hidden: { y: 20, opacity: 0 },
  show: {
    y: 0,
    opacity: 1,
    transition: {
      type: "spring" as const,
      stiffness: 300,
      damping: 24,
    },
  },
};

/**
 * Props for the ImportSuccessContent component.
 * @property importData - KenmeiData with successfully imported manga entries.
 * @property progress - Import progress percentage (0-100).
 * @internal
 * @source
 */
interface ImportSuccessProps {
  importData: KenmeiData;
  progress: number;
}

/**
 * Displays success message for completed import with progress indicator.
 * @param props - {@link ImportSuccessProps}
 * @returns React.ReactElement with success animation and confirmation.
 * @source
 */
export function ImportSuccessContent({
  importData,
  progress,
}: Readonly<ImportSuccessProps>) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
    >
      <div className="relative overflow-hidden rounded-3xl border border-white/30 bg-white/80 p-8 shadow-2xl backdrop-blur-lg dark:border-white/10 dark:bg-slate-950/70">
        <div className="pointer-events-none absolute right-[-60px] top-[-60px] h-48 w-48 rounded-full bg-gradient-to-br from-emerald-500/25 via-green-500/20 to-transparent blur-3xl" />
        <div className="pointer-events-none absolute bottom-[-80px] left-[-80px] h-64 w-64 rounded-full bg-gradient-to-br from-blue-400/20 via-indigo-400/15 to-transparent blur-3xl" />

        <div className="relative z-[1] mx-auto max-w-md space-y-6 text-center">
          <motion.div
            className="mx-auto mb-8 flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-green-500 text-white shadow-2xl"
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 200, damping: 15 }}
          >
            <CheckCircle2 className="h-12 w-12" />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.5 }}
          >
            <h2 className="text-foreground mb-4 text-3xl font-bold">
              Import Successful!
            </h2>
            <p className="text-muted-foreground mb-8 text-lg">
              Your {importData?.manga?.length || 0} manga entries have been
              successfully imported.
            </p>
          </motion.div>

          <motion.div
            className="mb-6 space-y-3"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5, duration: 0.5 }}
          >
            <div className="flex items-center justify-between text-sm font-medium text-emerald-600 dark:text-emerald-300">
              <span>Processing complete</span>
              <span>{progress}%</span>
            </div>
            <Progress value={progress} className="h-2 bg-emerald-500/20" />
          </motion.div>

          <motion.div
            className="rounded-2xl border border-white/20 bg-white/60 px-4 py-3 backdrop-blur-sm dark:border-white/10 dark:bg-white/5"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7, duration: 0.4 }}
          >
            <p className="text-muted-foreground text-sm">
              Redirecting to review page...
            </p>
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}

/**
 * Props for the FileUploadContent component.
 * @property onFileLoaded - Callback invoked when CSV file is successfully loaded and parsed.
 * @property onError - Callback invoked if file loading or parsing fails.
 * @internal
 * @source
 */
interface FileUploadProps {
  onFileLoaded: (data: KenmeiData) => void;
  onError: (error: AppError) => void;
}

/**
 * Displays file upload interface with drag-and-drop and help tabs.
 * @param props - {@link FileUploadProps}
 * @returns React.ReactElement with file upload and help content.
 * @source
 */
export function FileUploadContent({
  onFileLoaded,
  onError,
}: Readonly<FileUploadProps>) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.2 }}
    >
      <div className="relative overflow-hidden rounded-3xl border border-white/30 bg-white/80 p-6 shadow-2xl backdrop-blur-lg dark:border-white/10 dark:bg-slate-950/70">
        <div className="pointer-events-none absolute right-[-40px] top-[-40px] h-40 w-40 rounded-full bg-gradient-to-br from-blue-500/25 via-indigo-500/20 to-transparent blur-3xl" />
        <div className="pointer-events-none absolute bottom-[-60px] left-[-60px] h-48 w-48 rounded-full bg-gradient-to-br from-emerald-400/20 via-teal-400/15 to-transparent blur-3xl" />

        <div className="relative z-[1] space-y-6">
          <div className="flex items-center gap-4">
            <motion.div
              className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-r from-blue-500 to-indigo-500 text-white shadow-lg"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <Upload className="h-6 w-6" />
            </motion.div>
            <div>
              <h2 className="text-foreground text-2xl font-semibold">
                Import From Kenmei
              </h2>
              <p className="text-muted-foreground">
                Upload your Kenmei export file to begin the import process
              </p>
            </div>
          </div>

          <Tabs defaultValue="upload" className="w-full">
            <TabsList className="flex w-full flex-col gap-2 rounded-2xl border border-white/20 bg-white/80 p-5 text-sm text-slate-600 backdrop-blur md:flex-row md:items-center md:justify-start md:gap-3 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
              <TabsTrigger
                value="upload"
                className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-transparent px-5 py-3.5 font-medium text-slate-600 transition hover:border-white/20 hover:text-slate-900 data-[state=active]:border-white/20 data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-lg dark:hover:border-white/20 dark:hover:text-white dark:data-[state=active]:border-transparent dark:data-[state=active]:bg-white/20 dark:data-[state=active]:text-white"
              >
                <FilesIcon className="h-4 w-4" />
                Upload File
              </TabsTrigger>
              <TabsTrigger
                value="help"
                className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-transparent px-5 py-3.5 font-medium text-slate-600 transition hover:border-white/20 hover:text-slate-900 data-[state=active]:border-white/20 data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-lg dark:hover:border-white/20 dark:hover:text-white dark:data-[state=active]:border-transparent dark:data-[state=active]:bg-white/20 dark:data-[state=active]:text-white"
              >
                <Info className="h-4 w-4" />
                How To Export
              </TabsTrigger>
            </TabsList>

            <TabsContent value="upload" className="space-y-6 pt-6">
              <div className="rounded-2xl border border-white/20 bg-white/60 p-6 backdrop-blur-sm dark:border-white/10 dark:bg-white/5">
                <p className="text-muted-foreground mb-6 text-sm">
                  Drag and drop your Kenmei export file here, or click to select
                  a file.{" "}
                  <Badge variant="outline" className="ml-1 font-mono">
                    .csv
                  </Badge>{" "}
                  files exported from Kenmei are supported.
                </p>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.4, duration: 0.5 }}
                >
                  <FileDropZone onFileLoaded={onFileLoaded} onError={onError} />
                </motion.div>
              </div>
            </TabsContent>

            <TabsContent value="help" className="space-y-6 pt-6">
              <motion.div
                className="rounded-2xl border border-white/20 bg-gradient-to-br from-blue-500/10 via-indigo-500/5 to-transparent p-6 backdrop-blur-sm dark:border-white/10 dark:from-blue-500/20 dark:via-indigo-500/10"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3, duration: 0.5 }}
              >
                <h3 className="text-foreground mb-4 text-lg font-semibold">
                  How to export from Kenmei
                </h3>
                <ol className="text-muted-foreground ml-5 list-decimal space-y-3 text-sm">
                  <li>Log into your Kenmei account</li>
                  <li>Go to Settings &gt; Dashboard</li>
                  <li>Select CSV format</li>
                  <li>Click &quot;Export&quot;</li>
                  <li>Click &quot;Download&quot;</li>
                  <li>Save the file to your computer</li>
                  <li>Upload the saved file here</li>
                </ol>
              </motion.div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </motion.div>
  );
}

/**
 * Props for the FileReadyContent component.
 * @property importData - KenmeiData ready for import processing.
 * @property statusCounts - Breakdown of manga count by status.
 * @property previousMatchCount - Number of previously matched entries.
 * @property isLoading - Whether import process is in progress.
 * @property onImport - Callback when user initiates import.
 * @property onReset - Callback to reset import state.
 * @internal
 * @source
 */
interface FileReadyProps {
  importData: KenmeiData;
  statusCounts: StatusCounts;
  previousMatchCount: number;
  isLoading: boolean;
  onImport: () => void;
  onReset: () => void;
}

/**
 * Displays import preview with data summary, manga entries table, and action buttons.
 * @param props - {@link FileReadyProps}
 * @returns React.ReactElement with import confirmation interface.
 * @source
 */
export function FileReadyContent({
  importData,
  statusCounts,
  previousMatchCount,
  isLoading,
  onImport,
  onReset,
}: Readonly<FileReadyProps>) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.2 }}
    >
      <div className="relative overflow-hidden rounded-3xl border border-white/30 bg-white/80 p-6 shadow-2xl backdrop-blur-lg dark:border-white/10 dark:bg-slate-950/70">
        <div className="pointer-events-none absolute right-[-40px] top-[-40px] h-40 w-40 rounded-full bg-gradient-to-br from-emerald-500/25 via-green-500/20 to-transparent blur-3xl" />
        <div className="pointer-events-none absolute bottom-[-60px] left-[-60px] h-48 w-48 rounded-full bg-gradient-to-br from-blue-400/20 via-indigo-400/15 to-transparent blur-3xl" />

        <div className="relative z-[1] space-y-6">
          <div className="flex items-center gap-4">
            <motion.div
              className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-r from-emerald-500 to-green-500 text-white shadow-lg"
              whileHover={{ scale: 1.05 }}
            >
              <FileCheck className="h-6 w-6" />
            </motion.div>
            <div>
              <h2 className="text-foreground text-2xl font-semibold">
                File Ready for Import
              </h2>
              <p className="text-muted-foreground">
                Review your data before proceeding to the matching step
              </p>
            </div>
          </div>

          <motion.div
            className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
            variants={containerVariants}
            initial="hidden"
            animate="show"
          >
            <motion.div variants={itemVariants}>
              <div className="relative overflow-hidden rounded-2xl border border-blue-500/20 bg-gradient-to-br from-blue-500/15 via-indigo-500/10 to-blue-500/5 p-4 shadow-xl backdrop-blur-sm dark:border-blue-500/20 dark:from-blue-500/20 dark:via-indigo-500/20 dark:to-blue-500/10">
                <div className="absolute right-[-20px] top-[-20px] h-20 w-20 rounded-full bg-blue-500/20 blur-2xl" />
                <div className="relative z-[1] flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/40 text-blue-600 shadow-sm dark:bg-slate-900/60">
                    <BarChart className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-blue-600 dark:text-blue-400">
                      Total Entries
                    </p>
                    <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">
                      {importData.manga.length}
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Show previously matched count if available */}
            {previousMatchCount > 0 && (
              <motion.div variants={itemVariants}>
                <div className="relative overflow-hidden rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/15 via-green-500/10 to-emerald-500/5 p-4 shadow-xl backdrop-blur-sm dark:border-emerald-500/25 dark:from-emerald-500/20 dark:via-green-500/15 dark:to-emerald-500/10">
                  <div className="absolute right-[-20px] top-[-20px] h-20 w-20 rounded-full bg-emerald-500/20 blur-2xl" />
                  <div className="relative z-[1] flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/40 text-emerald-600 shadow-sm dark:bg-slate-900/60">
                      <Clock className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                        Previously Matched
                      </p>
                      <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">
                        {previousMatchCount}
                      </p>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Render status count cards dynamically */}
            {Object.entries(statusCounts).map(([status, count], index) => (
              <motion.div key={status} variants={itemVariants} custom={index}>
                <div
                  className={`relative overflow-hidden rounded-2xl border p-4 shadow-xl backdrop-blur-sm ${getStatusColor(status)}`}
                >
                  <div className="from-current/20 absolute right-[-20px] top-[-20px] h-20 w-20 rounded-full bg-gradient-to-br to-transparent blur-2xl" />
                  <div className="relative z-[1] flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/40 shadow-sm dark:bg-slate-900/60">
                      {getStatusIcon(status)}
                    </div>
                    <div>
                      <p className="text-xs font-medium">
                        {formatStatusLabel(status)}
                      </p>
                      <p className="text-2xl font-bold">{count}</p>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>

          <Separator className="border-white/20" />

          <motion.div
            className="rounded-2xl border border-white/20 bg-white/60 p-6 backdrop-blur-sm dark:border-white/10 dark:bg-white/5"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5, duration: 0.5 }}
          >
            <h3 className="text-foreground mb-4 text-lg font-semibold">
              Manga Entries
            </h3>
            <DataTable data={importData.manga} itemsPerPage={50} />
          </motion.div>

          <motion.div
            className="flex flex-col gap-4 sm:flex-row"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.4 }}
          >
            <Button
              onClick={onImport}
              disabled={isLoading}
              size="lg"
              className="group h-auto rounded-full bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 px-6 py-3 text-base font-semibold text-white shadow-lg transition hover:shadow-xl focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-950"
            >
              {isLoading ? (
                <div className="flex items-center gap-2">
                  <svg
                    className="h-4 w-4 animate-spin"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  Processing...
                </div>
              ) : (
                "Launch match review"
              )}
            </Button>
            <Button
              onClick={onReset}
              disabled={isLoading}
              variant="outline"
              size="lg"
              className="h-auto rounded-full border-white/60 bg-white/75 px-6 py-3 text-base font-semibold shadow-sm transition focus-visible:ring-2 focus-visible:ring-offset-2 dark:border-white/20 dark:bg-slate-950/60 dark:focus-visible:ring-offset-slate-950"
            >
              Reset import
            </Button>
          </motion.div>

          {previousMatchCount > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7, duration: 0.4 }}
            >
              <Alert className="rounded-2xl border border-blue-400/40 bg-blue-500/10 px-4 py-3 text-sm text-blue-100 backdrop-blur-lg">
                <Info className="h-4 w-4 text-blue-400" />
                <AlertDescription className="text-blue-200">
                  {/* Notify user of preserved match progress */}
                  <span className="font-medium">Note:</span> You have{" "}
                  {previousMatchCount} previously matched manga entries. Your
                  matching progress will be preserved when proceeding to the
                  next step.
                </AlertDescription>
              </Alert>
            </motion.div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
