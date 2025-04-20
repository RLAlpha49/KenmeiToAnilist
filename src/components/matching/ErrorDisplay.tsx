import React from "react";
import { ApiError } from "../../types/matching";
import { AlertCircle, RefreshCw, Home, Settings, Database } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardFooter,
} from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Alert, AlertTitle, AlertDescription } from "../../components/ui/alert";
import { Separator } from "../../components/ui/separator";
import { motion } from "framer-motion";

interface ErrorDisplayProps {
  error: string;
  detailedError: ApiError | null;
  onRetry: () => void;
  onClearPendingManga?: () => void;
}

export const ErrorDisplay: React.FC<ErrorDisplayProps> = ({
  error,
  detailedError,
  onRetry,
  onClearPendingManga,
}) => {
  const navigate = useNavigate();

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="container mx-auto max-w-2xl"
    >
      <Card className="overflow-hidden border-red-200 shadow-md dark:border-red-800/50">
        <CardHeader className="bg-gradient-to-r from-red-50 to-rose-50 dark:from-red-950/40 dark:to-rose-950/40">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
            <CardTitle>Error Matching Manga</CardTitle>
          </div>
        </CardHeader>

        <CardContent className="space-y-4 p-6">
          <Alert
            variant="destructive"
            className="border-red-200 bg-red-50/70 dark:border-red-900/50 dark:bg-red-900/20"
          >
            <AlertCircle className="h-4 w-4" />
            <AlertTitle className="mb-1 font-semibold">
              Something went wrong
            </AlertTitle>
            <AlertDescription className="text-sm">{error}</AlertDescription>
          </Alert>

          {detailedError && (
            <div className="rounded-md border border-red-100 dark:border-red-900/50">
              <details className="cursor-pointer">
                <summary className="bg-red-50/50 p-3 font-medium dark:bg-red-900/20">
                  Technical Details
                </summary>
                <div className="max-h-60 overflow-auto p-3">
                  <pre className="rounded-md bg-slate-950 p-4 font-mono text-xs whitespace-pre-wrap text-slate-50">
                    {JSON.stringify(detailedError, null, 2)}
                  </pre>
                </div>
              </details>
            </div>
          )}

          <div className="flex flex-wrap gap-3">
            <Button
              variant="default"
              onClick={onRetry}
              className="bg-red-600 text-white hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-600"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Retry Matching
            </Button>

            <Button
              variant="outline"
              onClick={() => {
                if (onClearPendingManga) {
                  onClearPendingManga();
                }
                navigate({ to: "/import" });
              }}
            >
              <Home className="mr-2 h-4 w-4" />
              Back to Import
            </Button>

            <Button
              variant="outline"
              onClick={() => navigate({ to: "/settings" })}
            >
              <Settings className="mr-2 h-4 w-4" />
              Go to Settings
            </Button>
          </div>
        </CardContent>

        <Separator />

        <CardFooter className="bg-muted/20 flex justify-between p-4">
          <div className="flex gap-3">
            <button
              onClick={async () => {
                try {
                  const { cacheDebugger } = await import(
                    "../../api/matching/manga-search-service"
                  );
                  const status = cacheDebugger.getCacheStatus();
                  console.log("Current cache status:", status);
                  alert(
                    `Cache Status:\n- In Memory: ${status.inMemoryCache} entries\n- LocalStorage: ${status.localStorage.mangaCache} manga entries, ${status.localStorage.searchCache} search entries`,
                  );
                } catch (e) {
                  console.error("Failed to check cache status:", e);
                }
              }}
              className="text-muted-foreground hover:text-foreground inline-flex items-center text-xs"
              aria-label="Debug cache status"
            >
              <Database className="mr-1 h-3 w-3" />
              Check Cache Status
            </button>

            <button
              onClick={async () => {
                try {
                  const { cacheDebugger } = await import(
                    "../../api/matching/manga-search-service"
                  );
                  if (
                    window.confirm(
                      "Are you sure you want to clear all caches? This will require re-fetching all manga data.",
                    )
                  ) {
                    cacheDebugger.resetAllCaches();

                    // Also clear pending manga data
                    if (onClearPendingManga) {
                      onClearPendingManga();
                    }

                    alert("All caches have been cleared.");
                  }
                } catch (e) {
                  console.error("Failed to reset caches:", e);
                }
              }}
              className="text-muted-foreground hover:text-foreground inline-flex items-center text-xs"
              aria-label="Reset all caches"
            >
              <RefreshCw className="mr-1 h-3 w-3" />
              Reset Caches
            </button>
          </div>
        </CardFooter>
      </Card>
    </motion.div>
  );
};
