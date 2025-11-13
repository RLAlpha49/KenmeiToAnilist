/**
 * @packageDocumentation
 * @module HomePage
 * @description Home page component for the Kenmei to AniList sync tool. Displays dashboard, statistics, feature carousel, quick actions, and sync status.
 */

import React, { useState, useEffect, useMemo } from "react";
import { Link } from "@tanstack/react-router";
import {
  AlertCircle,
  Clock,
  BarChart2,
  Download,
  Library,
  RefreshCw,
  Sparkles,
  UserCheck,
  ClipboardCheck,
  ChevronRight,
  Settings,
  CheckCheck,
  ArrowUpRight,
  HelpCircle,
} from "lucide-react";
import { useAuthState } from "../hooks/useAuth";
import {
  getImportStats,
  storage,
  STORAGE_KEYS,
  getSavedMatchResults,
} from "../utils/storage";
import { motion, AnimatePresence } from "framer-motion";
import { useOnboarding } from "@/contexts/OnboardingContext";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";

interface StatsState {
  total: number;
  reading: number;
  completed: number;
  onHold: number;
  dropped: number;
  planToRead: number;
  lastSync: string | null;
  syncStatus: string;
}

/** Sync statistics data structure. @source */
interface SyncStats {
  lastSyncTime: string | null;
  entriesSynced: number;
  failedSyncs: number;
  totalSyncs: number;
}

/** Match review status type. @source */
type MatchStatusType = "none" | "pending" | "complete";

/** Match result object structure. @source */
interface MatchResult {
  status?: string;
  selectedMatch?: {
    id: number;
    title: string;
    [key: string]: unknown;
  } | null;
  needsReview?: boolean;
  [key: string]: unknown;
}

/**
 * Returns an empty match status object with default values.
 * @returns An object representing no matches to review.
 * @source
 */
const getEmptyMatchStatus = (): {
  pendingMatches: number;
  skippedMatches: number;
  totalMatches: number;
  status: MatchStatusType;
} => ({
  pendingMatches: 0,
  skippedMatches: 0,
  totalMatches: 0,
  status: "none",
});

/**
 * Calculates counts of pending and skipped manga matches.
 * @param entries - Array of match result objects to analyze.
 * @returns Object with pending and skipped counts.
 * @source
 */
const calculateMatchCounts = (entries: unknown[]) => {
  let pendingCount = 0;
  let skippedCount = 0;

  for (const result of entries) {
    const matchResult = result as MatchResult;

    if (matchResult.status === "skipped") {
      skippedCount++;
      continue;
    }

    const needsReview =
      matchResult.status === "pending" ||
      (matchResult.needsReview === true && !matchResult.selectedMatch) ||
      (matchResult.status !== "skipped" && !matchResult.selectedMatch);

    if (needsReview) pendingCount++;
  }

  return { pendingCount, skippedCount };
};

/**
 * Determines the primary action button text and link based on authentication and sync progress.
 * @param isAuthenticated - Whether the user is authenticated with AniList.
 * @param totalEntries - Total number of imported manga entries.
 * @param pendingMatches - Number of matches awaiting review.
 * @param totalSyncs - Number of completed syncs.
 * @returns An object with label, href, and gradient tone for the action button.
 * @source
 */
const getHeroAction = (
  isAuthenticated: boolean,
  totalEntries: number,
  pendingMatches: number,
  totalSyncs: number,
) => {
  if (!isAuthenticated) {
    return {
      label: "Connect AniList",
      href: "/settings",
      tone: "from-blue-500 via-indigo-500 to-purple-500",
    };
  }

  if (totalEntries === 0) {
    return {
      label: "Start Import",
      href: "/import",
      tone: "from-green-500 via-emerald-500 to-teal-500",
    };
  }

  if (pendingMatches > 0) {
    return {
      label: "Review Matches",
      href: "/review",
      tone: "from-amber-500 via-orange-500 to-rose-500",
    };
  }

  if (totalSyncs === 0) {
    return {
      label: "Configure Sync",
      href: "/settings",
      tone: "from-purple-500 via-blue-500 to-indigo-500",
    };
  }

  return {
    label: "Run Sync",
    href: "/sync",
    tone: "from-fuchsia-500 via-purple-500 to-blue-500",
  };
};

/**
 * Generates a footnote text describing the review status.
 * @param pendingMatches - Number of matches awaiting review.
 * @param status - The current match review status.
 * @returns A descriptive footnote string for display.
 * @source
 */
const getReviewFootnote = (pendingMatches: number, status: MatchStatusType) => {
  if (pendingMatches > 0) {
    return `${pendingMatches.toLocaleString()} pending`;
  }
  if (status === "complete") {
    return "All clear";
  }
  return "Auto-matched";
};

/**
 * Generates the review quick action configuration based on import and auth state.
 * @param totalEntries - Total number of imported manga entries.
 * @param isAuthenticated - Whether the user is authenticated with AniList.
 * @param username - The AniList username or null if not authenticated.
 * @param footnote - Descriptive text for the action's status.
 * @returns An object containing action configuration (label, description, icon, etc.).
 * @source
 */
const getReviewAction = (
  totalEntries: number,
  isAuthenticated: boolean,
  username: string | null | undefined,
  footnote: string,
) => {
  if (totalEntries > 0) {
    return {
      key: "review",
      label: "Review matches",
      description: "Verify smart matches before syncing",
      to: "/review",
      icon: ClipboardCheck,
      tone: "from-emerald-500/20 via-green-500/20 to-transparent",
      iconClass: "text-emerald-600 dark:text-emerald-300",
      badgeClass: "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300",
      footnote,
    };
  }

  return {
    key: "connect",
    label: isAuthenticated ? "AniList connected" : "Connect AniList",
    description: isAuthenticated
      ? username || "Authenticated user"
      : "Authorize AniList to unlock syncing",
    to: "/settings",
    icon: isAuthenticated ? UserCheck : AlertCircle,
    tone: "from-purple-500/20 via-blue-500/20 to-transparent",
    iconClass: isAuthenticated
      ? "text-emerald-600 dark:text-emerald-300"
      : "text-blue-600 dark:text-blue-300",
    badgeClass: isAuthenticated
      ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300"
      : "bg-blue-500/20 text-blue-700 dark:text-blue-300",
    footnote: isAuthenticated ? "Ready to review" : "Authentication required",
  };
};

/**
 * Renders a badge displaying the manga match review status and pending count.
 * @param matchStatus - An object containing the review status and pending match count.
 * @returns A JSX Badge component reflecting the current match status.
 * @source
 */
const renderMatchStatusBadge = (matchStatus: {
  status: MatchStatusType;
  pendingMatches: number;
}) => {
  const formatNumber = (value: number) => value.toLocaleString();

  let badgeClass = "";
  let badgeText = "";

  if (matchStatus.status === "complete") {
    badgeClass = "bg-emerald-500/20 text-emerald-900 dark:text-emerald-200";
    badgeText = "Review complete";
  } else if (matchStatus.status === "pending") {
    badgeClass = "bg-amber-400/20 text-amber-900 dark:text-amber-300";
    badgeText = `${formatNumber(matchStatus.pendingMatches)} waiting`;
  } else {
    badgeClass = "bg-muted text-muted-foreground";
    badgeText = "Import first";
  }

  return (
    <Badge
      variant="outline"
      className={`rounded-full border-transparent px-3 py-1 text-xs font-semibold ${badgeClass}`}
    >
      {badgeText}
    </Badge>
  );
};

/**
 * Framer Motion animation configuration for child elements with spring physics.
 * @source
 */
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
 * Home page component for the Kenmei to AniList sync tool.
 *
 * Displays dashboard statistics, feature carousel, quick actions, and sync status for the user.
 *
 * @source
 */
export function HomePage() {
  // Get auth state to check authentication status
  const { authState } = useAuthState();
  const { startOnboarding: startOnboardingFlow, isActive: isOnboardingActive } =
    useOnboarding();

  // State for dashboard data
  const [stats, setStats] = useState<StatsState>({
    total: 0,
    reading: 0,
    completed: 0,
    onHold: 0,
    dropped: 0,
    planToRead: 0,
    lastSync: null,
    syncStatus: "none",
  });
  const [matchStatus, setMatchStatus] = useState<{
    pendingMatches: number;
    skippedMatches: number;
    totalMatches: number;
    status: "none" | "pending" | "complete";
  }>({
    pendingMatches: 0,
    skippedMatches: 0,
    totalMatches: 0,
    status: "none",
  });

  // Version status state
  const [syncStats, setSyncStats] = useState<SyncStats>({
    lastSyncTime: null,
    entriesSynced: 0,
    failedSyncs: 0,
    totalSyncs: 0,
  });

  // Loading and error state
  const [loadError, setLoadError] = useState<string | null>(null);

  // Load import stats & related data on mount
  useEffect(() => {
    const loadImportStats = () => {
      try {
        const importStats = getImportStats();
        if (!importStats) return;

        const statusCounts = importStats.statusCounts || {};
        setStats((prev) => ({
          ...prev,
          total: importStats.total || 0,
          reading: statusCounts.reading || 0,
          completed: statusCounts.completed || 0,
          dropped: statusCounts.dropped || 0,
          onHold: statusCounts.on_hold || 0,
          planToRead: statusCounts.plan_to_read || 0,
          lastSync: importStats.timestamp || null,
        }));
      } catch (error) {
        console.error("[HomePage] ❌ Error loading import stats:", error);
        setLoadError("Failed to load import statistics");
      }
    };

    const parseMatchResults = () => {
      try {
        console.debug("[HomePage] 🔍 Loading match results...");
        const matchResults = getSavedMatchResults();
        if (!matchResults || matchResults.length === 0) {
          console.debug("[HomePage] 🔍 No match results found");
          setMatchStatus(getEmptyMatchStatus());
          return;
        }

        const entries = matchResults;
        const totalCount = entries.length;

        if (totalCount === 0) {
          console.debug("[HomePage] 🔍 Match results empty");
          setMatchStatus(getEmptyMatchStatus());
          return;
        }

        const { pendingCount, skippedCount } = calculateMatchCounts(entries);

        console.info(
          `[HomePage] ✅ Loaded match status: ${totalCount} total, ${pendingCount} pending, ${skippedCount} skipped`,
        );

        setMatchStatus({
          pendingMatches: pendingCount,
          skippedMatches: skippedCount,
          totalMatches: totalCount,
          status: pendingCount === 0 ? "complete" : "pending",
        });
      } catch (error) {
        console.error("[HomePage] ❌ Error retrieving match status:", error);
      }
    };

    const loadSyncStats = () => {
      try {
        console.debug("[HomePage] 🔍 Loading sync stats...");
        const raw = storage.getItem(STORAGE_KEYS.SYNC_STATS) || "{}";
        const parsed = JSON.parse(raw);
        setSyncStats({
          lastSyncTime: parsed.lastSyncTime || null,
          entriesSynced: parsed.entriesSynced || 0,
          failedSyncs: parsed.failedSyncs || 0,
          totalSyncs: parsed.totalSyncs || 0,
        });
        console.info(
          `[HomePage] ✅ Loaded sync stats: ${parsed.totalSyncs || 0} total syncs, ${parsed.entriesSynced || 0} entries synced`,
        );
      } catch (error) {
        console.error("[HomePage] ❌ Error loading sync stats:", error);
        setSyncStats({
          lastSyncTime: null,
          entriesSynced: 0,
          failedSyncs: 0,
          totalSyncs: 0,
        });
        setLoadError("Failed to load sync statistics");
      }
    };

    console.debug("[HomePage] 🔍 Initializing HomePage data...");
    setLoadError(null);
    loadImportStats();
    parseMatchResults();
    loadSyncStats();
  }, []);

  const handleRestartOnboarding = () => {
    startOnboardingFlow();
  };

  /**
   * Formats a number with locale-specific thousand separators.
   * @param value - The number to format.
   * @returns Formatted number string with locale separators.
   * @source
   */
  const formatNumber = (value: number) => value.toLocaleString();

  /**
   * Formats a date string into a human-readable local date and time.
   * @param dateString - ISO date string or null.
   * @returns Formatted date and time string or "Never" if null.
   * @source
   */
  const formatDate = (dateString: string | null) => {
    if (!dateString) return "Never";

    try {
      const date = new Date(dateString);
      return (
        date.toLocaleDateString() +
        " " +
        date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      );
    } catch (error) {
      console.warn("[HomePage] ⚠️ Invalid date format:", dateString, error);
      return "Invalid date";
    }
  };

  const heroAction = useMemo(
    () =>
      getHeroAction(
        authState.isAuthenticated,
        stats.total,
        matchStatus.pendingMatches,
        syncStats.totalSyncs,
      ),
    [
      authState.isAuthenticated,
      stats.total,
      matchStatus.pendingMatches,
      syncStats.totalSyncs,
    ],
  );

  const heroHighlights = useMemo(
    () => [
      {
        label: "Imported Entries",
        value: stats.total,
        icon: Library,
        accent: "text-blue-500 dark:text-blue-400",
      },
      {
        label: "Pending Review",
        value: matchStatus.pendingMatches,
        icon: ClipboardCheck,
        accent: "text-amber-500 dark:text-amber-400",
      },
      {
        label: "Entries Synced",
        value: syncStats.entriesSynced,
        icon: CheckCheck,
        accent: "text-emerald-500 dark:text-emerald-400",
      },
    ],
    [stats.total, matchStatus.pendingMatches, syncStats.entriesSynced],
  );

  const statusBreakdown = useMemo(
    () => [
      {
        label: "Reading",
        value: stats.reading,
        gradient: "from-sky-500 to-blue-500",
      },
      {
        label: "Completed",
        value: stats.completed,
        gradient: "from-green-500 to-emerald-500",
      },
      {
        label: "On Hold",
        value: stats.onHold,
        gradient: "from-amber-500 to-orange-500",
      },
      {
        label: "Plan to Read",
        value: stats.planToRead,
        gradient: "from-purple-500 to-indigo-500",
      },
      {
        label: "Dropped",
        value: stats.dropped,
        gradient: "from-rose-500 to-red-500",
      },
    ],
    [
      stats.reading,
      stats.completed,
      stats.onHold,
      stats.planToRead,
      stats.dropped,
    ],
  );

  let matchStatusText: string;
  if (matchStatus.status === "none") {
    matchStatusText = "Waiting";
  } else if (matchStatus.status === "pending") {
    matchStatusText = "Needs Review";
  } else {
    matchStatusText = "Complete";
  }

  const syncSuccessRate =
    syncStats.entriesSynced + syncStats.failedSyncs > 0
      ? Math.round(
          (syncStats.entriesSynced /
            Math.max(syncStats.entriesSynced + syncStats.failedSyncs, 1)) *
            100,
        )
      : null;

  const reviewFootnote = getReviewFootnote(
    matchStatus.pendingMatches,
    matchStatus.status,
  );

  const reviewAction = getReviewAction(
    stats.total,
    authState.isAuthenticated,
    authState.username,
    reviewFootnote,
  );

  const quickActionConfigs = [
    {
      key: "import",
      label: "Import data",
      description: "Upload your Kenmei CSV export",
      to: "/import",
      icon: Download,
      tone: "from-blue-500/20 via-indigo-500/20 to-transparent",
      iconClass: "text-blue-600 dark:text-blue-300",
      badgeClass: "bg-blue-500/20 text-blue-700 dark:text-blue-300",
      footnote:
        stats.total > 0
          ? `${formatNumber(stats.total)} imported`
          : "New import",
    },
    reviewAction,
    {
      key: "sync",
      label: "Synchronize",
      description: "Push your curated list to AniList",
      to: "/sync",
      icon: RefreshCw,
      tone: "from-fuchsia-500/20 via-purple-500/20 to-transparent",
      iconClass: "text-purple-600 dark:text-purple-300",
      badgeClass: "bg-fuchsia-500/20 text-purple-700 dark:text-purple-300",
      footnote:
        syncStats.entriesSynced > 0
          ? `${formatNumber(syncStats.entriesSynced)} synced`
          : "Ready when reviewed",
    },
    {
      key: "settings",
      label: "Settings",
      description: "Tune sync priorities and privacy rules",
      to: "/settings",
      icon: Settings,
      tone: "from-amber-500/20 via-orange-500/20 to-transparent",
      iconClass: "text-amber-600 dark:text-amber-300",
      badgeClass: "bg-amber-500/20 text-amber-700 dark:text-amber-300",
      footnote: "Customize automation",
    },
  ];

  return (
    <>
      <AnimatePresence mode="wait"></AnimatePresence>
      <div className="relative min-h-screen overflow-hidden">
        {/* Error notification banner */}
        {loadError && (
          <div className="fixed left-0 right-0 top-0 z-50 border-b border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-950/50">
            <div className="container mx-auto flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
                <span className="text-sm font-medium text-red-800 dark:text-red-300">
                  {loadError}
                </span>
              </div>
              <button
                onClick={() => setLoadError(null)}
                className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                aria-label="Dismiss error"
              >
                ✕
              </button>
            </div>
          </div>
        )}
        <div className="pointer-events-none absolute inset-0">
          <div className="bg-linear-to-br absolute -left-1/4 top-[-10%] h-[460px] w-[460px] rounded-full from-sky-400/25 via-blue-500/15 to-transparent blur-[180px]" />
          <div className="bg-linear-to-br absolute right-[-15%] top-[35%] h-[380px] w-[380px] rounded-full from-emerald-400/20 via-teal-400/15 to-transparent blur-[160px]" />
          <div className="bg-linear-to-br absolute bottom-[-25%] left-1/2 h-[360px] w-[520px] -translate-x-1/2 rounded-full from-rose-400/20 via-orange-300/15 to-transparent blur-[200px]" />
        </div>

        <motion.main
          className="container relative mx-auto px-4 py-12 md:px-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
        >
          <motion.section
            className="mb-12"
            variants={itemVariants}
            initial="hidden"
            animate="show"
          >
            <div>
              <div className="bg-linear-to-br relative overflow-hidden rounded-3xl border border-white/30 from-white/80 via-white/60 to-white/30 p-8 shadow-2xl backdrop-blur-xl dark:border-white/10 dark:from-slate-950/70 dark:via-slate-950/60 dark:to-slate-950/40">
                <div className="pointer-events-none absolute -left-28 -top-40 h-72 w-72 rounded-full bg-blue-500/20 blur-3xl" />
                <div className="pointer-events-none absolute bottom-[-140px] right-[-60px] h-64 w-64 rounded-full bg-purple-500/25 blur-3xl" />
                <div className="relative z-10 flex flex-col gap-8">
                  <div className="space-y-4">
                    <Badge
                      variant="outline"
                      className="text-foreground/70 w-fit rounded-full border-white/50 bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-white/10"
                    >
                      Kenmei ✦ AniList
                    </Badge>
                    <div className="space-y-4">
                      <h1 className="text-foreground text-4xl font-semibold tracking-tight md:text-5xl lg:text-6xl">
                        Move your library from Kenmei ➝ AniList with ease
                      </h1>
                      <p className="text-muted-foreground text-lg md:max-w-2xl">
                        Follow a guided journey to import, review, and sync your
                        manga collection.
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <Button
                      asChild
                      size="lg"
                      className={`bg-linear-to-r group h-auto rounded-full ${heroAction.tone} px-6 py-3 text-base font-semibold text-white shadow-lg transition hover:shadow-xl focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-950`}
                    >
                      <Link
                        to={heroAction.href}
                        className="flex items-center gap-2"
                      >
                        <span>{heroAction.label}</span>
                        <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                      </Link>
                    </Button>
                    {!isOnboardingActive && (
                      <Button
                        onClick={handleRestartOnboarding}
                        variant="ghost"
                        size="lg"
                        className="h-auto rounded-full px-6 py-3 text-base font-semibold"
                      >
                        <HelpCircle className="mr-2 h-4 w-4" />
                        Start guided tour
                      </Button>
                    )}
                  </div>
                  <div className="grid gap-4 sm:grid-cols-3">
                    {heroHighlights.map((metric) => {
                      const Icon = metric.icon;
                      return (
                        <div
                          key={metric.label}
                          className="group rounded-2xl border border-white/40 bg-white/75 p-4 shadow-sm backdrop-blur-sm transition hover:-translate-y-1 hover:shadow-xl dark:border-white/10 dark:bg-slate-950/70"
                        >
                          <section
                            aria-label={`${metric.label}: ${formatNumber(metric.value)}`}
                          >
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/70 shadow-sm dark:bg-slate-900/75">
                              <Icon
                                className={`h-5 w-5 ${metric.accent}`}
                                aria-hidden="true"
                              />
                            </div>
                            <p className="mt-3 text-2xl font-semibold">
                              {formatNumber(metric.value)}
                            </p>
                            <p className="text-muted-foreground text-sm">
                              {metric.label}
                            </p>
                          </section>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </motion.section>

          <motion.section
            className="mb-12 space-y-4"
            variants={itemVariants}
            initial="hidden"
            animate="show"
          >
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-2xl font-semibold">Action board</h2>
                <p className="text-muted-foreground text-sm">
                  Quick commands to move your migration forward.
                </p>
              </div>
              <Badge
                variant="outline"
                className="text-foreground/70 w-fit rounded-full border-white/30 bg-white/60 px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.2em] dark:border-white/10 dark:bg-slate-950/60"
              >
                Guided flow
              </Badge>
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {quickActionConfigs.map((action) => {
                const ActionIcon = action.icon;
                return (
                  <Link
                    key={action.key}
                    to={action.to}
                    className={`bg-linear-to-br group flex h-full flex-col justify-between rounded-2xl border border-white/25 p-5 shadow-lg backdrop-blur transition hover:-translate-y-1 hover:border-white/40 hover:shadow-xl focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:border-white/10 dark:focus-visible:ring-offset-slate-950 ${action.tone}`}
                    title={`${action.label}: ${action.description}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/75 shadow-sm dark:bg-slate-900/70">
                          <ActionIcon
                            className={`h-5 w-5 ${action.iconClass}`}
                            aria-hidden="true"
                          />
                        </div>
                        <div>
                          <p className="text-foreground text-sm font-semibold">
                            {action.label}
                          </p>
                          <p className="text-muted-foreground text-xs">
                            {action.description}
                          </p>
                        </div>
                      </div>
                      <ChevronRight
                        className="text-muted-foreground h-4 w-4 transition group-hover:translate-x-1"
                        aria-hidden="true"
                      />
                    </div>
                    {action.footnote && (
                      <Badge
                        variant="outline"
                        className={`mt-6 w-fit rounded-full border-transparent px-2.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-[0.2em] ${action.badgeClass}`}
                      >
                        {action.footnote}
                      </Badge>
                    )}
                  </Link>
                );
              })}
            </div>
          </motion.section>

          <motion.section
            className="mb-12 space-y-4"
            variants={itemVariants}
            initial="hidden"
            animate="show"
          >
            <div className="space-y-1">
              <h2 className="text-2xl font-semibold">Migration insights</h2>
              <p className="text-muted-foreground text-sm">
                Live metrics help you validate progress and spot blockers.
              </p>
            </div>
            <div className="grid gap-6 lg:grid-cols-3">
              <Card className="relative overflow-hidden border border-white/30 bg-white/80 p-6 shadow-xl backdrop-blur dark:border-white/10 dark:bg-slate-950/70">
                <div className="pointer-events-none absolute -right-16 -top-10 h-40 w-40 rounded-full bg-blue-500/20 blur-3xl" />
                <CardHeader className="space-y-2 p-0 pb-4">
                  <CardTitle className="flex items-center gap-2 text-lg font-semibold">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/60 text-blue-600 shadow-sm dark:bg-slate-900/60">
                      <Library className="h-5 w-5" />
                    </div>
                    Library snapshot
                  </CardTitle>
                  <CardDescription>
                    {stats.total > 0
                      ? "Your Kenmei export is ready to sync."
                      : "Import to unlock personalized recommendations."}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 p-0">
                  <p className="text-4xl font-semibold">
                    {formatNumber(stats.total)}
                  </p>
                  <div className="text-muted-foreground flex items-center gap-2 text-sm">
                    <Clock className="h-4 w-4 text-blue-500" />
                    <span>
                      {stats.total > 0
                        ? `Last import ${formatDate(stats.lastSync)}`
                        : "Awaiting first import"}
                    </span>
                  </div>
                </CardContent>
              </Card>

              <Card className="relative overflow-hidden border border-white/30 bg-white/80 p-6 shadow-xl backdrop-blur dark:border-white/10 dark:bg-slate-950/70">
                <div className="pointer-events-none absolute left-[-30px] top-10 h-36 w-36 rounded-full bg-emerald-400/20 blur-3xl" />
                <CardHeader className="space-y-2 p-0 pb-4">
                  <CardTitle className="flex items-center gap-2 text-lg font-semibold">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/60 text-emerald-600 shadow-sm dark:bg-slate-900/60">
                      <ClipboardCheck className="h-5 w-5" />
                    </div>
                    Review status
                  </CardTitle>
                  <CardDescription>
                    Resolve matches to unlock a confident sync.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 p-0">
                  <div className="flex items-center gap-3">
                    <p className="text-3xl font-semibold">{matchStatusText}</p>
                    {renderMatchStatusBadge(matchStatus)}
                  </div>
                  <div className="text-muted-foreground flex flex-wrap gap-2 text-xs">
                    {matchStatus.totalMatches > 0 && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-white/70 px-3 py-1 shadow-sm dark:bg-slate-900/70">
                        <BarChart2 className="h-3.5 w-3.5 text-emerald-500" />
                        {formatNumber(matchStatus.totalMatches)} total
                      </span>
                    )}
                    {matchStatus.skippedMatches > 0 && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-white/70 px-3 py-1 shadow-sm dark:bg-slate-900/70">
                        <AlertCircle className="h-3.5 w-3.5 text-blue-500" />
                        {formatNumber(matchStatus.skippedMatches)} skipped
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card className="relative overflow-hidden border border-white/30 bg-white/80 p-6 shadow-xl backdrop-blur dark:border-white/10 dark:bg-slate-950/70">
                <div className="pointer-events-none absolute bottom-[-60px] right-[-50px] h-40 w-40 rounded-full bg-purple-500/25 blur-3xl" />
                <CardHeader className="space-y-2 p-0 pb-4">
                  <CardTitle className="flex items-center gap-2 text-lg font-semibold">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/60 text-purple-600 shadow-sm dark:bg-slate-900/60">
                      <Sparkles className="h-5 w-5" />
                    </div>
                    Sync health
                  </CardTitle>
                  <CardDescription>
                    Validate reliability before running your next sync.
                  </CardDescription>
                </CardHeader>
                <CardContent className="text-muted-foreground space-y-3 p-0 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-foreground font-medium">
                      Last sync
                    </span>
                    <span>
                      {syncStats.lastSyncTime
                        ? formatDate(syncStats.lastSyncTime)
                        : "Not yet"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-foreground font-medium">
                      Entries synced
                    </span>
                    <span className="flex items-center gap-2">
                      {formatNumber(syncStats.entriesSynced)}
                      {syncStats.entriesSynced >= 100 && (
                        <span className="text-sm" title="Milestone unlocked">
                          🎉
                        </span>
                      )}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-foreground font-medium">
                      Failed syncs
                    </span>
                    <span className="flex items-center gap-2">
                      {formatNumber(syncStats.failedSyncs)}
                      {syncStats.failedSyncs > 0 && (
                        <span
                          className="text-xs font-semibold text-amber-600 dark:text-amber-400"
                          title="Review sync logs to investigate failures"
                        >
                          ⚠️
                        </span>
                      )}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-foreground font-medium">
                      Total sync runs
                    </span>
                    <span>{formatNumber(syncStats.totalSyncs)}</span>
                  </div>
                  {syncSuccessRate !== null && (
                    <div
                      className={`flex items-center justify-between rounded-xl px-3 py-2 text-xs font-semibold uppercase tracking-wide shadow-sm ${
                        syncSuccessRate >= 95
                          ? "bg-emerald-500/25 text-emerald-900 dark:text-emerald-100"
                          : "bg-white/60 text-purple-700 dark:bg-slate-900/60 dark:text-purple-200"
                      }`}
                    >
                      <span>Reliability</span>
                      <span className="flex items-center gap-1">
                        {syncSuccessRate}% success
                        {syncSuccessRate >= 95 && <span>⭐</span>}
                      </span>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="border border-white/30 bg-white/80 p-6 shadow-xl backdrop-blur lg:col-span-3 dark:border-white/10 dark:bg-slate-950/70">
                <CardHeader className="space-y-2 p-0 pb-4">
                  <CardTitle className="text-lg font-semibold">
                    Status distribution
                  </CardTitle>
                  <CardDescription>
                    Understand how your library breaks down by reading state.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 p-0">
                  {statusBreakdown.map((status) => {
                    const percent =
                      stats.total > 0
                        ? Math.round((status.value / stats.total) * 100)
                        : 0;
                    return (
                      <div key={status.label} className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-foreground font-medium">
                            {status.label}
                          </span>
                          <span className="text-muted-foreground">
                            {formatNumber(status.value)}{" "}
                            {status.value === 1 ? "entry" : "entries"} •{" "}
                            {percent}%
                          </span>
                        </div>
                        <div className="bg-muted relative h-2.5 overflow-hidden rounded-full">
                          <div
                            className={`bg-linear-to-r absolute inset-y-0 left-0 rounded-full ${status.gradient}`}
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                  {stats.total === 0 && (
                    <p className="text-muted-foreground text-sm">
                      Import your Kenmei CSV to unlock detailed visualizations.
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>
          </motion.section>
        </motion.main>
      </div>
    </>
  );
}
