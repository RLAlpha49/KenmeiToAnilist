/**
 * @packageDocumentation
 * @module ApplicationInsightsSection
 * @description Application insights section displaying version info, auth status, and last sync.
 */

import React from "react";
import { Info as InfoIcon, Clock, UserCircle, Key } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { SettingsSectionShell } from "./SettingsSectionShell";
import { getAppVersion, type AppVersionStatus } from "@/utils/app-version";
import { cn } from "@/utils/tailwind";
import type { AuthState } from "@/types/auth";

interface ApplicationInsightsSectionProps {
  versionStatus: AppVersionStatus | null;
  authState: AuthState;
  lastSyncMetadata: { label: string; hint: string };
  credentialSourceLabel: string;
  useCustomCredentials: boolean;
  expiresLabel: string | undefined;
  highlightedSectionId: string | null;
}

/**
 * Application insights section component.
 * Displays version info, update channel, authentication status, and last sync metadata.
 *
 * @source
 */
export function ApplicationInsightsSection({
  versionStatus,
  authState,
  lastSyncMetadata,
  credentialSourceLabel,
  useCustomCredentials,
  expiresLabel,
  highlightedSectionId,
}: Readonly<ApplicationInsightsSectionProps>) {
  return (
    <div
      id="data-insights"
      className={cn(
        highlightedSectionId === "data-insights" &&
          "rounded-2xl ring-2 ring-blue-500 ring-offset-2 ring-offset-white dark:ring-blue-400 dark:ring-offset-slate-950",
      )}
    >
      <SettingsSectionShell
        icon={InfoIcon}
        title="Application insights"
        description="Quick glance."
        accent="from-indigo-500/15 via-purple-500/10 to-transparent"
        className="mt-6"
        contentClassName="space-y-6"
        badge={
          <Badge className="bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-200">
            Version {getAppVersion()}
          </Badge>
        }
      >
        {(() => {
          let channelLabel: string;
          if (versionStatus === null) {
            channelLabel = "Checking channel status";
          } else if (versionStatus.status === "stable") {
            channelLabel = "Stable channel";
          } else if (versionStatus.status === "beta") {
            channelLabel = "Beta channel";
          } else {
            channelLabel = "Development channel";
          }
          return (
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600 dark:text-slate-200">
              <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-slate-700 dark:border-white/15 dark:bg-white/10 dark:text-slate-200">
                <Clock className="h-3.5 w-3.5" />
                {channelLabel}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-slate-700 dark:border-white/15 dark:bg-white/10 dark:text-slate-200">
                <UserCircle className="h-3.5 w-3.5" />
                {authState.isAuthenticated
                  ? "Session active"
                  : "Session inactive"}
              </span>
            </div>
          );
        })()}

        <div className="grid gap-3 md:grid-cols-3">
          <div className="bg-muted/40 rounded-2xl border p-4">
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-900 dark:text-slate-300">
              <Clock className="h-4 w-4" /> Last synced
            </div>
            <p className="mt-2 text-sm text-white">{lastSyncMetadata.label}</p>
            <p className="text-xs text-slate-900/80 dark:text-slate-300/80">
              {lastSyncMetadata.hint}
            </p>
          </div>
          <div className="bg-muted/40 rounded-2xl border p-4">
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-900 dark:text-slate-300">
              <Key className="h-4 w-4" /> Credentials
            </div>
            <p className="mt-2 text-sm text-white">{credentialSourceLabel}</p>
            <p className="text-xs text-slate-900/80 dark:text-slate-300/80">
              {useCustomCredentials
                ? "Using custom AniList API keys"
                : "Using built-in credentials"}
            </p>
          </div>
          <div className="bg-muted/40 rounded-2xl border p-4">
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-900 dark:text-slate-300">
              <UserCircle className="h-4 w-4" /> Authentication
            </div>
            <p className="mt-2 text-sm text-white">
              {authState.isAuthenticated ? "Connected" : "Not connected"}
            </p>
            <p className="text-xs text-slate-900/80 dark:text-slate-300/80">
              {authState.isAuthenticated
                ? `Expires in ${expiresLabel ?? "unknown"}`
                : "Sign in to unlock sync features"}
            </p>
          </div>
        </div>
      </SettingsSectionShell>
    </div>
  );
}
