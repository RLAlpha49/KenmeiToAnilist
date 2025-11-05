/**
 * @packageDocumentation
 * @module UpdateManagementSection
 * @description Update management section for checking, downloading, and installing updates.
 */

import React from "react";
import { RefreshCw, Loader2, Download, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { SettingsSectionShell } from "./SettingsSectionShell";
import { getAppVersion, compareVersions } from "@/utils/app-version";
import { cn } from "@/utils/tailwind";

/**
 * Props for UpdateManagementSection component.
 * @source
 */
interface UpdateManagementSectionProps {
  /** Current update channel (stable or beta). */
  updateChannel: "stable" | "beta";
  /** Whether update check is in progress. */
  isCheckingUpdate: boolean;
  /** Latest available update info or null. */
  updateInfo: { version: string; url: string; isBeta: boolean } | null;
  /** Error message if update check failed. */
  updateError: string | null;
  /** Whether update is currently downloading. */
  isDownloading: boolean;
  /** Download progress percentage (0-100). */
  downloadProgress: number;
  /** Whether update has been downloaded. */
  isDownloaded: boolean;
  /** Currently highlighted section ID. */
  highlightedSectionId: string | null;
  /** Callback when update channel changes. */
  onUpdateChannelChange: (channel: "stable" | "beta") => void;
  /** Callback to check for updates. */
  onCheckForUpdates: () => void;
  /** Callback to download update. */
  onDownloadUpdate: () => void;
  /** Callback to install update. */
  onInstallUpdate: () => void;
  /** Callback to open external URL. */
  onOpenExternal: (url: string) => (e: React.MouseEvent) => void;
}

/**
 * Update management section component.
 * Handles checking for updates, downloading, and installing updates.
 * @param props - Component props.
 * @returns The rendered update management section.
 * @source
 */
export function UpdateManagementSection({
  updateChannel,
  isCheckingUpdate,
  updateInfo,
  updateError,
  isDownloading,
  downloadProgress,
  isDownloaded,
  highlightedSectionId,
  onUpdateChannelChange,
  onCheckForUpdates,
  onDownloadUpdate,
  onInstallUpdate,
  onOpenExternal,
}: Readonly<UpdateManagementSectionProps>) {
  return (
    <div
      id="data-updates"
      className={cn(
        highlightedSectionId === "data-updates" &&
          "rounded-2xl ring-2 ring-blue-500 ring-offset-2 ring-offset-white dark:ring-blue-400 dark:ring-offset-slate-950",
      )}
    >
      <SettingsSectionShell
        icon={RefreshCw}
        title="Check for updates"
        description="Stay current with the latest Kenmei → AniList improvements."
        accent="from-sky-500/15 via-blue-500/10 to-transparent"
        className="mt-6"
        contentClassName="space-y-5"
      >
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <RadioGroup
            value={updateChannel}
            onValueChange={(v) => onUpdateChannelChange(v as "stable" | "beta")}
            className="flex flex-row gap-4"
            aria-label="Update Channel"
          >
            <div className="flex items-center gap-2">
              <RadioGroupItem value="stable" id="update-stable" />
              <label htmlFor="update-stable" className="text-sm font-medium">
                Stable
              </label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="beta" id="update-beta" />
              <label htmlFor="update-beta" className="text-sm font-medium">
                Beta/Early Access
              </label>
            </div>
          </RadioGroup>
          <Button
            onClick={onCheckForUpdates}
            disabled={isCheckingUpdate}
            aria-label="Check for updates"
            className="w-full md:w-auto"
          >
            {isCheckingUpdate ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Checking...
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                Check for Updates
              </>
            )}
          </Button>
        </div>
        {updateError && (
          <div className="rounded-2xl border border-rose-400/40 bg-rose-500/10 px-4 py-2 text-sm text-rose-100">
            {updateError}
          </div>
        )}
        {updateInfo && (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="mb-3 flex flex-wrap items-center gap-3">
              <Badge
                className={
                  updateInfo.isBeta
                    ? "bg-yellow-50 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300"
                    : "bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                }
              >
                {updateInfo.isBeta ? "Beta/Early Access" : "Stable"}
              </Badge>
              <span className="font-mono text-xs text-slate-200">
                Latest: {updateInfo.version}
              </span>
              <button
                type="button"
                aria-label="View release on GitHub"
                className="text-blue-300 underline transition hover:text-blue-200"
                onClick={onOpenExternal(updateInfo.url)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    if (globalThis.electronAPI?.shell?.openExternal) {
                      globalThis.electronAPI.shell.openExternal(updateInfo.url);
                    } else {
                      globalThis.open(
                        updateInfo.url,
                        "_blank",
                        "noopener,noreferrer",
                      );
                    }
                  }
                }}
              >
                View release notes
              </button>
            </div>
            <div className="mb-4 flex flex-wrap items-center gap-3 text-xs text-slate-200">
              <span className="font-mono">Current: {getAppVersion()}</span>
              {(() => {
                const current = getAppVersion().replace(/^v/, "");
                const latest = updateInfo.version.replace(/^v/, "");
                if (current === latest) {
                  return (
                    <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                      Up to date
                    </Badge>
                  );
                }
                if (compareVersions(current, latest) < 0) {
                  return (
                    <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                      Update available
                    </Badge>
                  );
                }
                return (
                  <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                    Development build
                  </Badge>
                );
              })()}
            </div>

            {/* Download/Install Actions */}
            <div className="space-y-3">
              {/* Download Progress Bar */}
              {(isDownloading || downloadProgress > 0) && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-300">
                    <span>Downloading...</span>
                    <span>{Math.round(downloadProgress * 100)}%</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-slate-700/50">
                    <div
                      className="bg-linear-to-r h-full from-blue-500 to-cyan-500 transition-all duration-300"
                      style={{ width: `${downloadProgress * 100}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Download Button */}
              {!isDownloading && !isDownloaded && (
                <Button
                  onClick={onDownloadUpdate}
                  disabled={isCheckingUpdate}
                  className="w-full"
                  variant="default"
                >
                  <Download className="mr-2 h-4 w-4" />
                  Download Update
                </Button>
              )}

              {/* Install Button */}
              {isDownloaded && !isDownloading && (
                <Button
                  onClick={onInstallUpdate}
                  className="w-full bg-green-600 hover:bg-green-700"
                >
                  <Check className="mr-2 h-4 w-4" />
                  Install Update
                </Button>
              )}
            </div>
          </div>
        )}
      </SettingsSectionShell>
    </div>
  );
}
