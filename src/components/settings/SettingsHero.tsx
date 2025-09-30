import React from "react";
import { motion } from "framer-motion";
import {
  BookOpen,
  CheckCircle2,
  Clock8,
  LogIn,
  LogOut,
  PlugZap,
  RefreshCw,
  UserCircle,
} from "lucide-react";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { cn } from "../../utils/tailwind";

interface SettingsHeroProps {
  isAuthenticated: boolean;
  username?: string | null;
  avatarUrl?: string | null;
  statusMessage?: string | null;
  isLoading: boolean;
  onLogin: () => void;
  onLogout: () => void;
  onOpenDocs?: () => void;
  onClearStatus?: () => void;
  onCancelAuth?: () => void;
  credentialSourceLabel: string;
  expiresLabel?: string;
  versionLabel?: string;
  children?: React.ReactNode;
}

export function SettingsHero({
  isAuthenticated,
  username,
  avatarUrl,
  statusMessage,
  isLoading,
  onLogin,
  onLogout,
  onOpenDocs,
  onClearStatus,
  onCancelAuth,
  credentialSourceLabel,
  expiresLabel,
  versionLabel,
  children,
}: Readonly<SettingsHeroProps>) {
  const connectionTone = isAuthenticated
    ? "border-emerald-200 bg-emerald-100 text-emerald-700 dark:border-emerald-400/40 dark:bg-emerald-400/10 dark:text-emerald-200"
    : "border-amber-200 bg-amber-100 text-amber-700 dark:border-amber-400/40 dark:bg-amber-400/10 dark:text-amber-100";

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="relative overflow-hidden rounded-[36px] border border-slate-200/70 bg-gradient-to-br from-white via-slate-50 to-slate-100 text-slate-900 shadow-[0_40px_120px_-60px_rgba(79,70,229,0.25)] dark:border-white/10 dark:from-indigo-600/40 dark:via-slate-900 dark:to-slate-950 dark:text-white dark:shadow-[0_40px_120px_-60px_rgba(79,70,229,0.9)]"
    >
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute top-16 -left-32 h-72 w-72 rounded-full bg-indigo-300/40 blur-3xl dark:bg-indigo-500/30" />
        <div className="absolute -right-24 bottom-0 h-80 w-80 rounded-full bg-purple-200/30 blur-[160px] dark:bg-purple-500/20" />
        <div className="absolute top-1/2 left-1/2 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full bg-sky-200/30 blur-2xl dark:bg-sky-500/10" />
      </div>

      <div className="relative flex flex-col gap-10 p-8 md:flex-row md:items-center md:justify-between md:p-10">
        <div className="space-y-6">
          <Badge className="bg-indigo-100 text-indigo-700 backdrop-blur-sm dark:bg-white/10 dark:text-white">
            Control Center
          </Badge>

          <div className="space-y-3">
            <h1 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl dark:text-white">
              Tune your Kenmei → AniList experience
            </h1>
            <p className="max-w-xl text-sm text-slate-600 sm:text-base dark:text-slate-100/80">
              Manage authentication, fine-tune sync strategies, and keep your
              libraries perfectly aligned across platforms.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            {isAuthenticated ? (
              <Button
                onClick={onLogout}
                size="lg"
                variant="outline"
                className="border-slate-300/80 bg-white/70 text-slate-900 hover:border-slate-400 hover:bg-white dark:border-white/30 dark:bg-white/5 dark:text-white dark:hover:border-white/60 dark:hover:bg-white/10"
                disabled={isLoading}
              >
                <LogOut className="mr-2 h-4 w-4" />
                Sign out
              </Button>
            ) : (
              <Button
                onClick={onLogin}
                size="lg"
                className="bg-indigo-600 text-white hover:bg-indigo-500 dark:bg-white dark:text-slate-900 dark:hover:bg-white/90"
                disabled={isLoading}
              >
                <LogIn className="mr-2 h-4 w-4" />
                Authenticate with AniList
              </Button>
            )}

            <Button
              onClick={onLogin}
              size="lg"
              variant="outline"
              className="border-slate-300 bg-white text-slate-700 hover:border-slate-400 hover:bg-slate-100 dark:border-white/30 dark:bg-white/5 dark:text-white dark:hover:border-white/60 dark:hover:bg-white/10"
              disabled={isLoading}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh token
            </Button>

            {onOpenDocs && (
              <Button
                onClick={onOpenDocs}
                size="lg"
                variant="ghost"
                className="text-slate-700 hover:bg-slate-200/60 hover:text-slate-900 dark:text-slate-100 dark:hover:bg-white/10 dark:hover:text-white"
              >
                <BookOpen className="mr-2 h-4 w-4" />
                View guide
              </Button>
            )}
          </div>

          {statusMessage && (
            <div className="flex flex-wrap items-center gap-2 rounded-full border border-slate-200 bg-white/70 px-4 py-2 text-xs text-slate-700 backdrop-blur-sm sm:text-sm dark:border-white/20 dark:bg-white/10 dark:text-slate-100/90">
              <CheckCircle2 className="h-4 w-4 text-emerald-500 dark:text-emerald-300" />
              <span className="line-clamp-1">{statusMessage}</span>
              {isLoading && onCancelAuth && (
                <button
                  type="button"
                  onClick={onCancelAuth}
                  className="rounded-full border border-rose-200 bg-rose-100 px-2 py-1 text-[10px] font-medium tracking-wide text-rose-700 uppercase transition hover:bg-rose-200 dark:border-white/20 dark:bg-rose-400/20 dark:text-rose-100 dark:hover:bg-rose-400/30"
                >
                  Cancel
                </button>
              )}
              {onClearStatus && (
                <button
                  type="button"
                  onClick={onClearStatus}
                  className="rounded-full border border-slate-200 bg-white/70 px-2 py-1 text-[10px] tracking-wide text-slate-600 uppercase transition hover:bg-white dark:border-white/20 dark:bg-white/10 dark:text-slate-100/70 dark:hover:bg-white/20 dark:hover:text-white"
                >
                  Dismiss
                </button>
              )}
            </div>
          )}
        </div>

        <div className="relative w-full max-w-md">
          <div className="absolute inset-0 rounded-3xl bg-white/60 blur-2xl dark:bg-gradient-to-br dark:from-white/20 dark:via-white/5 dark:to-white/0" />
          <div className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white/80 p-6 shadow-xl backdrop-blur-xl dark:border-white/15 dark:bg-slate-950/60">
            <div
              className={cn(
                "mb-5 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium tracking-wide uppercase",
                connectionTone,
              )}
            >
              <PlugZap className="h-3.5 w-3.5" />
              {isAuthenticated ? "Connected" : "Awaiting auth"}
            </div>

            <div className="space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <p className="text-xs tracking-wide text-slate-500 uppercase dark:text-slate-400">
                    AniList account
                  </p>
                  <p className="text-lg font-semibold text-slate-900 dark:text-white">
                    {isAuthenticated
                      ? username || "Authenticated user"
                      : "Not connected"}
                  </p>
                </div>
                <div className="shrink-0">
                  <div className="relative h-16 w-16 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-inner dark:border-white/15 dark:bg-slate-900/60">
                    {isAuthenticated && avatarUrl ? (
                      <img
                        src={avatarUrl}
                        alt={
                          username ? `${username}'s avatar` : "AniList avatar"
                        }
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <UserCircle className="h-10 w-10 text-slate-400 dark:text-slate-500" />
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <dl className="grid gap-3 text-sm text-slate-700 dark:text-slate-200">
                <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white/70 px-3 py-2 dark:border-white/10 dark:bg-white/5">
                  <dt className="flex items-center gap-2 text-xs tracking-wide text-slate-500 uppercase dark:text-slate-400">
                    <Clock8 className="h-4 w-4" /> Token lifespan
                  </dt>
                  <dd className="font-medium text-slate-900 dark:text-white">
                    {isAuthenticated ? (expiresLabel ?? "Active") : "—"}
                  </dd>
                </div>
                <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white/70 px-3 py-2 dark:border-white/10 dark:bg-white/5">
                  <dt className="flex items-center gap-2 text-xs tracking-wide text-slate-500 uppercase dark:text-slate-400">
                    <CheckCircle2 className="h-4 w-4" /> Credentials
                  </dt>
                  <dd className="font-medium text-slate-900 dark:text-white">
                    {credentialSourceLabel}
                  </dd>
                </div>
                {versionLabel && (
                  <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white/70 px-3 py-2 dark:border-white/10 dark:bg-white/5">
                    <dt className="flex items-center gap-2 text-xs tracking-wide text-slate-500 uppercase dark:text-slate-400">
                      <BookOpen className="h-4 w-4" /> Release channel
                    </dt>
                    <dd className="font-medium text-slate-900 dark:text-white">
                      {versionLabel}
                    </dd>
                  </div>
                )}
              </dl>
            </div>
          </div>
        </div>
      </div>
      {children && (
        <div className="relative border-t border-slate-200 px-8 pt-8 pb-8 md:px-10 dark:border-white/10">
          {children}
        </div>
      )}
    </motion.section>
  );
}
