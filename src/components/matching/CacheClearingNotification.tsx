/**
 * @packageDocumentation
 * @module CacheClearingNotification
 * @description Notification component for indicating cache clearing progress for selected manga.
 */
import React from "react";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "../../components/ui/card";
import { Badge } from "../ui/badge";

/**
 * Props for the CacheClearingNotification component.
 *
 * @property cacheClearingCount - The number of manga entries being cleared from cache.
 * @source
 */
export interface CacheClearingNotificationProps {
  cacheClearingCount: number;
}

/**
 * CacheClearingNotification React component that displays a modal notification while cache is being cleared for selected manga.
 *
 * @param props - {@link CacheClearingNotificationProps}
 * @returns The rendered notification React element.
 * @source
 */
export const CacheClearingNotification: React.FC<
  CacheClearingNotificationProps
> = ({ cacheClearingCount }) => {
  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="absolute inset-0 bg-black/20 backdrop-blur-sm dark:bg-black/50"></div>
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        transition={{ type: "spring", damping: 15 }}
        className="relative z-10 mx-auto w-full max-w-md px-4"
      >
        <Card className="relative overflow-hidden rounded-3xl border border-blue-200/80 bg-gradient-to-br from-blue-50/90 via-white/85 to-slate-50/80 shadow-2xl shadow-blue-500/20 supports-[backdrop-filter]:backdrop-blur-xl dark:border-blue-900/60 dark:from-blue-950/70 dark:via-slate-950/50 dark:to-slate-900/60">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.3)_0%,rgba(59,130,246,0)_70%)] opacity-80 dark:bg-[radial-gradient(circle_at_top,_rgba(96,165,250,0.22)_0%,rgba(15,23,42,0)_75%)]" />
          <CardHeader className="relative pb-2 text-center">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-500/15 text-blue-600 shadow-inner shadow-blue-200/40 dark:bg-blue-500/18 dark:text-blue-300">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
            <div className="mb-3 flex items-center justify-center">
              <Badge className="rounded-full border border-blue-200/70 bg-blue-100/50 text-[11px] font-semibold tracking-[0.22em] text-blue-700 uppercase dark:border-blue-800/60 dark:bg-blue-900/40 dark:text-blue-200">
                Cache maintenance
              </Badge>
            </div>
            <CardTitle className="text-xl font-semibold text-slate-900 dark:text-slate-100">
              Clearing cached results
            </CardTitle>
            <CardDescription className="text-center text-sm text-slate-500 dark:text-slate-400">
              Preparing fresh AniList searches for {cacheClearingCount} selected
              manga titles.
            </CardDescription>
          </CardHeader>
          <CardContent className="relative pb-7 text-center">
            <div className="relative h-2 w-full overflow-hidden rounded-full border border-blue-200/60 bg-white/70 shadow-inner shadow-blue-200/30 dark:border-blue-800/50 dark:bg-blue-950/40">
              <motion.div
                className="absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500"
                initial={{ x: "-33%" }}
                animate={{
                  x: ["-33%", "100%"],
                }}
                transition={{
                  repeat: Infinity,
                  repeatType: "loop",
                  duration: 1.8,
                  ease: "linear",
                }}
              />
            </div>
            <p className="mt-5 text-xs font-medium tracking-[0.25em] text-blue-500/70 uppercase dark:text-blue-300/70">
              Optimizing your sync
            </p>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
};
