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
import {
  BarChart3,
  RefreshCw,
  ArrowRight,
  AlertCircle,
  Loader2,
} from "lucide-react";
import {
  StatusDistributionChart,
  TopGenresChart,
  MatchProgressChart,
  SyncMetricsChart,
  FormatDistributionChart,
  ChaptersReadDistributionChart,
} from "@/components/statistics";
import type { SyncStats } from "@/types/sync";
import { ExportStatisticsButton } from "@/components/statistics/ExportStatisticsButton";
import {
  getImportStats,
  getSavedMatchResults,
  storage,
  STORAGE_KEYS,
  type ImportStats,
} from "@/utils/storage";
import { formatRelativeTime } from "@/utils/timeUtils";
import {
  normalizeMatchResults,
  parseSyncStats,
  type NormalizedMatchForStats,
} from "@/utils/statisticsAdapter";
import { SkeletonCard } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

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
 * StatisticsPage component – visual analytics for import, match, and sync data.
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

      setLastRefreshedAt(new Date().toISOString());
    } catch (error) {
      console.error("[Statistics] ❌ Failed to load statistics", error);
      toast.error("Unable to load statistics. Please try again.");
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

  const handleRefresh = useCallback(async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    await loadStatistics();
    setIsRefreshing(false);
    toast.success("Statistics refreshed");
  }, [isRefreshing, loadStatistics]);

  const heroMetrics = useMemo(() => {
    const totalImported = importStats?.total ?? 0;
    const matchedCount = matchResults.filter((match) =>
      ["matched", "manual"].includes(match.status ?? ""),
    ).length;
    const pendingCount = matchResults.filter(
      (match) => match.status === "pending",
    ).length;
    return { totalImported, matchedCount, pendingCount };
  }, [importStats, matchResults]);

  const lastUpdatedLabel = useMemo(
    () => formatRelativeTime(lastRefreshedAt),
    [lastRefreshedAt],
  );

  const hasAnyData = useMemo(() => {
    const hasImport = (importStats?.total ?? 0) > 0;
    const hasMatches = matchResults.length > 0;
    const hasSync = !!(syncStats && syncStats.totalSyncs > 0);
    return hasImport || hasMatches || hasSync;
  }, [importStats, matchResults, syncStats]);

  const skeletonKeys = useMemo(
    () => ["status", "format", "sync", "timeline", "genres", "chapters"],
    [],
  );

  let content: React.ReactNode;
  if (isLoading) {
    content = (
      <section className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {skeletonKeys.map((key) => (
          <SkeletonCard key={`statistics-skeleton-${key}`} />
        ))}
      </section>
    );
  } else if (hasAnyData) {
    content = (
      <motion.section
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="space-y-6"
      >
        {/* Row 1: Status and Format Distribution */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <motion.div variants={itemVariants}>
            <StatusDistributionChart data={importStats?.statusCounts ?? null} />
          </motion.div>
          <motion.div variants={itemVariants}>
            <FormatDistributionChart matchResults={matchResults} />
          </motion.div>
        </div>

        {/* Row 2: Chapters Read Distribution (Horizontal) */}
        <motion.div variants={itemVariants}>
          <ChaptersReadDistributionChart matchResults={matchResults} />
        </motion.div>

        {/* Row 3: Top Genres */}
        <motion.div variants={itemVariants}>
          <TopGenresChart matchResults={matchResults} />
        </motion.div>

        {/* Row 4: Match Progress */}
        <motion.div variants={itemVariants}>
          <MatchProgressChart matchResults={matchResults} />
        </motion.div>

        {/* Row 5: Sync Metrics (Horizontal) */}
        <motion.div variants={itemVariants}>
          <SyncMetricsChart syncStats={syncStats} />
        </motion.div>
      </motion.section>
    );
  } else {
    content = (
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
  }

  return (
    <main className="container mx-auto px-4 py-10">
      <motion.section
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="mb-10"
      >
        <motion.div
          variants={itemVariants}
          className="flex flex-col gap-6 rounded-3xl border border-slate-200 bg-white/90 p-8 shadow-lg backdrop-blur-md dark:border-slate-800 dark:bg-slate-950/80"
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="mb-3 flex items-center gap-3">
                <span className="bg-linear-to-r inline-flex h-12 w-12 items-center justify-center rounded-2xl from-blue-500/20 via-purple-500/20 to-fuchsia-500/20 text-blue-500 dark:text-blue-300">
                  <BarChart3 className="h-6 w-6" aria-hidden="true" />
                </span>
                <div>
                  <h1 className="text-3xl font-semibold tracking-tight">
                    Library Statistics
                  </h1>
                  <p className="text-muted-foreground mt-1 text-sm">
                    Comprehensive insights into your Kenmei to AniList
                    migration.
                  </p>
                </div>
              </div>
              <div className="text-muted-foreground flex flex-wrap gap-2 text-sm">
                <Badge
                  variant="secondary"
                  className="bg-blue-500/15 text-blue-600 dark:text-blue-300"
                >
                  Total imported: {heroMetrics.totalImported.toLocaleString()}
                </Badge>
                <Badge
                  variant="secondary"
                  className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-300"
                >
                  Matched: {heroMetrics.matchedCount.toLocaleString()}
                </Badge>
                <Badge
                  variant="secondary"
                  className="bg-amber-500/15 text-amber-600 dark:text-amber-300"
                >
                  Pending: {heroMetrics.pendingCount.toLocaleString()}
                </Badge>
                <Badge
                  variant="secondary"
                  className="bg-purple-500/15 text-purple-600 dark:text-purple-300"
                >
                  Last updated: {lastUpdatedLabel}
                </Badge>
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
                matchResults={matchResults}
                disabled={!hasAnyData}
              />
            </div>
          </div>
        </motion.div>
      </motion.section>

      {content}
    </main>
  );
}
