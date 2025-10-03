import React from "react";
import { useNavigate } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Card, CardContent } from "../ui/card";
import { Button } from "../ui/button";
import { AlertCircle } from "lucide-react";

interface ErrorStateDisplayProps {
  authError: boolean;
  matchDataError: boolean;
  validMatchesError: boolean;
}

export function ErrorStateDisplay({
  authError,
  matchDataError,
  validMatchesError,
}: Readonly<ErrorStateDisplayProps>) {
  const navigate = useNavigate();

  return (
    <div className="container py-6">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.25, duration: 0.3 }}
      >
        <Card
          className={`mx-auto w-full max-w-md overflow-hidden text-center ${authError ? "border-amber-200 bg-amber-50/30 dark:border-amber-800/30 dark:bg-amber-900/10" : ""}`}
        >
          <CardContent className="pt-6 pb-4">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
              <AlertCircle className="h-6 w-6 text-amber-600 dark:text-amber-400" />
            </div>

            {authError && (
              <>
                <h3 className="text-lg font-medium">Authentication Required</h3>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                  You need to be authenticated with AniList to synchronize your
                  manga.
                </p>
                <Button
                  onClick={() => navigate({ to: "/settings" })}
                  className="mt-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
                >
                  Go to Settings
                </Button>
              </>
            )}

            {matchDataError && !authError && (
              <>
                <h3 className="text-lg font-medium">Missing Match Data</h3>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                  No matched manga found. You need to match your manga with
                  AniList entries first.
                </p>
                <Button
                  onClick={() => navigate({ to: "/review" })}
                  className="mt-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
                >
                  Go to Matching Page
                </Button>
              </>
            )}

            {validMatchesError && !authError && !matchDataError && (
              <>
                <h3 className="text-lg font-medium">No Valid Matches</h3>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                  No approved matches found. You need to review and accept manga
                  matches before synchronizing.
                </p>
                <Button
                  onClick={() => navigate({ to: "/review" })}
                  className="mt-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
                >
                  Review Matches
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
