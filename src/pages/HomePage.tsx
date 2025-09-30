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
  ExternalLink,
  ChevronRight,
  PanelLeftOpen,
  Settings,
  CheckCheck,
  ArrowUpRight,
} from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { getImportStats, storage, STORAGE_KEYS } from "../utils/storage";
import { motion } from "framer-motion";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "../components/ui/carousel";
import {
  getAppVersion,
  getAppVersionStatus,
  AppVersionStatus,
} from "../utils/app-version";
import Autoplay from "embla-carousel-autoplay";

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

// Add type for sync stats
interface SyncStats {
  lastSyncTime: string | null;
  entriesSynced: number;
  failedSyncs: number;
  totalSyncs: number;
}

// Animation variants for staggered children
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

// Feature cards for the carousel
const featureCards = [
  {
    title: "Import From Kenmei",
    description:
      "Easily import your entire manga collection from Kenmei CSV export.",
    icon: <PanelLeftOpen className="h-6 w-6" />,
    color: "from-blue-500 to-indigo-600",
  },
  {
    title: "Smart Matching",
    description:
      "Intelligent algorithm matches your manga to AniList entries with high accuracy.",
    icon: <Settings className="h-6 w-6" />,
    color: "from-purple-500 to-fuchsia-600",
  },
  {
    title: "One-Click Sync",
    description:
      "Synchronize your entire collection to AniList with a single click after reviewing.",
    icon: <CheckCheck className="h-6 w-6" />,
    color: "from-green-500 to-emerald-600",
  },
  {
    title: "Auto-Pause Manga",
    description:
      "Automatically pause manga that haven't been updated within a customizable time period.",
    icon: <Clock className="h-6 w-6" />,
    color: "from-amber-500 to-orange-600",
  },
  {
    title: "Flexible Configuration",
    description:
      "Customize how synchronization works with priority settings for status, progress, and scores.",
    icon: <Settings className="h-6 w-6" />,
    color: "from-teal-500 to-emerald-600",
  },
  {
    title: "Privacy Control",
    description:
      "Control which entries are private on AniList while maintaining your reading history.",
    icon: <UserCheck className="h-6 w-6" />,
    color: "from-red-500 to-pink-600",
  },
];

/**
 * Home page component for the Kenmei to AniList sync tool.
 *
 * Displays dashboard statistics, feature carousel, quick actions, and sync status for the user.
 *
 * @source
 */
export function HomePage() {
  // Get auth state to check authentication status
  const { authState } = useAuth();

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
  const [versionStatus, setVersionStatus] = useState<AppVersionStatus | null>(
    null,
  );
  const [syncStats, setSyncStats] = useState<SyncStats>({
    lastSyncTime: null,
    entriesSynced: 0,
    failedSyncs: 0,
    totalSyncs: 0,
  });

  useEffect(() => {
    let mounted = true;
    getAppVersionStatus().then((status) => {
      if (mounted) setVersionStatus(status);
    });
    return () => {
      mounted = false;
    };
  }, []);

  // Define interface for match result objects
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

  // Load import stats from storage on component mount
  useEffect(() => {
    const importStats = getImportStats();
    if (importStats) {
      // Update stats from stored data
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
    }

    // Get match status data
    try {
      const matchResultsStr = localStorage.getItem("match_results");

      if (matchResultsStr) {
        const matchResults = JSON.parse(matchResultsStr);
        const totalCount = matchResults ? Object.keys(matchResults).length : 0;

        if (totalCount > 0) {
          // Count pending and skipped matches by iterating through match results
          let pendingCount = 0;
          let skippedCount = 0;

          for (const result of Object.values(matchResults)) {
            // Type cast the unknown result to our MatchResult interface
            const matchResult = result as MatchResult;

            // Check if entry is explicitly marked as skipped
            if (matchResult.status === "skipped") {
              skippedCount++;
            }
            // Check if the entry genuinely needs review
            else if (
              matchResult.status === "pending" ||
              (matchResult.needsReview === true &&
                !matchResult.selectedMatch) ||
              (matchResult.status !== "skipped" && !matchResult.selectedMatch)
            ) {
              pendingCount++;
            }
          }

          setMatchStatus({
            pendingMatches: pendingCount,
            skippedMatches: skippedCount,
            totalMatches: totalCount,
            status: pendingCount === 0 ? "complete" : "pending",
          });
        } else {
          setMatchStatus({
            pendingMatches: 0,
            skippedMatches: 0,
            totalMatches: 0,
            status: "none",
          });
        }
      }
    } catch (error) {
      console.error("Error retrieving match status:", error);
    }

    try {
      const stats = JSON.parse(
        storage.getItem(STORAGE_KEYS.SYNC_STATS) || "{}",
      );
      setSyncStats({
        lastSyncTime: stats.lastSyncTime || null,
        entriesSynced: stats.entriesSynced || 0,
        failedSyncs: stats.failedSyncs || 0,
        totalSyncs: stats.totalSyncs || 0,
      });
    } catch {
      setSyncStats({
        lastSyncTime: null,
        entriesSynced: 0,
        failedSyncs: 0,
        totalSyncs: 0,
      });
    }
  }, []);

  const formatNumber = (value: number) => value.toLocaleString();

  // Format date for display
  const formatDate = (dateString: string | null) => {
    if (!dateString) return "Never";

    try {
      const date = new Date(dateString);
      return (
        date.toLocaleDateString() +
        " " +
        date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      );
    } catch {
      return "Invalid date";
    }
  };

  const heroAction = useMemo(() => {
    if (!authState.isAuthenticated) {
      return {
        label: "Connect AniList",
        description: "Authenticate to see syncing and review tools",
        href: "/settings",
        tone: "from-blue-500 via-indigo-500 to-purple-500",
      };
    }

    if (stats.total === 0) {
      return {
        label: "Start Import",
        description: "Upload your Kenmei CSV to kick off your migration",
        href: "/import",
        tone: "from-green-500 via-emerald-500 to-teal-500",
      };
    }

    if (matchStatus.pendingMatches > 0) {
      return {
        label: "Review Matches",
        description: "Resolve pending titles before you sync",
        href: "/review",
        tone: "from-amber-500 via-orange-500 to-rose-500",
      };
    }

    if (syncStats.totalSyncs === 0) {
      return {
        label: "Configure Sync",
        description: "Fine-tune sync behavior and status priorities",
        href: "/settings",
        tone: "from-purple-500 via-blue-500 to-indigo-500",
      };
    }

    return {
      label: "Run Sync",
      description: "Push updates to AniList with confidence",
      href: "/sync",
      tone: "from-fuchsia-500 via-purple-500 to-blue-500",
    };
  }, [
    authState.isAuthenticated,
    stats.total,
    matchStatus.pendingMatches,
    syncStats.totalSyncs,
  ]);

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

  let reviewFootnote: string;
  if (matchStatus.pendingMatches > 0) {
    reviewFootnote = `${formatNumber(matchStatus.pendingMatches)} pending`;
  } else if (matchStatus.status === "complete") {
    reviewFootnote = "All clear";
  } else {
    reviewFootnote = "Auto-matched";
  }

  const reviewAction =
    stats.total > 0
      ? {
          key: "review",
          label: "Review matches",
          description: "Verify smart matches before syncing",
          to: "/review",
          icon: ClipboardCheck,
          tone: "from-emerald-500/20 via-green-500/20 to-transparent",
          iconClass: "text-emerald-600 dark:text-emerald-300",
          badgeClass:
            "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300",
          footnote: reviewFootnote,
        }
      : {
          key: "connect",
          label: authState.isAuthenticated
            ? "AniList connected"
            : "Connect AniList",
          description: authState.isAuthenticated
            ? authState.username || "Authenticated user"
            : "Authorize AniList to unlock syncing",
          to: "/settings",
          icon: authState.isAuthenticated ? UserCheck : AlertCircle,
          tone: "from-purple-500/20 via-blue-500/20 to-transparent",
          iconClass: authState.isAuthenticated
            ? "text-emerald-600 dark:text-emerald-300"
            : "text-blue-600 dark:text-blue-300",
          badgeClass: authState.isAuthenticated
            ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300"
            : "bg-blue-500/20 text-blue-700 dark:text-blue-300",
          footnote: authState.isAuthenticated
            ? "Ready to review"
            : "Authentication required",
        };

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
    <div className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute top-[8%] -left-1/3 h-[420px] w-[420px] rounded-full bg-gradient-to-br from-blue-500/25 via-purple-500/20 to-transparent blur-3xl" />
        <div className="absolute top-[35%] right-[-10%] h-[320px] w-[320px] rounded-full bg-gradient-to-br from-emerald-400/20 via-teal-400/20 to-transparent blur-[140px]" />
        <div className="absolute bottom-[-20%] left-1/2 h-[280px] w-[480px] -translate-x-1/2 rounded-full bg-gradient-to-br from-amber-300/20 via-pink-300/20 to-transparent blur-[200px]" />
      </div>

      <motion.div
        className="relative z-[1] container mx-auto px-4 py-10 md:px-6"
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
          <div className="relative overflow-hidden rounded-3xl border border-white/30 bg-gradient-to-br from-white/85 via-white/60 to-white/30 p-8 shadow-2xl backdrop-blur-lg dark:border-white/10 dark:from-slate-950/70 dark:via-slate-950/60 dark:to-slate-950/40">
            <div className="pointer-events-none absolute top-[-140px] -left-32 h-64 w-64 rounded-full bg-gradient-to-br from-blue-500/25 via-purple-500/20 to-transparent blur-3xl" />
            <div className="pointer-events-none absolute right-[-40px] bottom-[-140px] h-64 w-64 rounded-full bg-gradient-to-br from-fuchsia-500/25 via-purple-500/15 to-transparent blur-3xl" />
            <div className="relative z-[1] flex flex-col gap-10 lg:flex-row lg:items-center">
              <div className="space-y-6 lg:flex-1">
                <Badge
                  variant="outline"
                  className="text-foreground/70 w-fit rounded-full border-white/40 bg-white/80 px-3 py-1 text-xs font-semibold tracking-[0.2em] uppercase shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/10"
                >
                  Kenmei ✦ AniList
                </Badge>
                <div className="space-y-4">
                  <h1 className="text-foreground text-4xl font-semibold tracking-tight md:text-5xl lg:text-6xl">
                    Your manga migration control center
                  </h1>
                  <p className="text-muted-foreground text-lg md:max-w-2xl">
                    Keep tabs on every step of your import, review, and sync
                    flow with a dashboard built for manga fans who want their
                    AniList library perfectly aligned.
                  </p>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <Button
                    asChild
                    size="lg"
                    className={`group h-auto rounded-full bg-gradient-to-r ${heroAction.tone} px-6 py-3 text-base font-semibold text-white shadow-lg transition hover:shadow-xl focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-950`}
                  >
                    <Link
                      to={heroAction.href}
                      className="flex items-center gap-2"
                    >
                      <span>{heroAction.label}</span>
                      <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                    </Link>
                  </Button>
                  <Button
                    asChild
                    variant="outline"
                    size="lg"
                    className="text-foreground hover:border-primary/50 hover:text-primary focus-visible:ring-primary/30 dark:hover:border-primary/50 dark:hover:text-primary h-auto rounded-full border-white/60 bg-white/75 px-6 py-3 text-base font-semibold shadow-sm transition focus-visible:ring-2 focus-visible:ring-offset-2 dark:border-white/20 dark:bg-slate-950/60 dark:focus-visible:ring-offset-slate-950"
                  >
                    <a
                      href="https://github.com/RLAlpha49/KenmeiToAnilist/blob/master/docs/guides/USER_GUIDE.md"
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2"
                    >
                      Quickstart guide
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </Button>
                </div>
                <p className="text-muted-foreground/80 text-sm">
                  {heroAction.description}
                </p>
              </div>
              <div className="grid gap-4 sm:grid-cols-3 lg:w-80 lg:grid-cols-1">
                {heroHighlights.map((metric) => {
                  const Icon = metric.icon;
                  return (
                    <div
                      key={metric.label}
                      className="group rounded-2xl border border-white/40 bg-white/80 p-4 shadow-sm backdrop-blur-sm transition hover:-translate-y-1 hover:shadow-xl dark:border-white/10 dark:bg-slate-950/70"
                    >
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/70 shadow-sm dark:bg-slate-900/80">
                        <Icon className={`h-5 w-5 ${metric.accent}`} />
                      </div>
                      <p className="mt-3 text-2xl font-semibold">
                        {formatNumber(metric.value)}
                      </p>
                      <p className="text-muted-foreground text-sm">
                        {metric.label}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </motion.section>

        <motion.section
          className="mb-12 space-y-6"
          variants={itemVariants}
          initial="hidden"
          animate="show"
        >
          <Carousel
            opts={{
              align: "start",
              loop: true,
            }}
            plugins={[
              Autoplay({
                delay: 4000,
                stopOnInteraction: false,
                stopOnMouseEnter: true,
              }),
            ]}
            className="w-full"
          >
            <CarouselContent className="-ml-4">
              {featureCards.map((feature) => (
                <CarouselItem
                  key={feature.title}
                  className="pl-4 md:basis-1/2 lg:basis-1/3"
                >
                  <div className="p-1">
                    <Card className="relative h-full overflow-hidden border border-white/20 bg-white/70 shadow-lg backdrop-blur dark:border-white/10 dark:bg-slate-950/70">
                      <div
                        className={`absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r ${feature.color}`}
                      />
                      <CardContent className="flex h-full flex-col justify-between p-6">
                        <div>
                          <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-blue-100 to-indigo-100 text-blue-700 shadow-sm dark:from-blue-900/20 dark:to-indigo-900/20 dark:text-blue-300">
                            {feature.icon}
                          </div>
                          <h3 className="text-foreground mb-2 text-xl font-semibold">
                            {feature.title}
                          </h3>
                          <p className="text-muted-foreground text-sm">
                            {feature.description}
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </CarouselItem>
              ))}
            </CarouselContent>
            <div className="mt-4 flex justify-end gap-2">
              <CarouselPrevious className="static translate-y-0" />
              <CarouselNext className="static translate-y-0" />
            </div>
          </Carousel>
        </motion.section>

        <motion.section
          className="mb-12 grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3"
          variants={containerVariants}
          initial="hidden"
          animate="show"
        >
          <motion.div variants={itemVariants}>
            <Card className="relative overflow-hidden border border-blue-500/20 bg-gradient-to-br from-blue-500/15 via-indigo-500/10 to-blue-500/5 p-6 shadow-xl backdrop-blur-sm dark:border-blue-500/20 dark:from-blue-500/20 dark:via-indigo-500/20 dark:to-blue-500/10">
              <div className="absolute top-[-40px] right-[-40px] h-40 w-40 rounded-full bg-blue-500/20 blur-3xl" />
              <CardHeader className="flex flex-col gap-2 p-0 pb-4">
                <CardTitle className="flex items-center gap-2 text-lg font-semibold text-blue-700 dark:text-blue-200">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/40 text-blue-600 shadow-sm dark:bg-slate-900/60">
                    <Library className="h-5 w-5" />
                  </div>
                  Imported Library
                </CardTitle>
                <CardDescription className="text-sm text-blue-900/70 dark:text-blue-100/70">
                  {stats.total > 0
                    ? "Current snapshot from your Kenmei export."
                    : "Import your Kenmei CSV to populate the dashboard."}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 p-0">
                <p className="text-4xl font-bold text-blue-700 dark:text-blue-200">
                  {formatNumber(stats.total)}
                </p>
                <div className="flex items-center gap-2 text-sm text-blue-900/70 dark:text-blue-100/70">
                  <Clock className="h-4 w-4 text-blue-500" />
                  <span>
                    {stats.total > 0
                      ? `Last import ${formatDate(stats.lastSync)}`
                      : "Awaiting first import"}
                  </span>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div variants={itemVariants}>
            <Card className="relative overflow-hidden border border-emerald-500/20 bg-gradient-to-br from-emerald-500/15 via-green-500/10 to-emerald-500/5 p-6 shadow-xl backdrop-blur-sm dark:border-emerald-500/20 dark:from-emerald-500/20 dark:via-green-500/20 dark:to-emerald-500/10">
              <div className="absolute top-[60px] left-[-60px] h-40 w-40 rounded-full bg-emerald-500/20 blur-3xl" />
              <CardHeader className="flex flex-col gap-2 p-0 pb-4">
                <CardTitle className="flex items-center gap-2 text-lg font-semibold text-emerald-700 dark:text-emerald-200">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/40 text-emerald-600 shadow-sm dark:bg-slate-900/60">
                    <ClipboardCheck className="h-5 w-5" />
                  </div>
                  Match Review
                </CardTitle>
                <CardDescription className="text-sm text-emerald-900/70 dark:text-emerald-100/70">
                  Resolve matches before syncing to ensure accuracy.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 p-0">
                <div className="flex items-center gap-3">
                  <p className="text-4xl font-bold text-emerald-700 dark:text-emerald-200">
                    {matchStatusText}
                  </p>
                  {(() => {
                    let badgeClass = "";
                    if (matchStatus.status === "complete") {
                      badgeClass =
                        "bg-emerald-500/20 text-emerald-900 dark:text-emerald-200";
                    } else if (matchStatus.status === "pending") {
                      badgeClass =
                        "bg-amber-400/20 text-amber-900 dark:text-amber-300";
                    } else {
                      badgeClass = "bg-muted text-muted-foreground";
                    }
                    let badgeText = "";
                    if (matchStatus.status === "pending") {
                      badgeText = `${formatNumber(matchStatus.pendingMatches)} waiting`;
                    } else if (matchStatus.status === "complete") {
                      badgeText = "Review complete";
                    } else {
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
                  })()}
                </div>
                <div className="flex flex-wrap gap-2 text-xs text-emerald-900/70 dark:text-emerald-100/70">
                  {matchStatus.totalMatches > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-white/60 px-3 py-1 shadow-sm dark:bg-slate-900/70">
                      <BarChart2 className="h-3.5 w-3.5 text-emerald-500" />
                      {formatNumber(matchStatus.totalMatches)} total matches
                    </span>
                  )}
                  {matchStatus.skippedMatches > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-white/60 px-3 py-1 shadow-sm dark:bg-slate-900/70">
                      <AlertCircle className="h-3.5 w-3.5 text-blue-500" />
                      {formatNumber(matchStatus.skippedMatches)} skipped
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div variants={itemVariants}>
            <Card className="relative overflow-hidden border border-purple-500/20 bg-gradient-to-br from-purple-500/15 via-fuchsia-500/10 to-purple-500/5 p-6 shadow-xl backdrop-blur-sm dark:border-purple-500/20 dark:from-purple-500/20 dark:via-fuchsia-500/20 dark:to-purple-500/10">
              <div className="absolute top-[40px] right-[-70px] h-48 w-48 rounded-full bg-purple-500/25 blur-3xl" />
              <CardHeader className="flex flex-col gap-2 p-0 pb-4">
                <CardTitle className="flex items-center gap-2 text-lg font-semibold text-purple-700 dark:text-purple-200">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/40 text-purple-600 shadow-sm dark:bg-slate-900/60">
                    <Sparkles className="h-5 w-5" />
                  </div>
                  Sync Pulse
                </CardTitle>
                <CardDescription className="text-sm text-purple-900/70 dark:text-purple-100/70">
                  Track how your latest syncs are performing.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 p-0 text-sm text-purple-900/80 dark:text-purple-100/80">
                <div className="flex items-center justify-between">
                  <span className="text-foreground font-medium">Last sync</span>
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
                  <span>{formatNumber(syncStats.entriesSynced)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-foreground font-medium">
                    Failed syncs
                  </span>
                  <span>{formatNumber(syncStats.failedSyncs)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-foreground font-medium">
                    Total sync runs
                  </span>
                  <span>{formatNumber(syncStats.totalSyncs)}</span>
                </div>
                {syncSuccessRate !== null && (
                  <div className="flex items-center justify-between rounded-xl bg-white/60 px-3 py-2 text-xs font-semibold tracking-wide text-purple-700 uppercase shadow-sm dark:bg-slate-900/60 dark:text-purple-200">
                    <span>Reliability</span>
                    <span>{syncSuccessRate}% success</span>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </motion.section>

        <motion.section
          className="mb-12"
          variants={itemVariants}
          initial="hidden"
          animate="show"
        >
          <Card className="relative overflow-hidden border border-white/30 bg-white/80 p-6 shadow-xl backdrop-blur dark:border-white/10 dark:bg-slate-950/70">
            <CardHeader className="space-y-2 p-0 pb-4">
              <CardTitle className="text-xl font-semibold">
                Status distribution
              </CardTitle>
              <CardDescription>
                See how your library breaks down by reading state.
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
                        {status.value === 1 ? "entry" : "entries"} • {percent}%
                      </span>
                    </div>
                    <div className="bg-muted relative h-2.5 overflow-hidden rounded-full">
                      <div
                        className={`absolute inset-y-0 left-0 rounded-full bg-gradient-to-r ${status.gradient}`}
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
        </motion.section>

        <motion.section
          className="mb-12"
          variants={itemVariants}
          initial="hidden"
          animate="show"
        >
          <Card className="border border-white/30 bg-white/80 shadow-xl backdrop-blur dark:border-white/10 dark:bg-slate-950/70">
            <CardHeader className="space-y-2">
              <CardTitle className="flex items-center gap-2 text-xl">
                <Sparkles className="h-5 w-5 text-blue-500" />
                Quick actions
              </CardTitle>
              <CardDescription>
                Jump straight into the next best move for your migration.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {quickActionConfigs.map((action) => {
                  const ActionIcon = action.icon;
                  return (
                    <Button
                      key={action.key}
                      asChild
                      variant="outline"
                      className={`group h-full w-full justify-start gap-4 rounded-2xl border border-transparent bg-gradient-to-br ${action.tone} dark:hover:border-primary/40 p-4 text-left transition hover:-translate-y-1 hover:border-white/40 hover:shadow-xl`}
                    >
                      <Link
                        to={action.to}
                        className="flex w-full items-center gap-4"
                      >
                        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/70 shadow-sm dark:bg-slate-900/70">
                          <ActionIcon
                            className={`h-5 w-5 ${action.iconClass}`}
                          />
                        </div>
                        <div className="flex-1 space-y-1">
                          <p className="text-foreground text-sm font-semibold">
                            {action.label}
                          </p>
                          <p className="text-muted-foreground text-xs">
                            {action.description}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          {action.footnote && (
                            <Badge
                              variant="outline"
                              className={`rounded-full border-transparent px-2 py-0.5 text-[0.65rem] font-semibold tracking-wide uppercase ${action.badgeClass}`}
                            >
                              {action.footnote}
                            </Badge>
                          )}
                          <ChevronRight className="text-muted-foreground h-4 w-4 transition group-hover:translate-x-1" />
                        </div>
                      </Link>
                    </Button>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </motion.section>

        <motion.section variants={itemVariants} initial="hidden" animate="show">
          <Card className="border border-white/30 bg-gradient-to-r from-white/70 via-white/50 to-white/30 text-center shadow-lg backdrop-blur dark:border-white/10 dark:from-slate-950/70 dark:via-slate-950/60 dark:to-slate-950/40">
            <CardContent className="flex flex-col items-center gap-2 py-6">
              <p className="text-muted-foreground text-sm">
                Kenmei to AniList Sync Tool • Version {getAppVersion()}
              </p>
              <div className="flex items-center gap-3">
                {(() => {
                  if (versionStatus === null) {
                    return (
                      <Badge
                        variant="outline"
                        className="text-muted-foreground rounded-full border-transparent bg-white/60 px-3 py-1 text-xs font-normal dark:bg-white/10"
                      >
                        Checking...
                      </Badge>
                    );
                  }
                  if (versionStatus.status === "stable") {
                    return (
                      <Badge
                        variant="outline"
                        className="rounded-full border-transparent bg-emerald-500/20 px-3 py-1 text-xs font-normal text-emerald-800 dark:text-emerald-200"
                      >
                        Stable release
                      </Badge>
                    );
                  }
                  if (versionStatus.status === "beta") {
                    return (
                      <Badge
                        variant="outline"
                        className="rounded-full border-transparent bg-amber-400/20 px-3 py-1 text-xs font-normal text-amber-900 dark:text-amber-200"
                      >
                        Beta build
                      </Badge>
                    );
                  }
                  return (
                    <Badge
                      variant="outline"
                      className="rounded-full border-transparent bg-blue-500/20 px-3 py-1 text-xs font-normal text-blue-800 dark:text-blue-200"
                    >
                      Development build
                    </Badge>
                  );
                })()}
                <a
                  href="https://github.com/RLAlpha49/KenmeiToAnilist"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs font-medium transition-colors"
                >
                  <ExternalLink className="h-3 w-3" />
                  GitHub
                </a>
              </div>
              <p className="text-muted-foreground/70 text-xs">
                Made with ❤️ for manga readers
              </p>
            </CardContent>
          </Card>
        </motion.section>
      </motion.div>
    </div>
  );
}
