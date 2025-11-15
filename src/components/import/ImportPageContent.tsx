/**
 * @packageDocumentation
 * @module ImportPageContent
 * @description Content components for different states of the ImportPage.
 */

import React from "react";
import { motion } from "framer-motion";
import { KenmeiData } from "../../types/kenmei";
import { AppError } from "../../utils/error-handling";
import { FileDropZone } from "./FileDropZone";
import { DataTable } from "./DataTable";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";
import { Progress } from "../ui/Progress";
import { Alert, AlertDescription } from "../ui/Alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/Tabs";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "../ui/Card";
import {
  CheckCircle2,
  Upload,
  Info,
  ListChecks,
  BookOpen,
  History,
} from "lucide-react";
import {
  getStatusIcon,
  formatStatusLabel,
  type StatusCounts,
} from "../../utils/manga-status-utils";

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
 * @param props - Component props.
 * @returns React element with success animation and confirmation.
 * @source
 */
export function ImportSuccessContent({
  importData,
  progress,
}: Readonly<ImportSuccessProps>) {
  const importedCount = importData?.manga?.length ?? 0;

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card className="items-center text-center shadow-lg">
        <CardHeader className="flex flex-col items-center gap-4 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="h-8 w-8" />
          </div>
          <CardTitle className="text-3xl font-semibold">
            Import ready for review
          </CardTitle>
          <CardDescription className="text-base">
            {importedCount.toLocaleString()} entries are staged. We’ll take you
            to match review automatically.
          </CardDescription>
        </CardHeader>
        <CardContent className="w-full space-y-3 px-6 pb-6">
          <div className="text-muted-foreground flex items-center justify-between text-xs font-medium">
            <span>Background tasks</span>
            <span>{progress}%</span>
          </div>
          <Progress value={progress} className="h-2" />
        </CardContent>
      </Card>
    </motion.section>
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
 * @param props - Component props.
 * @returns React element with file upload and help content.
 * @source
 */
export function FileUploadContent({
  onFileLoaded,
  onError,
}: Readonly<FileUploadProps>) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card className="shadow-lg">
        <CardHeader className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 text-primary flex h-11 w-11 items-center justify-center rounded-full">
              <Upload className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-2xl font-semibold">
                Upload your Kenmei export
              </CardTitle>
              <CardDescription>
                Drop your CSV to kick off the import. Validation and parsing run
                automatically.
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          <Tabs defaultValue="upload" className="w-full">
            <TabsList className="bg-muted/40 grid h-[50px] w-full grid-cols-2 gap-2 rounded-lg p-1">
              <TabsTrigger
                value="upload"
                className="data-[state=active]:bg-background data-[state=active]:text-foreground flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition hover:border hover:border-slate-200 data-[state=active]:shadow-sm dark:hover:border-white/20"
              >
                <Upload className="h-4 w-4" />
                Upload
              </TabsTrigger>
              <TabsTrigger
                value="help"
                className="data-[state=active]:bg-background data-[state=active]:text-foreground flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition hover:border hover:border-slate-200 data-[state=active]:shadow-sm dark:hover:border-white/20"
              >
                <Info className="h-4 w-4" />
                How to export
              </TabsTrigger>
            </TabsList>

            <TabsContent value="upload" className="space-y-4 pt-6">
              <div className="border-border/60 bg-muted/20 rounded-lg border border-dashed p-6">
                <p className="text-muted-foreground text-sm">
                  Drag and drop your Kenmei export here or click to browse.
                  <Badge variant="outline" className="ml-2 font-mono">
                    .csv
                  </Badge>{" "}
                  files are supported.
                </p>
                <div className="mt-4">
                  <FileDropZone onFileLoaded={onFileLoaded} onError={onError} />
                </div>
              </div>
              <p className="text-muted-foreground text-xs">
                We’ll keep your Kenmei metadata intact and flag any validation
                issues immediately.
              </p>
            </TabsContent>

            <TabsContent value="help" className="space-y-4 pt-6">
              <div className="border-border/60 bg-muted/10 text-muted-foreground rounded-lg border p-6 text-sm leading-relaxed">
                <h3 className="text-foreground mb-3 text-base font-semibold">
                  How to export from Kenmei
                </h3>
                <ol className="ml-4 list-decimal space-y-2">
                  <li>Log into Kenmei and open your dashboard settings.</li>
                  <li>Select the CSV export option.</li>
                  <li>Generate the export and download the file.</li>
                  <li>Return here and upload the downloaded CSV.</li>
                </ol>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </motion.section>
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
 * @param props - Component props.
 * @returns React element with import confirmation interface.
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
  if (isLoading) {
    return (
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <Card className="shadow-lg">
          <CardHeader className="flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className="bg-primary/10 text-primary flex h-11 w-11 items-center justify-center rounded-full">
                <span className="border-primary/30 border-t-primary h-6 w-6 animate-spin rounded-full border-2" />
              </div>
              <div>
                <CardTitle className="text-2xl font-semibold">
                  Processing your library
                </CardTitle>
                <CardDescription>
                  Merging entries and reapplying previous matches...
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-3 sm:grid-cols-2">
              {Array.from({ length: 4 }).map(() => (
                <div
                  key={crypto.randomUUID()}
                  className="border-border/50 bg-muted/30 h-20 rounded-lg border border-dashed"
                />
              ))}
            </div>
            <div className="space-y-2">
              <Progress className="h-2 animate-pulse" />
              <p className="text-muted-foreground text-xs">
                Combining your library with previously matched entries...
              </p>
            </div>
          </CardContent>
        </Card>
      </motion.section>
    );
  }

  const statusEntries = Object.entries(statusCounts).sort(
    ([, a], [, b]) => b - a,
  );
  const uniqueStatuses = statusEntries.length;

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card className="shadow-lg">
        <CardHeader className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 text-primary flex h-11 w-11 items-center justify-center rounded-full">
              <ListChecks className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-2xl font-semibold">
                Review your Kenmei entries
              </CardTitle>
              <CardDescription>
                Confirm totals before heading to match review.
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <div className="border-border/60 bg-muted/10 flex items-center gap-3 rounded-lg border px-4 py-3 shadow-sm">
              <div className="bg-primary/10 text-primary flex h-10 w-10 items-center justify-center rounded-full">
                <BookOpen className="h-5 w-5" />
              </div>
              <div>
                <p className="text-muted-foreground text-xs uppercase tracking-wide">
                  Total entries
                </p>
                <p className="text-foreground text-lg font-semibold">
                  {importData.manga.length.toLocaleString()}
                </p>
              </div>
            </div>
            <div className="border-border/60 bg-muted/10 flex items-center gap-3 rounded-lg border px-4 py-3 shadow-sm">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <History className="h-5 w-5" />
              </div>
              <div>
                <p className="text-muted-foreground text-xs uppercase tracking-wide">
                  Previously matched
                </p>
                <p className="text-foreground text-lg font-semibold">
                  {previousMatchCount.toLocaleString()}
                </p>
              </div>
            </div>
            <div className="border-border/60 bg-muted/10 flex items-center gap-3 rounded-lg border px-4 py-3 shadow-sm">
              <div className="bg-primary/10 text-primary flex h-10 w-10 items-center justify-center rounded-full">
                <ListChecks className="h-5 w-5" />
              </div>
              <div>
                <p className="text-muted-foreground text-xs uppercase tracking-wide">
                  Unique statuses
                </p>
                <p className="text-foreground text-lg font-semibold">
                  {uniqueStatuses.toLocaleString()}
                </p>
              </div>
            </div>
          </div>

          {statusEntries.length > 0 && (
            <div className="space-y-3">
              <p className="text-foreground text-sm font-medium">
                Status overview
              </p>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {statusEntries.map(([status, count]) => (
                  <div
                    key={status}
                    className="border-border/60 bg-card flex items-center justify-between gap-3 rounded-md border px-3 py-3 shadow-sm"
                  >
                    <div className="flex items-center gap-3">
                      {getStatusIcon(status)}
                      <span className="text-foreground text-sm font-medium">
                        {formatStatusLabel(status)}
                      </span>
                    </div>
                    <span className="text-foreground text-lg font-semibold">
                      {count.toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="border-border/60 rounded-lg border">
            <DataTable
              data={importData.manga}
              itemsPerPage={50}
              isLoading={isLoading}
            />
          </div>
        </CardContent>

        <CardFooter className="border-border/60 bg-muted/10 flex-col items-stretch gap-4 border-t py-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-3">
            <Button
              onClick={onImport}
              disabled={isLoading}
              size="lg"
              className="gap-2"
            >
              {isLoading ? (
                <>
                  <span className="flex h-4 w-4 items-center justify-center">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  </span>{" "}
                  Processing…
                </>
              ) : (
                <>
                  <ListChecks className="h-4 w-4" />
                  Begin match review
                </>
              )}
            </Button>
            <Button
              onClick={onReset}
              disabled={isLoading}
              variant="outline"
              size="lg"
              className="gap-2"
            >
              Reset import
            </Button>
          </div>

          <div className="text-muted-foreground space-y-3 text-xs">
            <p>We’ll reapply existing match decisions before sync begins.</p>
            {previousMatchCount > 0 && (
              <Alert className="border-primary/30 bg-primary/5 border">
                <Info className="h-4 w-4" />
                <AlertDescription className="text-foreground text-sm">
                  {previousMatchCount.toLocaleString()} previously reviewed
                  matches carry over automatically.
                </AlertDescription>
              </Alert>
            )}
          </div>
        </CardFooter>
      </Card>
    </motion.section>
  );
}
