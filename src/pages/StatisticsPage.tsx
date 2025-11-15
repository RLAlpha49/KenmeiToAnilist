/**
 * @packageDocumentation
 * @module StatisticsPage
 * @description Statistics dashboard aggregating import, match, and sync metrics with interactive visualizations.
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import type { Variants } from "framer-motion";
import { toast } from "sonner";
import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  RefreshCw,
  ArrowRight,
  AlertCircle,
  Loader2,
  BookOpen,
  CheckCircle2,
  Activity,
  Clock,
} from "lucide-react";
import {
  StatusDistributionChart,
  TopGenresChart,
  MatchProgressChart,
  SyncMetricsChart,
  FormatDistributionChart,
  ChaptersReadDistributionChart,
  ReadingTrendsChart,
  ReadingHabitsChart,
  ReadingVelocityChart,
  TimeRangeSelector,
} from "@/components/statistics";
import { StatisticsFilterPanel } from "@/components/statistics/StatisticsFilterPanel";
import { ComparisonToggle } from "@/components/statistics/ComparisonToggle";
import { DrillDownModal } from "@/components/statistics/DrillDownModal";
import type { SyncStats } from "@/types/sync";
import { ExportStatisticsButton } from "@/components/statistics/ExportStatisticsButton";
import {
  getImportStats,
  getSavedMatchResults,
  storage,
  STORAGE_KEYS,
  type ImportStats,
  getReadingHistory,
  type ReadingHistory,
} from "@/utils/storage";
import { formatRelativeTime } from "@/utils/time-utils";
import {
  normalizeMatchResults,
  parseSyncStats,
  type NormalizedMatchForStats,
  type TimeRange,
} from "@/utils/statistics-adapter";
import {
  exportToJson,
  exportToCSV,
  exportToMarkdown,
  buildExportMetadata,
  type ExportFormat,
} from "@/utils/export-utils";
import type { MatchForExport } from "@/types/matching";
import type {
  StatisticsFilters,
  ComparisonMode,
  DrillDownData,
} from "@/types/statistics";
import { DEFAULT_STATISTICS_FILTERS } from "@/types/statistics";
import { SkeletonCard } from "@/components/ui/Skeleton";
import { Button } from "@/components/ui/Button";
import { StatisticsErrorBoundary } from "@/components/statistics/StatisticsErrorBoundary";
import { captureError, ErrorType } from "@/utils/error-handling";
import { useStatisticsAggregation } from "@/hooks/use-statistics-aggregation";
import { useReadingHistoryFilter } from "@/hooks/use-reading-history-filter";

const containerVariants: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.4,
      ease: "easeOut" as const,
      staggerChildren: 0.08,
      delayChildren: 0.12,
    },
  },
};

/**
 * Item animation variant for child elements in container.
 * @source
 */
const itemVariants: Variants = {
  hidden: { opacity: 0, y: 18 },
  show: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.35,
      ease: "easeOut" as const,
    },
  },
};

/**
 * Adapts NormalizedMatchForStats to MatchForExport for export functionality.
 * @param matches - Array of normalized match results from statistics filtering
 * @returns Array of flattened match results suitable for export
 */
function adaptMatchesForExport(
  matches: NormalizedMatchForStats[],
): MatchForExport[] {
  return matches.map((match) => ({
    kenmeiManga: match.kenmeiManga,
    anilistMatches: match.anilistMatches,
    selectedMatch: match.selectedMatch,
    status: match.status,
    matchDate: match.matchDate,
  }));
}

/**
 * Compares filters against defaults to determine if any filters are actively applied.
 * Uses deep comparison to handle nested objects like dateRange and confidenceRange.
 * @param filters - Current filter state to check
 * @param defaults - Default filter state to compare against
 * @returns True if filters differ from defaults in any way
 */
function areFiltersActive(
  filters: StatisticsFilters,
  defaults: StatisticsFilters,
): boolean {
  // Check genres
  if (
    filters.genres.length !== defaults.genres.length ||
    filters.genres.some((g) => !defaults.genres.includes(g))
  ) {
    return true;
  }

  // Check formats
  if (
    filters.formats.length !== defaults.formats.length ||
    filters.formats.some((f) => !defaults.formats.includes(f))
  ) {
    return true;
  }

  // Check tags
  if (
    filters.tags.length !== defaults.tags.length ||
    filters.tags.some((t) => !defaults.tags.includes(t))
  ) {
    return true;
  }

  // Check statuses
  if (
    filters.statuses.length !== defaults.statuses.length ||
    filters.statuses.some((s) => !defaults.statuses.includes(s))
  ) {
    return true;
  }

  // Check dateRange
  if (
    filters.dateRange.start !== defaults.dateRange.start ||
    filters.dateRange.end !== defaults.dateRange.end
  ) {
    return true;
  }

  // Check confidenceRange
  if (
    filters.confidenceRange.min !== defaults.confidenceRange.min ||
    filters.confidenceRange.max !== defaults.confidenceRange.max
  ) {
    return true;
  }

  return false;
}

/**
 * Generates a short error ID for referencing in user-facing error messages.
 * Format: ERR-{timestamp}-{random hex}
 * @returns Short error ID string (e.g., "ERR-a1b2c3")
 */
function generateErrorId(): string {
  const timestamp = Date.now().toString(16).slice(-3);
  const random = Math.random().toString(16).slice(2, 5);
  return `ERR-${timestamp}${random}`.toUpperCase();
}

type OverviewCard = {
  key: string;
  label: string;
  value: string;
  helper?: string;
  icon: LucideIcon;
  accent: string;
  iconClass: string;
};

/**
 * Renders a single overview card with icon, metrics, and helper text.
 * @param card - The card configuration
 * @returns Rendered card component
 */
function OverviewCardComponent({
  card,
}: {
  readonly card: OverviewCard;
}): React.ReactNode {
  const Icon = card.icon;
  return (
    <div
      key={`statistics-overview-${card.key}`}
      className="group relative overflow-hidden rounded-2xl border border-slate-200/60 bg-white/90 shadow-md backdrop-blur-sm transition-shadow hover:shadow-lg dark:border-slate-800/60 dark:bg-slate-950/70"
    >
      <div
        className={`bg-linear-to-br absolute inset-0 ${card.accent}`}
        aria-hidden="true"
      />
      <div className="relative flex h-full flex-col justify-between gap-3 rounded-2xl border border-white/40 bg-white/80 p-5 dark:border-slate-900/60 dark:bg-slate-950/80">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground text-sm font-medium">
            {card.label}
          </span>
          <span
            className={`rounded-xl bg-white/80 p-2 shadow-sm dark:bg-slate-900/70 ${card.iconClass}`}
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
          </span>
        </div>
        <span className="text-2xl font-semibold tracking-tight">
          {card.value}
        </span>
        {card.helper ? (
          <span className="text-muted-foreground text-xs">{card.helper}</span>
        ) : null}
      </div>
    </div>
  );
}

/**
 * StatisticsPage component – visual analytics for import, match, and sync data.
 * Displays comprehensive statistics with charts, filters, and data export capabilities.
 * @returns Rendered statistics dashboard.
 * @source
 */
export function StatisticsPage() {
  const [importStats, setImportStats] = useState<ImportStats | null>(null);
  const [syncStats, setSyncStats] = useState<SyncStats | null>(null);
  const [matchResults, setMatchResults] = useState<NormalizedMatchForStats[]>(
    [],
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<string | null>(null);
  const [readingHistory, setReadingHistory] = useState<ReadingHistory>({
    entries: [],
    lastUpdated: 0,
    version: 1,
  });
  const [selectedTimeRange, setSelectedTimeRange] = useState<TimeRange>("30d");
  const [statisticsFilters, setStatisticsFilters] = useState<StatisticsFilters>(
    DEFAULT_STATISTICS_FILTERS,
  );
  const [comparisonMode, setComparisonMode] = useState<ComparisonMode>({
    enabled: false,
    primaryRange: "30d",
    secondaryRange: "30d",
    metric: "chapters",
  });
  const [drillDownData, setDrillDownData] = useState<DrillDownData | null>(
    null,
  );
  const [drillDownOpen, setDrillDownOpen] = useState(false);

  /**
   * Loads all statistics data from storage and normalizes for display.
   * @source
   */
  const loadStatistics = useCallback(async () => {
    try {
      const stats = getImportStats();
      setImportStats(stats);

      const savedMatches = getSavedMatchResults();
      const normalizedMatches = normalizeMatchResults(savedMatches as unknown);
      setMatchResults(normalizedMatches);

      const syncRaw = await storage.getItemAsync(STORAGE_KEYS.SYNC_STATS);
      const parsedSync = parseSyncStats(syncRaw);
      setSyncStats(parsedSync);

      const history = getReadingHistory();
      setReadingHistory(history);

      setLastRefreshedAt(new Date().toISOString());
    } catch (error) {
      const errorId = generateErrorId();
      captureError(
        ErrorType.STORAGE,
        "Failed to load statistics",
        error instanceof Error ? error : new Error(String(error)),
        { errorId },
      );
      toast.error(
        `Unable to load statistics. Please try again. (ref: ${errorId})`,
      );
    }
  }, []);

  useEffect(() => {
    document.title = "Statistics • Kenmei to AniList";
  }, []);

  useEffect(() => {
    let active = true;

    const fetchData = async () => {
      setIsLoading(true);
      await loadStatistics();
      if (active) {
        setIsLoading(false);
      }
    };

    void fetchData();

    return () => {
      active = false;
    };
  }, [loadStatistics]);

  /**
   * Handles manual refresh of all statistics data.
   * @source
   */
  const handleRefresh = useCallback(async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    await loadStatistics();
    setIsRefreshing(false);
    toast.success("Statistics refreshed");
  }, [isRefreshing, loadStatistics]);

  /**
   * Handles clearing filters from error boundary.
   * @source
   */
  const handleClearFiltersFromBoundary = useCallback(() => {
    setStatisticsFilters(DEFAULT_STATISTICS_FILTERS);
    setComparisonMode({
      enabled: false,
      primaryRange: "30d",
      secondaryRange: "30d",
      metric: "chapters",
    });
    toast.success("Filters cleared");
  }, []);

  /**
   * Handles time range selection for filtered statistics views.
   * @param range - The selected time range period.
   * @source
   */
  const handleTimeRangeChange = useCallback((range: TimeRange) => {
    setSelectedTimeRange(range);
    console.debug(`[Statistics] Time range changed to: ${range}`);
  }, []);

  /**
   * Aggregates statistics using worker pool with caching
   * Replaces manual filtering and aggregation memos
   * @source
   */
  const { aggregationResult } = useStatisticsAggregation(
    matchResults,
    readingHistory,
    statisticsFilters,
    comparisonMode,
    selectedTimeRange,
  );

  /**
   * Memoized date range computed from selected time range.
   * Prevents unnecessary re-runs of useReadingHistoryFilter hook.
   */
  const dateRangeForFilter = useMemo(() => {
    const now = Date.now();
    const ranges = {
      "7d": 7 * 24 * 60 * 60 * 1000,
      "30d": 30 * 24 * 60 * 60 * 1000,
      "90d": 90 * 24 * 60 * 60 * 1000,
    };

    const msBack =
      selectedTimeRange === "all" ? Infinity : ranges[selectedTimeRange];
    const start = msBack === Infinity ? 0 : now - msBack;
    return { start, end: now };
  }, [selectedTimeRange]);

  /**
   * Filters reading history for the current time range using worker pool
   * Can be used to optimize chart rendering with pre-filtered and aggregated data
   */
  const { filterResult: historyFilterResult } = useReadingHistoryFilter(
    readingHistory,
    dateRangeForFilter,
    "daily", // Use daily aggregation for charts
  );

  // Use the filtered result for chart optimization
  // This enables zero-copy passing of pre-aggregated data
  if (historyFilterResult?.aggregatedData) {
    console.debug(
      `[Statistics] History filter complete: ${historyFilterResult.stats.totalEntries} entries aggregated`,
    );
  }

  // Fallback to original behavior if hook not ready or error
  const filteredData = aggregationResult?.filteredData || {
    matchResults,
    readingHistory,
  };
  const filterOptions = aggregationResult?.filterOptions || {
    genres: [],
    formats: [],
    statuses: [],
    tags: [],
  };
  const comparisonDatasets = aggregationResult?.comparisonDatasets ?? null;

  /**
   * Adapts filtered match results to MatchForExport format for export button.
   * @source
   */
  const adaptedMatchesForExport = useMemo(
    () => adaptMatchesForExport(filteredData.matchResults),
    [filteredData.matchResults],
  );

  /**
   * Handles filter changes from the filter panel.
   * @param filters - New filter state.
   * @source
   */
  const handleFiltersChange = useCallback((filters: StatisticsFilters) => {
    setStatisticsFilters(filters);
    console.debug("[Statistics] Filters updated:", filters);
  }, []);

  /**
   * Handles comparison mode changes.
   * @param mode - New comparison mode state.
   * @source
   */
  const handleComparisonChange = useCallback((mode: ComparisonMode) => {
    setComparisonMode(mode);
    console.debug("[Statistics] Comparison mode updated:", mode);
  }, []);

  /**
   * Handles drill-down clicks from charts.
   * @param data - Drill-down data to display.
   * @source
   */
  const handleDrillDown = useCallback((data: DrillDownData) => {
    setDrillDownData(data);
    setDrillDownOpen(true);
  }, []);

  /**
   * Handles export of drill-down data in selected format (JSON, CSV, or Markdown).
   * Uses filtered and sorted rows from the modal's processed data.
   * @source
   */
  const handleDrillDownExport = useCallback(
    async (format: ExportFormat, rows: Record<string, unknown>[]) => {
      if (!drillDownData || !rows) return;

      try {
        // Build export metadata
        const metadata = buildExportMetadata(format, rows.length, undefined, [
          drillDownData.type,
          drillDownData.value,
        ]);

        const baseFilename = `drill-down-${drillDownData.type}-${drillDownData.value}`;
        let file: string;

        switch (format) {
          case "json": {
            const payload = {
              drillDownType: drillDownData.type,
              drillDownValue: drillDownData.value,
              exportedAt: new Date().toISOString(),
              data: rows,
            };
            file = await exportToJson(
              payload as Record<string, unknown>,
              baseFilename,
            );
            break;
          }
          case "csv": {
            file = await exportToCSV(rows, baseFilename);
            break;
          }
          case "markdown": {
            file = exportToMarkdown(rows, baseFilename, metadata);
            break;
          }
          default:
            throw new Error(`Unsupported export format: ${format}`);
        }

        toast.success(
          `Drill-down data exported as ${format.toUpperCase()} to ${file}`,
        );
      } catch (error) {
        const errorId = generateErrorId();
        captureError(
          ErrorType.SYSTEM,
          "Failed to export drill-down data",
          error instanceof Error ? error : new Error(String(error)),
          {
            errorId,
            type: drillDownData?.type,
            value: drillDownData?.value,
            count: rows?.length,
          },
        );
        toast.error(`Failed to export drill-down data (ref: ${errorId})`);
      }
    },
    [drillDownData],
  );

  /**
   * Computes hero metrics including total imports, matched, and pending counts.
   * @source
   */
  const heroMetrics = useMemo(() => {
    const totalImported = importStats?.total ?? 0;
    const matchedCount = matchResults.filter((match) =>
      ["matched", "manual"].includes(match.status ?? ""),
    ).length;
    const pendingCount = matchResults.filter(
      (match) => match.status === "pending",
    ).length;
    const matchRate = totalImported > 0 ? matchedCount / totalImported : 0;
    return { totalImported, matchedCount, pendingCount, matchRate };
  }, [importStats, matchResults]);

  /**
   * Formats the last updated timestamp for display.
   * @source
   */
  const lastUpdatedLabel = useMemo(
    () => formatRelativeTime(lastRefreshedAt),
    [lastRefreshedAt],
  );

  const lastSyncLabel = useMemo(
    () => formatRelativeTime(syncStats?.lastSyncTime ?? null),
    [syncStats?.lastSyncTime],
  );

  const overviewCards = useMemo<OverviewCard[]>(() => {
    const percentFormatter = new Intl.NumberFormat(undefined, {
      style: "percent",
      minimumFractionDigits: 0,
      maximumFractionDigits: 1,
    });

    const numberFormatter = new Intl.NumberFormat(undefined, {
      maximumFractionDigits: 1,
    });

    const totalChaptersRead =
      historyFilterResult?.stats?.totalChaptersRead ?? 0;
    const averageChaptersPerDay =
      historyFilterResult?.stats?.averageChaptersPerDay ?? 0;

    const matchRateValue = heroMetrics.totalImported
      ? percentFormatter.format(heroMetrics.matchRate)
      : "—";

    return [
      {
        key: "imported",
        label: "Imported Titles",
        value: heroMetrics.totalImported.toLocaleString(),
        helper: `Pending: ${heroMetrics.pendingCount.toLocaleString()}`,
        icon: BookOpen,
        accent: "from-blue-500/15 via-sky-500/10 to-indigo-500/10",
        iconClass: "text-blue-600 dark:text-blue-300",
      },
      {
        key: "match-rate",
        label: "Match Completion",
        value: matchRateValue,
        helper: heroMetrics.totalImported
          ? `${heroMetrics.matchedCount.toLocaleString()} matched`
          : "Awaiting import",
        icon: CheckCircle2,
        accent: "from-emerald-500/15 via-teal-500/10 to-lime-500/10",
        iconClass: "text-emerald-600 dark:text-emerald-300",
      },
      {
        key: "reading",
        label: "Chapters Logged",
        value: totalChaptersRead.toLocaleString(),
        helper: totalChaptersRead
          ? `${numberFormatter.format(averageChaptersPerDay)} per day`
          : "No activity yet",
        icon: Activity,
        accent: "from-fuchsia-500/15 via-purple-500/10 to-pink-500/10",
        iconClass: "text-fuchsia-600 dark:text-fuchsia-300",
      },
      {
        key: "syncs",
        label: "Sync Activity",
        value: (syncStats?.totalSyncs ?? 0).toLocaleString(),
        helper: `Last sync: ${lastSyncLabel}`,
        icon: Clock,
        accent: "from-amber-500/15 via-orange-500/10 to-yellow-500/10",
        iconClass: "text-amber-600 dark:text-amber-300",
      },
    ];
  }, [
    historyFilterResult?.stats?.averageChaptersPerDay,
    historyFilterResult?.stats?.totalChaptersRead,
    heroMetrics.matchRate,
    heroMetrics.matchedCount,
    heroMetrics.pendingCount,
    heroMetrics.totalImported,
    lastSyncLabel,
    syncStats?.totalSyncs,
  ]);

  /**
   * Determines if there is any data available to display in the current filtered scope.
   * @source
   */
  const hasAnyData = useMemo(() => {
    const hasImport = (importStats?.total ?? 0) > 0;
    const hasFilteredMatches = filteredData.matchResults.length > 0;
    const hasSync = !!(syncStats && syncStats.totalSyncs > 0);
    const hasFilteredHistory = !!(
      filteredData.readingHistory &&
      filteredData.readingHistory.entries.length > 0
    );
    return hasImport || hasFilteredMatches || hasSync || hasFilteredHistory;
  }, [importStats, filteredData, syncStats]);

  /**
   * Generates skeleton card keys for loading state.
   * @source
   */
  const skeletonKeys = useMemo(
    () => [
      "status",
      "format",
      "sync",
      "timeline",
      "genres",
      "chapters",
      "trends",
      "velocity",
      "habits",
    ],
    [],
  );

  const overviewSkeletonKeys = useMemo(
    () => ["imported", "match", "reading", "sync"],
    [],
  );

  /**
   * Renders the loading state with skeleton cards.
   */
  const renderLoadingState = (): React.ReactNode => (
    <section className="space-y-8">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {overviewSkeletonKeys.map((key) => (
          <SkeletonCard key={`statistics-overview-skeleton-${key}`} />
        ))}
      </div>
      <section className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {skeletonKeys.map((key) => (
          <SkeletonCard key={`statistics-skeleton-${key}`} />
        ))}
      </section>
    </section>
  );

  /**
   * Renders the empty state when no statistics are available.
   */
  const renderEmptyState = (): React.ReactNode => (
    <section className="flex flex-col items-center justify-center gap-4 rounded-3xl border border-dashed border-slate-200 bg-white/80 p-12 text-center shadow-sm dark:border-slate-800 dark:bg-slate-950/70">
      <AlertCircle className="h-10 w-10 text-amber-500" aria-hidden="true" />
      <div className="space-y-2">
        <h2 className="text-xl font-semibold">No statistics available yet</h2>
        <p className="text-muted-foreground">
          Import your Kenmei library and review matches to unlock detailed
          analytics.
        </p>
      </div>
      <Button asChild size="lg" className="gap-2">
        <Link to="/import">
          Start Import
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </Button>
    </section>
  );

  /**
   * Determines the main content to render based on loading and data availability states.
   * Extracts conditional logic to reduce cognitive complexity.
   */
  const getMainContent = (): React.ReactNode => {
    if (isLoading) {
      return renderLoadingState();
    }

    if (!hasAnyData) {
      return renderEmptyState();
    }

    return (
      <motion.section
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="space-y-10"
      >
        <motion.div variants={itemVariants} className="w-full">
          <StatisticsFilterPanel
            filters={statisticsFilters}
            onFiltersChange={handleFiltersChange}
            availableGenres={filterOptions.genres}
            availableFormats={filterOptions.formats}
            availableStatuses={
              filterOptions.statuses as import("@/api/anilist/types").MatchStatus[]
            }
            availableTags={filterOptions.tags}
            matchCount={filteredData.matchResults.length}
          />
        </motion.div>

        <motion.section variants={itemVariants} className="space-y-4">
          <div className="flex flex-col gap-1">
            <h2 className="text-xl font-semibold tracking-tight">
              Performance Snapshot
            </h2>
            <p className="text-muted-foreground text-sm">
              Monitor match coverage and sync reliability at a glance.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <div className="w-full">
              <StatusDistributionChart
                data={importStats?.statusCounts ?? null}
                onDrillDown={handleDrillDown}
                matchResults={filteredData.matchResults}
              />
            </div>
            <div className="w-full">
              <FormatDistributionChart
                matchResults={filteredData.matchResults}
                onDrillDown={handleDrillDown}
                filteredMatchResults={filteredData.matchResults}
                readingHistory={filteredData.readingHistory}
              />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="w-full">
              <MatchProgressChart matchResults={matchResults} />
            </div>
            <div className="w-full">
              <SyncMetricsChart syncStats={syncStats} />
            </div>
          </div>
        </motion.section>

        <motion.section variants={itemVariants} className="space-y-4">
          <div className="flex flex-col gap-1">
            <h2 className="text-xl font-semibold tracking-tight">
              Reading Engagement
            </h2>
            <p className="text-muted-foreground text-sm">
              Understand momentum and habits across your selected time range.
            </p>
          </div>
          <div className="space-y-6">
            <ReadingTrendsChart
              history={filteredData.readingHistory}
              timeRange={selectedTimeRange}
              enableZoom={true}
              matchResults={filteredData.matchResults}
              onDrillDown={
                comparisonMode.metric === "chapters"
                  ? handleDrillDown
                  : undefined
              }
              comparisonData={
                comparisonMode.enabled && comparisonMode.metric === "chapters"
                  ? comparisonDatasets?.secondary.trends
                  : undefined
              }
              comparisonLabel={
                comparisonMode.enabled && comparisonMode.metric === "chapters"
                  ? comparisonDatasets?.secondaryLabel
                  : undefined
              }
            />
          </div>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="w-full">
              <ReadingVelocityChart
                history={filteredData.readingHistory}
                timeRange={selectedTimeRange}
                comparisonData={
                  comparisonMode.enabled && comparisonMode.metric === "velocity"
                    ? comparisonDatasets?.secondary.velocity
                    : undefined
                }
                comparisonLabel={
                  comparisonMode.enabled && comparisonMode.metric === "velocity"
                    ? comparisonDatasets?.secondaryLabel
                    : undefined
                }
              />
            </div>
            <div className="w-full">
              <ReadingHabitsChart
                history={filteredData.readingHistory}
                timeRange={selectedTimeRange}
                comparisonData={
                  comparisonMode.enabled && comparisonMode.metric === "habits"
                    ? comparisonDatasets?.secondary.habits
                    : undefined
                }
                comparisonLabel={
                  comparisonMode.enabled && comparisonMode.metric === "habits"
                    ? comparisonDatasets?.secondaryLabel
                    : undefined
                }
              />
            </div>
          </div>
        </motion.section>

        <motion.section variants={itemVariants} className="space-y-4">
          <div className="flex flex-col gap-1">
            <h2 className="text-xl font-semibold tracking-tight">
              Library Discovery
            </h2>
            <p className="text-muted-foreground text-sm">
              Explore the genres and titles powering your collection.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="w-full">
              <TopGenresChart
                matchResults={filteredData.matchResults}
                onDrillDown={handleDrillDown}
                filteredMatchResults={filteredData.matchResults}
                readingHistory={filteredData.readingHistory}
              />
            </div>
            <div className="w-full">
              <ChaptersReadDistributionChart
                matchResults={filteredData.matchResults}
              />
            </div>
          </div>
        </motion.section>
      </motion.section>
    );
  };

  /**
   * Determines whether to show the header controls (time range and comparison toggle).
   */
  const shouldShowHeaderControls = hasAnyData && !isLoading;

  /**
   * Renders the header overview cards conditionally based on loading and data state.
   */
  const getHeaderOverviewCards = (): React.ReactNode => {
    if (isLoading) {
      return (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {overviewSkeletonKeys.map((key) => (
            <SkeletonCard key={`statistics-header-skeleton-${key}`} />
          ))}
        </div>
      );
    }

    if (hasAnyData) {
      return (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {overviewCards.map((card) => (
            <OverviewCardComponent
              key={`statistics-overview-${card.key}`}
              card={card}
            />
          ))}
        </div>
      );
    }

    return null;
  };

  const content = getMainContent();
  return (
    <main className="container mx-auto px-4 py-10">
      <StatisticsErrorBoundary
        onRefresh={handleRefresh}
        onClearFilters={handleClearFiltersFromBoundary}
      >
        <motion.section
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="mb-10"
        >
          <motion.div
            variants={itemVariants}
            className="space-y-6 rounded-3xl border border-slate-200 bg-white/90 p-8 shadow-lg backdrop-blur-md dark:border-slate-800 dark:bg-slate-950/80"
          >
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-start gap-4">
                <span className="bg-linear-to-br inline-flex h-12 w-12 items-center justify-center rounded-2xl from-blue-500/20 via-purple-500/20 to-fuchsia-500/20 text-blue-500 dark:text-blue-300">
                  <BarChart3 className="h-6 w-6" aria-hidden="true" />
                </span>
                <div className="space-y-1">
                  <h1 className="text-3xl font-semibold tracking-tight">
                    Library Statistics
                  </h1>
                  <p className="text-muted-foreground text-sm">
                    Comprehensive insights into your Kenmei to AniList
                    migration.
                  </p>
                  <p className="text-muted-foreground text-xs">
                    Last refreshed: {lastUpdatedLabel}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  variant="ghost"
                  onClick={handleRefresh}
                  disabled={isRefreshing}
                  className="gap-2"
                >
                  {isRefreshing ? (
                    <Loader2
                      className="h-4 w-4 animate-spin"
                      aria-hidden="true"
                    />
                  ) : (
                    <RefreshCw className="h-4 w-4" aria-hidden="true" />
                  )}
                  Refresh
                </Button>
                <ExportStatisticsButton
                  importStats={importStats}
                  syncStats={syncStats}
                  matchResults={adaptedMatchesForExport}
                  disabled={!hasAnyData}
                  appliedFilters={statisticsFilters}
                  comparisonMode={comparisonMode}
                  isFiltered={areFiltersActive(
                    statisticsFilters,
                    DEFAULT_STATISTICS_FILTERS,
                  )}
                />
                {shouldShowHeaderControls ? (
                  <>
                    <TimeRangeSelector
                      value={selectedTimeRange}
                      onChange={handleTimeRangeChange}
                    />
                    <ComparisonToggle
                      comparisonMode={comparisonMode}
                      onComparisonChange={handleComparisonChange}
                      disabled={!hasAnyData}
                    />
                  </>
                ) : null}
              </div>
            </div>

            {getHeaderOverviewCards()}
          </motion.div>
        </motion.section>

        {content}

        {/* Drill-Down Modal */}
        <DrillDownModal
          open={drillDownOpen}
          onOpenChange={setDrillDownOpen}
          drillDownData={drillDownData}
          onExport={handleDrillDownExport}
        />
      </StatisticsErrorBoundary>
    </main>
  );
}
