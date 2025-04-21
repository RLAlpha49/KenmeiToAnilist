/**
 * @packageDocumentation
 * @module HomePage
 * @description Home page component for the Kenmei to AniList sync tool. Displays dashboard, statistics, feature carousel, quick actions, and sync status.
 */

import React, { useState, useEffect } from "react";
import { Link } from "@tanstack/react-router";
import {
  BookOpen,
  AlertCircle,
  Clock,
  BarChart2,
  Activity,
  Download,
  Library,
  RefreshCw,
  Sparkles,
  LogOut,
  UserCheck,
  ClipboardCheck,
  ExternalLink,
  ChevronRight,
  LineChart,
  PanelLeftOpen,
  Settings,
  CheckCheck,
} from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { getImportStats } from "../utils/storage";
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
import { Separator } from "../components/ui/separator";
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
      type: "spring",
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
      setStats({
        ...stats,
        total: importStats.total || 0,
        reading: statusCounts.reading || 0,
        completed: statusCounts.completed || 0,
        dropped: statusCounts.dropped || 0,
        onHold: statusCounts.on_hold || 0,
        planToRead: statusCounts.plan_to_read || 0,
        lastSync: importStats.timestamp || null,
      });
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

          Object.values(matchResults).forEach((result) => {
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
          });

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
  }, []);

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

  return (
    <motion.div
      className="container mx-auto px-4 py-8 md:px-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      <motion.div
        className="mb-10"
        variants={itemVariants}
        initial="hidden"
        animate="show"
      >
        <div className="flex flex-col space-y-3">
          <h1 className="text-4xl font-bold tracking-tight md:text-5xl">
            <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Dashboard
            </span>
          </h1>
          <p className="text-muted-foreground max-w-2xl">
            Welcome to the Kenmei to AniList sync tool. Import and synchronize
            your manga collection with ease.
          </p>
          <Separator className="mt-4" />
        </div>
      </motion.div>

      {/* Feature Carousel */}
      <motion.div
        className="mb-10"
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
              delay: 5000,
              stopOnInteraction: false,
              stopOnMouseEnter: true,
            }),
          ]}
          className="w-full"
        >
          <CarouselContent className="-ml-4">
            {featureCards.map((feature, index) => (
              <CarouselItem
                key={index}
                className="pl-4 md:basis-1/2 lg:basis-1/3"
              >
                <div className="p-1">
                  <Card className="bg-muted/10 overflow-hidden border-none shadow-md">
                    <div className={`h-2 bg-gradient-to-r ${feature.color}`} />
                    <CardContent className="p-6">
                      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-blue-100 to-indigo-100 text-blue-700 dark:from-blue-900/30 dark:to-indigo-900/30 dark:text-blue-300">
                        {feature.icon}
                      </div>
                      <h3 className="mb-2 text-xl font-semibold">
                        {feature.title}
                      </h3>
                      <p className="text-muted-foreground">
                        {feature.description}
                      </p>
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
      </motion.div>

      <motion.div
        className="mb-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3"
        variants={containerVariants}
        initial="hidden"
        animate="show"
      >
        <motion.div variants={itemVariants}>
          <Card className="overflow-hidden border-none bg-gradient-to-br from-blue-50 to-indigo-50 shadow-md transition-all hover:translate-y-[-3px] hover:shadow-lg dark:from-blue-950/40 dark:to-indigo-950/40">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center text-xl text-blue-700 dark:text-blue-400">
                <div className="mr-2 flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-800/50">
                  <Library className="h-5 w-5" />
                </div>
                Imported Items
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="relative">
                <p className="mb-2 text-4xl font-bold text-blue-600 dark:text-blue-400">
                  {stats.total}
                </p>
                <div className="text-muted-foreground flex items-center rounded-md bg-blue-50/50 px-2 py-1 text-sm dark:bg-blue-900/20">
                  <Clock className="mr-1 h-3.5 w-3.5 text-blue-500" />
                  {stats.total > 0
                    ? `Last imported: ${formatDate(stats.lastSync)}`
                    : "No items imported yet"}
                </div>
                <BarChart2 className="absolute right-0 bottom-0 h-16 w-16 text-blue-500 opacity-20 dark:text-blue-900/50" />
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card className="overflow-hidden border-none bg-gradient-to-br from-purple-50 to-fuchsia-50 shadow-md transition-all hover:translate-y-[-3px] hover:shadow-lg dark:from-purple-950/40 dark:to-fuchsia-950/40">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center text-xl text-purple-700 dark:text-purple-400">
                <div className="mr-2 flex h-8 w-8 items-center justify-center rounded-full bg-purple-100 dark:bg-purple-800/50">
                  <Activity className="h-5 w-5" />
                </div>
                Reading Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="relative">
                <p className="mb-2 text-4xl font-bold text-purple-600 dark:text-purple-400">
                  {stats.reading}
                </p>
                <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-sm">
                  <Badge
                    variant="outline"
                    className="bg-green-100/50 text-green-700 shadow-sm dark:bg-green-900/20 dark:text-green-400"
                  >
                    {stats.completed} Completed
                  </Badge>
                  <Badge
                    variant="outline"
                    className="bg-amber-100/50 text-amber-700 shadow-sm dark:bg-amber-900/20 dark:text-amber-400"
                  >
                    {stats.onHold} On Hold
                  </Badge>
                  <Badge
                    variant="outline"
                    className="bg-blue-100/50 text-blue-700 shadow-sm dark:bg-blue-900/20 dark:text-blue-400"
                  >
                    {stats.planToRead} Plan to Read
                  </Badge>
                  <Badge
                    variant="outline"
                    className="bg-red-100/50 text-red-700 shadow-sm dark:bg-red-900/20 dark:text-red-400"
                  >
                    {stats.dropped} Dropped
                  </Badge>
                </div>
                <LineChart className="absolute right-0 bottom-0 h-16 w-16 text-purple-500 opacity-20 dark:text-purple-900/50" />
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card className="overflow-hidden border-none bg-gradient-to-br from-green-50 to-emerald-50 shadow-md transition-all hover:translate-y-[-3px] hover:shadow-lg dark:from-green-950/40 dark:to-emerald-950/40">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center text-xl text-green-700 dark:text-green-400">
                <div className="mr-2 flex h-8 w-8 items-center justify-center rounded-full bg-green-100 dark:bg-green-800/50">
                  <ClipboardCheck className="h-5 w-5" />
                </div>
                Match Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="relative">
                <p className="mb-2 text-4xl font-bold text-green-600 dark:text-green-400">
                  {matchStatus.status === "none"
                    ? "-"
                    : matchStatus.status === "pending"
                      ? "Ready"
                      : "Complete"}
                </p>
                <div className="text-muted-foreground flex flex-row flex-wrap gap-2 text-sm">
                  {matchStatus.status === "pending" ? (
                    <Badge
                      variant="outline"
                      className="bg-amber-100/50 text-amber-700 shadow-sm dark:bg-amber-900/20 dark:text-amber-400"
                    >
                      <span className="flex items-center gap-1">
                        <div className="h-1.5 w-1.5 rounded-full bg-amber-500"></div>
                        {matchStatus.pendingMatches} manga need review
                      </span>
                    </Badge>
                  ) : matchStatus.status === "complete" ? (
                    <Badge
                      variant="outline"
                      className="bg-green-100/50 text-green-700 shadow-sm dark:bg-green-900/20 dark:text-green-400"
                    >
                      <span className="flex items-center gap-1">
                        <div className="h-1.5 w-1.5 rounded-full bg-green-500"></div>
                        {matchStatus.totalMatches - matchStatus.skippedMatches}{" "}
                        manga matched
                      </span>
                    </Badge>
                  ) : (
                    <Badge
                      variant="outline"
                      className="bg-gray-100/50 text-gray-700 shadow-sm dark:bg-gray-900/20 dark:text-gray-400"
                    >
                      <span className="flex items-center gap-1">
                        <div className="h-1.5 w-1.5 rounded-full bg-gray-500"></div>
                        Import data first
                      </span>
                    </Badge>
                  )}

                  {matchStatus.skippedMatches > 0 && (
                    <Badge
                      variant="outline"
                      className="bg-blue-100/50 text-blue-700 shadow-sm dark:bg-blue-900/20 dark:text-blue-400"
                    >
                      <span className="flex items-center gap-1">
                        <div className="h-1.5 w-1.5 rounded-full bg-blue-500"></div>
                        {matchStatus.skippedMatches} manga skipped
                      </span>
                    </Badge>
                  )}
                </div>
                <RefreshCw
                  className={`absolute right-0 bottom-0 h-16 w-16 opacity-20 ${
                    matchStatus.status === "pending"
                      ? "text-amber-500 dark:text-amber-900/50"
                      : matchStatus.status === "complete"
                        ? "text-green-500 dark:text-green-900/50"
                        : "text-gray-500 dark:text-gray-900/50"
                  }`}
                />
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>

      <motion.div
        className="mb-10 grid grid-cols-1 gap-8 lg:grid-cols-2"
        variants={containerVariants}
        initial="hidden"
        animate="show"
      >
        <motion.div variants={itemVariants}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center text-xl">
                <Sparkles className="mr-2 h-5 w-5 text-blue-500" />
                Quick Actions
              </CardTitle>
              <CardDescription>
                Get started with these common tasks
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-4">
                <Button
                  asChild
                  variant="outline"
                  className="h-auto w-full min-w-0 justify-start gap-3 border-blue-200 bg-blue-50 px-4 py-3 text-left transition-all hover:border-blue-300 hover:bg-blue-100 dark:border-blue-900 dark:bg-blue-950/30 dark:hover:border-blue-800 dark:hover:bg-blue-900/40"
                >
                  <Link to="/import" className="flex w-full items-start">
                    <div className="flex h-10 w-10 min-w-[2.5rem] flex-shrink-0 items-center justify-center rounded-full bg-blue-200 dark:bg-blue-800">
                      <Download className="h-5 w-5 text-blue-700 dark:text-blue-300" />
                    </div>
                    <div className="mx-3 min-w-0 flex-1 space-y-1 overflow-hidden">
                      <p className="text-sm leading-tight font-medium whitespace-normal">
                        Import Data
                      </p>
                      <p
                        className="word-break-normal overflow-hidden text-xs leading-tight text-wrap opacity-70"
                        style={{ maxWidth: "100%", display: "block" }}
                      >
                        Upload your Kenmei CSV
                      </p>
                    </div>
                    <ChevronRight className="text-muted-foreground mt-1.5 h-4 w-4 flex-shrink-0" />
                  </Link>
                </Button>

                {stats.total > 0 ? (
                  <Button
                    asChild
                    variant="outline"
                    className="h-auto w-full min-w-0 justify-start gap-3 border-green-200 bg-green-50 px-4 py-3 text-left transition-all hover:border-green-300 hover:bg-green-100 dark:border-green-900 dark:bg-green-950/30 dark:hover:border-green-800 dark:hover:bg-green-900/40"
                  >
                    <Link to="/review" className="flex w-full items-start">
                      <div className="flex h-10 w-10 min-w-[2.5rem] flex-shrink-0 items-center justify-center rounded-full bg-green-200 dark:bg-green-800">
                        <ClipboardCheck className="h-5 w-5 text-green-700 dark:text-green-300" />
                      </div>
                      <div className="mx-3 min-w-0 flex-1 space-y-1 overflow-hidden">
                        <p className="text-sm leading-tight font-medium whitespace-normal">
                          Review Matches
                        </p>
                        <p
                          className="word-break-normal overflow-hidden text-xs leading-tight text-wrap opacity-70"
                          style={{ maxWidth: "100%", display: "block" }}
                        >
                          Check your manga matches
                        </p>
                      </div>
                      <ChevronRight className="text-muted-foreground mt-1.5 h-4 w-4 flex-shrink-0" />
                    </Link>
                  </Button>
                ) : (
                  <Button
                    asChild
                    variant="outline"
                    className={`h-auto w-full min-w-0 justify-start gap-3 px-4 py-3 text-left transition-all ${
                      authState.isAuthenticated
                        ? "border-green-200 bg-green-50 hover:border-green-300 hover:bg-green-100 dark:border-green-900 dark:bg-green-950/30 dark:hover:border-green-800 dark:hover:bg-green-900/40"
                        : "border-blue-200 bg-blue-50 hover:border-blue-300 hover:bg-blue-100 dark:border-blue-900 dark:bg-blue-950/30 dark:hover:border-blue-800 dark:hover:bg-blue-900/40"
                    }`}
                  >
                    <Link to="/settings" className="flex w-full items-start">
                      <div
                        className={`flex h-10 w-10 min-w-[2.5rem] flex-shrink-0 items-center justify-center rounded-full ${
                          authState.isAuthenticated
                            ? "bg-green-200 dark:bg-green-800"
                            : "bg-blue-200 dark:bg-blue-800"
                        }`}
                      >
                        {authState.isAuthenticated ? (
                          <UserCheck className="h-5 w-5 text-green-700 dark:text-green-300" />
                        ) : (
                          <AlertCircle className="h-5 w-5 text-blue-700 dark:text-blue-300" />
                        )}
                      </div>
                      <div className="mx-3 min-w-0 flex-1 space-y-1 overflow-hidden">
                        <p className="text-sm leading-tight font-medium whitespace-normal">
                          {authState.isAuthenticated
                            ? "AniList Connected"
                            : "Connect to AniList"}
                        </p>
                        <p
                          className="word-break-normal overflow-hidden text-xs leading-tight text-wrap opacity-70"
                          style={{ maxWidth: "100%", display: "block" }}
                        >
                          {authState.isAuthenticated
                            ? authState.username || "Authenticated User"
                            : "Setup authentication"}
                        </p>
                      </div>
                      {authState.isAuthenticated ? (
                        <LogOut className="text-muted-foreground mt-1.5 h-4 w-4 flex-shrink-0" />
                      ) : (
                        <ChevronRight className="text-muted-foreground mt-1.5 h-4 w-4 flex-shrink-0" />
                      )}
                    </Link>
                  </Button>
                )}

                <Button
                  asChild
                  variant="outline"
                  className="h-auto w-full min-w-0 justify-start gap-3 border-purple-200 bg-purple-50 px-4 py-3 text-left transition-all hover:border-purple-300 hover:bg-purple-100 dark:border-purple-900 dark:bg-purple-950/30 dark:hover:border-purple-800 dark:hover:bg-purple-900/40"
                >
                  <Link to="/sync" className="flex w-full items-start">
                    <div className="flex h-10 w-10 min-w-[2.5rem] flex-shrink-0 items-center justify-center rounded-full bg-purple-200 dark:bg-purple-800">
                      <RefreshCw className="h-5 w-5 text-purple-700 dark:text-purple-300" />
                    </div>
                    <div className="mx-3 min-w-0 flex-1 space-y-1 overflow-hidden">
                      <p className="text-sm leading-tight font-medium whitespace-normal">
                        Synchronize
                      </p>
                      <p
                        className="word-break-normal overflow-hidden text-xs leading-tight text-wrap opacity-70"
                        style={{ maxWidth: "100%", display: "block" }}
                      >
                        Sync to AniList
                      </p>
                    </div>
                    <ChevronRight className="text-muted-foreground mt-1.5 h-4 w-4 flex-shrink-0" />
                  </Link>
                </Button>

                <Button
                  asChild
                  variant="outline"
                  className="h-auto w-full min-w-0 justify-start gap-3 border-amber-200 bg-amber-50 px-4 py-3 text-left transition-all hover:border-amber-300 hover:bg-amber-100 dark:border-amber-900 dark:bg-amber-950/30 dark:hover:border-amber-800 dark:hover:bg-amber-900/40"
                >
                  <Link to="/settings" className="flex w-full items-start">
                    <div className="flex h-10 w-10 min-w-[2.5rem] flex-shrink-0 items-center justify-center rounded-full bg-amber-200 dark:bg-amber-800">
                      <Settings className="h-5 w-5 text-amber-700 dark:text-amber-300" />
                    </div>
                    <div className="mx-3 min-w-0 flex-1 space-y-1 overflow-hidden">
                      <p className="text-sm leading-tight font-medium whitespace-normal">
                        Settings
                      </p>
                      <p
                        className="word-break-normal overflow-hidden text-xs leading-tight text-wrap opacity-70"
                        style={{ maxWidth: "100%", display: "block" }}
                      >
                        Configure application settings
                      </p>
                    </div>
                    <ChevronRight className="text-muted-foreground mt-1.5 h-4 w-4 flex-shrink-0" />
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center text-xl">
                <BarChart2 className="mr-2 h-5 w-5 text-blue-500" />
                Sync Status
              </CardTitle>
              <CardDescription>
                Information about your synchronization
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between rounded-lg bg-green-50 p-3 dark:bg-green-900/20">
                  <div className="flex items-center gap-2">
                    <div className="h-2.5 w-2.5 rounded-full bg-green-500"></div>
                    <span className="text-sm font-medium text-green-700 dark:text-green-400">
                      AniList API Status: Online
                    </span>
                  </div>
                  <Badge
                    variant="outline"
                    className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                  >
                    Ready
                  </Badge>
                </div>

                <div className="rounded-lg border p-4">
                  <h3 className="mb-2 text-sm font-medium">Sync Statistics</h3>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="flex items-center gap-2">
                      <BookOpen className="h-4 w-4 text-blue-500" />
                      <span className="text-muted-foreground">
                        Total Manga:
                      </span>
                      <span className="font-medium">{stats.total}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Activity className="h-4 w-4 text-purple-500" />
                      <span className="text-muted-foreground">Reading:</span>
                      <span className="font-medium">{stats.reading}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCheck className="h-4 w-4 text-green-500" />
                      <span className="text-muted-foreground">Completed:</span>
                      <span className="font-medium">{stats.completed}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-amber-500" />
                      <span className="text-muted-foreground">On Hold:</span>
                      <span className="font-medium">{stats.onHold}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 text-red-500" />
                      <span className="text-muted-foreground">Dropped:</span>
                      <span className="font-medium">{stats.dropped}</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>

      <motion.div variants={itemVariants} initial="hidden" animate="show">
        <Card className="border-none bg-gradient-to-r from-gray-50 to-gray-100 shadow-sm transition-all hover:shadow-md dark:from-gray-950/80 dark:to-gray-900/80">
          <CardContent className="flex flex-col items-center justify-center space-y-2 py-6">
            <p className="text-muted-foreground text-sm">
              Kenmei to AniList Sync Tool • Version {getAppVersion()}
            </p>
            <div className="flex items-center gap-2">
              {versionStatus === null ? (
                <Badge
                  variant="outline"
                  className="bg-gray-100 text-xs font-normal text-gray-600 dark:bg-gray-800/30 dark:text-gray-300"
                >
                  Checking...
                </Badge>
              ) : versionStatus.status === "stable" ? (
                <Badge
                  variant="outline"
                  className="bg-green-50 text-xs font-normal text-green-700 dark:bg-green-900/30 dark:text-green-300"
                >
                  Stable Release
                </Badge>
              ) : versionStatus.status === "beta" ? (
                <Badge
                  variant="outline"
                  className="bg-yellow-50 text-xs font-normal text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300"
                >
                  Beta Release
                </Badge>
              ) : (
                <Badge
                  variant="outline"
                  className="bg-blue-50 text-xs font-normal text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                >
                  Development Build
                </Badge>
              )}
              <a
                href="https://github.com/RLAlpha49/KenmeiToAnilist"
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-foreground inline-flex items-center text-xs font-medium transition-colors"
              >
                <ExternalLink className="mr-1 h-3 w-3" />
                GitHub
              </a>
            </div>
            <p className="text-muted-foreground/60 text-xs">
              Made with ❤️ for manga readers
            </p>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}
