import React from "react";
import { useNavigate } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Card, CardContent } from "../ui/card";
import { Button } from "../ui/button";
import { AlertCircle } from "lucide-react";

/**
 * Props for the ErrorStateDisplay component.
 * @property authError - Whether authentication is required.
 * @property matchDataError - Whether matched data is missing.
 * @property validMatchesError - Whether no approved matches exist.
 * @source
 */
interface ErrorStateDisplayProps {
  authError: boolean;
  matchDataError: boolean;
  validMatchesError: boolean;
}

/**
 * Display contextual error states with navigation guidance.
 * Shows different error messages and action buttons based on the error type.
 * @source
 */
export function ErrorStateDisplay({
  authError,
  matchDataError,
  validMatchesError,
}: Readonly<ErrorStateDisplayProps>) {
  const navigate = useNavigate();

  const errorState = (() => {
    if (authError) {
      return {
        title: "Authentication required",
        description:
          "Connect your AniList account to continue. You can link it from the settings panel in just a moment.",
        primary: {
          label: "Open settings",
          to: "/settings",
        },
        accent: {
          glow: "from-blue-300/60 to-transparent",
          icon: "from-blue-500 to-indigo-500",
          button: "from-blue-500 via-indigo-500 to-purple-500",
        },
      };
    }

    if (matchDataError) {
      return {
        title: "Matching required",
        description:
          "We couldn't find any matched manga entries. Review and confirm matches before syncing.",
        primary: {
          label: "Go to matching page",
          to: "/review",
        },
        accent: {
          glow: "from-sky-300/60 to-transparent",
          icon: "from-sky-500 to-blue-500",
          button: "from-sky-500 via-blue-500 to-indigo-500",
        },
      };
    }

    if (validMatchesError) {
      return {
        title: "No approved matches",
        description:
          "You're almost there! Approve or manually match the entries you want to sync, then return here.",
        primary: {
          label: "Review matches",
          to: "/review",
        },
        accent: {
          glow: "from-amber-300/60 to-transparent",
          icon: "from-amber-500 to-orange-500",
          button: "from-amber-500 via-orange-500 to-rose-500",
        },
      };
    }

    return {
      title: "Ready when you are",
      description:
        "Everything looks good! Use the navigation to continue exploring the sync flow.",
      primary: {
        label: "Back to home",
        to: "/",
      },
      accent: {
        glow: "from-emerald-300/60 to-transparent",
        icon: "from-emerald-500 to-teal-500",
        button: "from-emerald-500 via-teal-500 to-blue-500",
      },
    };
  })();

  return (
    <div className="relative py-10">
      <div className="pointer-events-none absolute inset-x-0 top-0 flex justify-center">
        <div
          className={`h-60 w-60 rounded-full bg-gradient-to-br ${errorState.accent.glow} blur-3xl`}
        />
      </div>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.25, duration: 0.3 }}
      >
        <Card className="mx-auto w-full max-w-lg overflow-hidden border border-slate-200/60 bg-white/80 text-center shadow-xl backdrop-blur-xl dark:border-slate-800/60 dark:bg-slate-950/70">
          <CardContent className="space-y-6 py-10">
            <div
              className={`mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br ${errorState.accent.icon} text-white shadow-lg`}
            >
              <AlertCircle className="h-8 w-8" />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
                {errorState.title}
              </h3>
              <p className="mx-auto max-w-md text-sm text-slate-600 dark:text-slate-400">
                {errorState.description}
              </p>
            </div>
            <div className="flex justify-center">
              <Button
                onClick={() => navigate({ to: errorState.primary.to })}
                className={`group relative flex items-center gap-2 overflow-hidden rounded-full bg-gradient-to-r ${errorState.accent.button} px-6 py-2 text-sm font-semibold text-white shadow-lg transition hover:shadow-xl`}
              >
                {errorState.primary.label}
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
