import React, { useState, useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { FileDropZone } from "../components/import/FileDropZone";
import { ErrorMessage } from "../components/ui/error-message";
import { ErrorType, AppError, createError } from "../utils/errorHandling";
import { KenmeiData, KenmeiMangaItem } from "../types/kenmei";
import {
  FileCheck,
  BarChart,
  FilesIcon,
  CheckCircle2,
  Clock,
  Upload,
  Info,
  AlertTriangle,
  ChevronRight,
  X,
} from "lucide-react";
import { DataTable } from "../components/import/DataTable";
import { saveKenmeiData, getSavedMatchResults } from "../utils/storage";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Progress } from "../components/ui/progress";
import { Badge } from "../components/ui/badge";
import { Separator } from "../components/ui/separator";
import { Alert, AlertDescription } from "../components/ui/alert";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../components/ui/tabs";
import { toast } from "sonner";
import { motion } from "framer-motion";

// Animation variants
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
      // Save the imported data to local storage
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      saveKenmeiData(importData as any);

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

  // Get status counts
  const getStatusCounts = () => {
    if (!importData?.manga) return {};

    return importData.manga.reduce(
      (acc: Record<string, number>, manga: KenmeiMangaItem) => {
        const status = manga.status || "unknown";
        acc[status] = (acc[status] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );
  };

  const statusCounts = getStatusCounts();

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

  const getStatusColor = (status: string) => {
    switch (status) {
      case "reading":
        return "bg-green-500/10 text-green-700 border-green-200 dark:border-green-800 dark:text-green-400";
      case "completed":
        return "bg-purple-500/10 text-purple-700 border-purple-200 dark:border-purple-800 dark:text-purple-400";
      case "dropped":
        return "bg-red-500/10 text-red-700 border-red-200 dark:border-red-800 dark:text-red-400";
      case "plan_to_read":
        return "bg-blue-500/10 text-blue-700 border-blue-200 dark:border-blue-800 dark:text-blue-400";
      case "on_hold":
        return "bg-amber-500/10 text-amber-700 border-amber-200 dark:border-amber-800 dark:text-amber-400";
      default:
        return "bg-gray-500/10 text-gray-700 border-gray-200 dark:border-gray-700 dark:text-gray-400";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "reading":
        return (
          <div className="rounded-full bg-green-100 p-2 dark:bg-green-800/30">
            <Clock className="h-4 w-4 text-green-600 dark:text-green-400" />
          </div>
        );
      case "completed":
        return (
          <div className="rounded-full bg-purple-100 p-2 dark:bg-purple-800/30">
            <CheckCircle2 className="h-4 w-4 text-purple-600 dark:text-purple-400" />
          </div>
        );
      case "dropped":
        return (
          <div className="rounded-full bg-red-100 p-2 dark:bg-red-800/30">
            <X className="h-4 w-4 text-red-600 dark:text-red-400" />
          </div>
        );
      case "plan_to_read":
        return (
          <div className="rounded-full bg-blue-100 p-2 dark:bg-blue-800/30">
            <ChevronRight className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          </div>
        );
      case "on_hold":
        return (
          <div className="rounded-full bg-amber-100 p-2 dark:bg-amber-800/30">
            <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          </div>
        );
      default:
        return (
          <div className="rounded-full bg-gray-100 p-2 dark:bg-gray-800">
            <Info className="h-4 w-4 text-gray-600 dark:text-gray-400" />
          </div>
        );
    }
  };

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

      {importSuccess ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
        >
          <Card className="bg-muted/10 border-none pt-0 shadow-md">
            <CardContent className="pt-6">
              <div className="mx-auto max-w-md py-8 text-center">
                <motion.div
                  className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30"
                  initial={{ scale: 0, rotate: -180 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: "spring", stiffness: 200, damping: 15 }}
                >
                  <CheckCircle2 className="h-10 w-10 text-green-600 dark:text-green-400" />
                </motion.div>
                <h2 className="mb-3 text-2xl font-bold">Import Successful!</h2>
                <p className="text-muted-foreground mb-6">
                  Your {importData?.manga?.length || 0} manga entries have been
                  successfully imported.
                </p>
                <Progress value={progress} className="mb-4 h-2 w-full" />
                <p className="text-muted-foreground text-sm">
                  Redirecting to review page...
                </p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      ) : !importData ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <Card className="bg-muted/10 border-none pt-0 shadow-md">
            <CardHeader className="rounded-t-lg bg-gradient-to-r from-blue-500/10 to-indigo-500/10 pb-4">
              <CardTitle className="mt-2 flex items-center gap-2 text-xl">
                <motion.div
                  className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-r from-blue-500 to-indigo-500 text-white"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <Upload className="h-4 w-4" />
                </motion.div>
                Import From Kenmei
              </CardTitle>
              <CardDescription>
                Upload your Kenmei export file to begin the import process
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <Tabs defaultValue="upload" className="w-full">
                <TabsList className="bg-muted/50 grid w-full grid-cols-2 dark:bg-gray-800/50">
                  <TabsTrigger
                    value="upload"
                    className="data-[state=active]:bg-background flex items-center gap-1.5 dark:text-gray-300 dark:data-[state=active]:bg-gray-700 dark:data-[state=active]:text-white dark:data-[state=active]:shadow-sm"
                  >
                    <FilesIcon className="h-4 w-4" />
                    Upload File
                  </TabsTrigger>
                  <TabsTrigger
                    value="help"
                    className="data-[state=active]:bg-background flex items-center gap-1.5 dark:text-gray-300 dark:data-[state=active]:bg-gray-700 dark:data-[state=active]:text-white dark:data-[state=active]:shadow-sm"
                  >
                    <Info className="h-4 w-4" />
                    How To Export
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="upload" className="pt-4">
                  <div className="mb-6">
                    <p className="text-muted-foreground mb-4 text-sm">
                      Drag and drop your Kenmei export file here, or click to
                      select a file.{" "}
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
                      <FileDropZone
                        onFileLoaded={handleFileLoaded}
                        onError={handleError}
                      />
                    </motion.div>
                  </div>
                </TabsContent>

                <TabsContent value="help" className="pt-4">
                  <motion.div
                    className="bg-muted/20 rounded-lg border p-6"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.3, duration: 0.5 }}
                  >
                    <h3 className="mb-4 text-base font-medium">
                      How to export from Kenmei
                    </h3>
                    <ol className="text-muted-foreground ml-5 list-decimal space-y-2 text-sm">
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
            </CardContent>
          </Card>
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <Card className="bg-muted/10 border-none pt-0 shadow-md">
            <CardHeader className="rounded-t-lg bg-gradient-to-r from-green-500/10 to-blue-500/10 pb-4">
              <CardTitle className="mt-2 flex items-center gap-2 text-xl">
                <motion.div
                  className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-r from-green-500 to-blue-500 text-white"
                  whileHover={{ scale: 1.05 }}
                >
                  <FileCheck className="h-4 w-4" />
                </motion.div>
                File Ready for Import
              </CardTitle>
              <CardDescription>
                Review your data before proceeding to the matching step
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 pt-6">
              <motion.div
                className="grid grid-cols-2 gap-3 md:grid-cols-4"
                variants={containerVariants}
                initial="hidden"
                animate="show"
              >
                <motion.div variants={itemVariants}>
                  <Card className="border border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-900/20">
                    <CardContent className="flex items-center gap-3 p-4">
                      <div className="rounded-full bg-blue-100 p-2 dark:bg-blue-800/30">
                        <BarChart className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div>
                        <p className="text-xs font-medium text-blue-600 dark:text-blue-400">
                          Total Entries
                        </p>
                        <p className="text-xl font-bold text-blue-700 dark:text-blue-300">
                          {importData.manga.length}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>

                {Object.entries(statusCounts).map(([status, count], index) => (
                  <motion.div
                    key={status}
                    variants={itemVariants}
                    custom={index}
                  >
                    <Card className={`border ${getStatusColor(status)}`}>
                      <CardContent className="flex items-center gap-3 p-4">
                        {getStatusIcon(status)}
                        <div>
                          <p className="text-xs font-medium">
                            {status === "plan_to_read"
                              ? "Plan to Read"
                              : status === "on_hold"
                                ? "On Hold"
                                : status.charAt(0).toUpperCase() +
                                  status.slice(1)}
                          </p>
                          <p className="text-xl font-bold">{count}</p>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </motion.div>

              <Separator />

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5, duration: 0.5 }}
              >
                <h3 className="mb-3 text-lg font-medium">Manga Entries</h3>
                <DataTable data={importData.manga} itemsPerPage={50} />
              </motion.div>

              <motion.div
                className="flex flex-col gap-4 sm:flex-row"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6, duration: 0.4 }}
              >
                <Button
                  onClick={handleImport}
                  disabled={isLoading}
                  size="lg"
                  className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
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
                    "Continue to Review"
                  )}
                </Button>
                <Button
                  onClick={resetForm}
                  disabled={isLoading}
                  variant="outline"
                  size="lg"
                >
                  Cancel
                </Button>
              </motion.div>

              {previousMatchCount > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.7, duration: 0.4 }}
                >
                  <Alert className="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-900/20">
                    <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    <AlertDescription className="text-blue-700 dark:text-blue-300">
                      <span className="font-medium">Note:</span> You have{" "}
                      {previousMatchCount} previously matched manga entries.
                      Your matching progress will be preserved when proceeding
                      to the next step.
                    </AlertDescription>
                  </Alert>
                </motion.div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      )}
    </motion.div>
  );
}
