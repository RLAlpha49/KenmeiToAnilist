import React from "react";
import { motion } from "framer-motion";
import { AlertCircle, LogIn } from "lucide-react";
import { Card, CardContent } from "../ui/card";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";

interface Props {
  onGoToSettings: () => void;
}

export default function AuthRequiredCard({ onGoToSettings }: Readonly<Props>) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 0.2, duration: 0.35, ease: "easeOut" }}
    >
      <Card className="relative mx-auto w-full max-w-xl overflow-hidden border border-blue-200/70 bg-gradient-to-br from-slate-50/85 via-white/75 to-blue-50/70 shadow-xl shadow-blue-200/30 supports-[backdrop-filter]:backdrop-blur-md dark:border-blue-900/50 dark:from-slate-950/70 dark:via-slate-950/40 dark:to-blue-950/45">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.35)_0%,rgba(255,255,255,0)_70%)] opacity-80 dark:bg-[radial-gradient(circle_at_top,_rgba(96,165,250,0.25)_0%,rgba(15,23,42,0)_78%)]" />
        <CardContent className="relative flex flex-col gap-5 p-7 text-left sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-1 items-start gap-4">
            <span className="flex h-14 w-28 items-center justify-center rounded-2xl bg-blue-500/15 text-blue-600 shadow-inner shadow-blue-200/40 dark:bg-blue-500/18 dark:text-blue-300">
              <AlertCircle className="h-6 w-6" />
            </span>
            <div className="space-y-2">
              <Badge className="rounded-full border border-blue-200/60 bg-blue-100/50 text-[11px] font-semibold tracking-[0.22em] text-blue-700 uppercase dark:border-blue-800/60 dark:bg-blue-900/40 dark:text-blue-200">
                Action required
              </Badge>
              <h3 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
                Connect AniList to continue syncing
              </h3>
              <p className="max-w-md text-sm text-slate-600/90 dark:text-slate-300/90">
                Sign in with your AniList account so we can fetch and update
                your manga library securely. This only takes a moment.
              </p>
            </div>
          </div>
          <div className="flex flex-shrink-0 flex-col items-stretch gap-3 sm:items-end">
            <Button
              onClick={onGoToSettings}
              className="h-11 min-w-[12rem] gap-2 rounded-full bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 px-5 text-sm font-semibold tracking-[0.2em] text-white uppercase shadow-lg shadow-blue-400/40 transition hover:from-blue-600/90 hover:via-indigo-600/90 hover:to-purple-600/90"
            >
              <LogIn className="h-4 w-4" /> Launch settings
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
