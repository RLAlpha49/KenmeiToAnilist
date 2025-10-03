/**
 * @packageDocumentation
 * @module SyncResultsView
 * @description React component for displaying the results of the AniList synchronization process, including summary statistics and error details.
 */
import React from "react";
import { SyncReport } from "../../api/anilist/sync-service";
import {
  CheckCircle,
  XCircle,
  Clock,
  Download,
  Sparkles,
  Gauge,
  ShieldAlert,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "../ui/card";
import { Button } from "../ui/button";

/**
 * Props for the SyncResultsView component.
 *
 * @property report - The synchronization report containing results and errors.
 * @property onClose - Callback to close the results view.
 * @property onExportErrors - Optional callback to export the error log.
 * @source
 */
export interface SyncResultsViewProps {
  report: SyncReport;
  onClose: () => void;
  onExportErrors?: () => void;
}

const SyncResultsView: React.FC<SyncResultsViewProps> = ({
  report,
  onClose,
  onExportErrors,
}) => {
  // Format timestamp to readable format
  const formattedTime = new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "medium",
  }).format(report.timestamp);

  // Calculate success percentage
  const successRate =
    report.totalEntries > 0
      ? Math.round((report.successfulUpdates / report.totalEntries) * 100)
      : 0;

  const hasErrors = report.errors.length > 0;
  const previewErrors = report.errors.slice(0, 8);
  const remainingErrorCount = Math.max(
    report.errors.length - previewErrors.length,
    0,
  );
  const attentionEntries = report.failedUpdates + report.skippedEntries;
  const totalAttempted = report.successfulUpdates + report.failedUpdates;

  // Handle export of error log
  const handleExportErrors = () => {
    if (!report.errors.length || !onExportErrors) return;
    onExportErrors();
  };

  return (
    <Card className="relative mx-auto w-full max-w-3xl overflow-hidden border border-slate-200/70 bg-white/85 shadow-xl shadow-emerald-500/10 backdrop-blur-2xl dark:border-slate-800/60 dark:bg-slate-950/75">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.18),_transparent_65%)] dark:bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.25),_transparent_65%)]" />
      <CardHeader className="relative space-y-4 pb-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold tracking-[0.28em] text-slate-500 uppercase dark:text-slate-400">
              Sync report
            </p>
            <CardTitle className="mt-1 text-2xl font-semibold text-slate-900 dark:text-slate-100">
              AniList synchronization summary
            </CardTitle>
            <CardDescription className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              Completed on {formattedTime}
            </CardDescription>
          </div>
          <div className="flex h-16 w-16 flex-col items-center justify-center rounded-3xl bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-500 text-white shadow-lg shadow-emerald-500/30">
            <span className="text-[10px] tracking-[0.25em] uppercase">
              Success
            </span>
            <span className="text-2xl leading-tight font-bold">
              {successRate}%
            </span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-300">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/50 bg-white/70 px-3 py-1 shadow-sm backdrop-blur dark:border-slate-800/60 dark:bg-slate-950/60">
            <Sparkles className="h-3.5 w-3.5 text-emerald-500" />
            {report.totalEntries} entries processed
          </span>
          {attentionEntries > 0 ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-300/60 bg-rose-100/70 px-3 py-1 text-rose-700 dark:border-rose-900/40 dark:bg-rose-900/40 dark:text-rose-200">
              <ShieldAlert className="h-3.5 w-3.5" />
              {attentionEntries} need review
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300/60 bg-emerald-100/70 px-3 py-1 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-900/40 dark:text-emerald-200">
              <CheckCircle className="h-3.5 w-3.5" />
              Zero issues detected
            </span>
          )}
          <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200/70 bg-white/70 px-3 py-1 text-slate-600 shadow-sm backdrop-blur dark:border-slate-700/60 dark:bg-slate-950/60 dark:text-slate-200">
            <Gauge className="h-3.5 w-3.5 text-indigo-500 dark:text-indigo-300" />
            {totalAttempted} updates attempted
          </span>
        </div>
      </CardHeader>

      <CardContent className="relative z-10 space-y-8">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="relative overflow-hidden rounded-3xl border border-emerald-200/60 bg-emerald-50/70 p-4 text-emerald-700 shadow-inner dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-200">
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-emerald-200/40 via-transparent to-teal-200/20 dark:from-emerald-500/20 dark:to-teal-500/10" />
            <div className="relative flex flex-col gap-1.5">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <CheckCircle className="h-4 w-4 text-emerald-500 dark:text-emerald-300" />
                Successful updates
              </div>
              <p className="text-3xl leading-none font-bold text-emerald-600 dark:text-emerald-200">
                {report.successfulUpdates}
              </p>
              <span className="text-xs text-emerald-600/80 dark:text-emerald-200/70">
                {successRate}% overall success
              </span>
            </div>
          </div>

          <div className="relative overflow-hidden rounded-3xl border border-rose-200/60 bg-rose-50/70 p-4 text-rose-700 shadow-inner dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-200">
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-rose-200/40 via-transparent to-red-200/20 dark:from-rose-500/20 dark:to-red-500/10" />
            <div className="relative flex flex-col gap-1.5">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <XCircle className="h-4 w-4 text-rose-500 dark:text-rose-300" />
                Failed updates
              </div>
              <p className="text-3xl leading-none font-bold text-rose-600 dark:text-rose-200">
                {report.failedUpdates}
              </p>
              <span className="text-xs text-rose-600/80 dark:text-rose-200/70">
                {report.failedUpdates > 0 ? "Review below" : "No failures"}
              </span>
            </div>
          </div>

          <div className="relative overflow-hidden rounded-3xl border border-amber-200/60 bg-amber-50/70 p-4 text-amber-700 shadow-inner dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-amber-200/40 via-transparent to-orange-200/20 dark:from-amber-500/20 dark:to-orange-500/10" />
            <div className="relative flex flex-col gap-1.5">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Clock className="h-4 w-4 text-amber-500 dark:text-amber-300" />
                Skipped entries
              </div>
              <p className="text-3xl leading-none font-bold text-amber-600 dark:text-amber-200">
                {report.skippedEntries}
              </p>
              <span className="text-xs text-amber-600/80 dark:text-amber-200/70">
                {report.skippedEntries > 0
                  ? "Manual follow-up suggested"
                  : "None skipped"}
              </span>
            </div>
          </div>

          <div className="relative overflow-hidden rounded-3xl border border-slate-200/60 bg-slate-50/70 p-4 text-slate-700 shadow-inner dark:border-slate-800/60 dark:bg-slate-950/40 dark:text-slate-200">
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-slate-200/50 via-transparent to-indigo-200/30 dark:from-slate-700/40 dark:to-indigo-900/30" />
            <div className="relative flex flex-col gap-1.5">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Gauge className="h-4 w-4 text-indigo-500 dark:text-indigo-300" />
                Total processed
              </div>
              <p className="text-3xl leading-none font-bold text-slate-700 dark:text-slate-200">
                {report.totalEntries}
              </p>
              <span className="text-xs text-slate-600/80 dark:text-slate-300/70">
                {totalAttempted} attempted updates
              </span>
            </div>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-3xl border border-slate-200/70 bg-slate-50/70 p-5 dark:border-slate-800/60 dark:bg-slate-950/40">
          <div className="relative flex items-center justify-between text-sm font-semibold text-slate-700 dark:text-slate-200">
            <span>Overall completion</span>
            <span>{successRate}%</span>
          </div>
          <div className="mt-3 h-3 w-full overflow-hidden rounded-full bg-white/60 dark:bg-slate-900/40">
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 transition-all duration-700"
              style={{ width: `${successRate}%` }}
            />
          </div>
          <div className="mt-3 flex justify-between text-[10px] tracking-[0.3em] text-slate-500 uppercase dark:text-slate-400">
            <span>0%</span>
            <span>50%</span>
            <span>100%</span>
          </div>
          {hasErrors && (
            <p className="mt-3 text-xs text-rose-600/80 dark:text-rose-300/80">
              {attentionEntries} entr{attentionEntries === 1 ? "y" : "ies"}{" "}
              require manual review.
            </p>
          )}
        </div>

        {hasErrors ? (
          <div className="overflow-hidden rounded-3xl border border-rose-200/60 bg-rose-50/70 p-5 shadow-sm dark:border-rose-900/50 dark:bg-rose-950/30">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-rose-700 dark:text-rose-300">
                <ShieldAlert className="h-4 w-4 text-rose-500" />
                Failed updates ({report.failedUpdates})
              </div>
              <span className="text-xs text-rose-600/80 dark:text-rose-200/70">
                Showing {previewErrors.length} of {report.errors.length}
              </span>
            </div>
            <div className="max-h-56 space-y-3 overflow-y-auto pr-1">
              {previewErrors.map((error) => (
                <div
                  key={error.mediaId}
                  className="group rounded-2xl border border-rose-200/60 bg-white/80 p-3 text-sm shadow-sm transition dark:border-rose-900/50 dark:bg-rose-950/40"
                >
                  <p className="font-semibold text-rose-700 dark:text-rose-200">
                    Media ID {error.mediaId}
                  </p>
                  <p className="mt-1 text-xs text-rose-600/80 dark:text-rose-200/80">
                    {error.error}
                  </p>
                </div>
              ))}
            </div>
            {remainingErrorCount > 0 && (
              <p className="mt-3 text-xs text-rose-600/80 dark:text-rose-200/70">
                +{remainingErrorCount} more issue
                {remainingErrorCount === 1 ? "" : "s"}. Export the log for the
                full list.
              </p>
            )}
          </div>
        ) : (
          <div className="flex items-start gap-3 rounded-3xl border border-emerald-200/60 bg-emerald-50/70 p-4 text-emerald-700 shadow-sm dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-200">
            <CheckCircle className="mt-1 h-5 w-5 text-emerald-500 dark:text-emerald-300" />
            <div>
              <p className="text-sm font-semibold">
                All entries synced successfully
              </p>
              <p className="mt-1 text-xs text-emerald-600/80 dark:text-emerald-200/80">
                Your AniList library is fully aligned with Kenmei.
              </p>
            </div>
          </div>
        )}
      </CardContent>

      <CardFooter className="relative z-10 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200/60 bg-white/70 backdrop-blur dark:border-slate-800/60 dark:bg-slate-950/60">
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Need another pass? You can re-run the sync anytime from the dashboard.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {hasErrors && onExportErrors && (
            <Button
              variant="outline"
              onClick={handleExportErrors}
              className="gap-2 border-slate-300/60 bg-white/70 text-slate-600 transition hover:bg-white dark:border-slate-700/60 dark:bg-slate-950/60 dark:text-slate-200"
            >
              <Download className="h-4 w-4" />
              Export error log
            </Button>
          )}
          <Button
            onClick={onClose}
            className="gap-2 bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 text-white shadow-lg shadow-emerald-500/30 transition hover:from-emerald-500 hover:via-teal-500 hover:to-cyan-500"
          >
            <Sparkles className="h-4 w-4" />
            Done
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
};

/**
 * Displays the results of the AniList synchronization process, including summary statistics, a progress bar, and error details.
 *
 * @param props - The props for the SyncResultsView component.
 * @returns The rendered synchronization results view React element.
 * @source
 * @example
 * ```tsx
 * <SyncResultsView report={report} onClose={handleClose} onExportErrors={handleExportErrors} />
 * ```
 */
export default SyncResultsView;
