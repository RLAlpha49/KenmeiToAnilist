/**
 * @packageDocumentation
 * @module UpdateManagementSection
 * @description Update management section for checking, downloading, and installing updates.
 */

import React from "react";
import {
  RefreshCw,
  Loader2,
  Download,
  Check,
  AlertCircle,
  Zap,
  Shield,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/RadioGroup";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/Card";
import { Label } from "@/components/ui/Label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/Alert";
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
  onOpenExternal: (url: string) => (e: React.SyntheticEvent) => void;
  /** Map of section IDs to their collapsed states. */
  collapsedSections: Record<string, boolean>;
  /** Callback to toggle a section's collapsed state. */
  onToggleSection: (sectionId: string) => void;
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
  collapsedSections,
  onToggleSection,
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
        id="update-management"
        isCollapsible={true}
        isCollapsed={collapsedSections["update-management"] ?? false}
        onCollapsedChange={() => onToggleSection("update-management")}
        icon={RefreshCw}
        title="Check for updates"
        description="Stay current with the latest Kenmei → AniList improvements."
        accent="from-sky-500/15 via-blue-500/10 to-transparent"
        className="mt-6"
        contentClassName="space-y-6"
      >
        <div className="grid gap-6">
          {/* Update Channel Card */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <CardTitle className="text-base">Update Channel</CardTitle>
                  <CardDescription>
                    Select which version of the app you want to receive updates
                    for.
                  </CardDescription>
                </div>
                <Badge variant="outline" className="capitalize">
                  {updateChannel}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <RadioGroup
                value={updateChannel}
                onValueChange={(v) =>
                  onUpdateChannelChange(v as "stable" | "beta")
                }
                className="grid gap-4 sm:grid-cols-2"
              >
                <div
                  className={cn(
                    "flex items-start space-x-3 rounded-lg border p-4 transition-colors hover:bg-slate-50 dark:hover:bg-slate-900/50",
                    updateChannel === "stable" &&
                      "border-blue-500 bg-blue-50/50 dark:border-blue-500/50 dark:bg-blue-950/20",
                  )}
                >
                  <RadioGroupItem
                    value="stable"
                    id="update-stable"
                    className="mt-1"
                  />
                  <Label
                    htmlFor="update-stable"
                    className="cursor-pointer space-y-1"
                  >
                    <div className="flex items-center gap-2 font-medium">
                      <Shield className="h-4 w-4 text-blue-500" />
                      Stable
                    </div>
                    <div className="text-muted-foreground text-xs">
                      Tested and reliable versions. Recommended for most users.
                    </div>
                  </Label>
                </div>
                <div
                  className={cn(
                    "flex items-start space-x-3 rounded-lg border p-4 transition-colors hover:bg-slate-50 dark:hover:bg-slate-900/50",
                    updateChannel === "beta" &&
                      "border-amber-500 bg-amber-50/50 dark:border-amber-500/50 dark:bg-amber-950/20",
                  )}
                >
                  <RadioGroupItem
                    value="beta"
                    id="update-beta"
                    className="mt-1"
                  />
                  <Label
                    htmlFor="update-beta"
                    className="cursor-pointer space-y-1"
                  >
                    <div className="flex items-center gap-2 font-medium">
                      <Zap className="h-4 w-4 text-amber-500" />
                      Beta
                    </div>
                    <div className="text-muted-foreground text-xs">
                      Early access to new features. May contain bugs.
                    </div>
                  </Label>
                </div>
              </RadioGroup>
            </CardContent>
          </Card>

          {/* Update Status Card */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <CardTitle className="text-base">Update Status</CardTitle>
                  <CardDescription>
                    Current version:{" "}
                    <span className="text-foreground font-mono font-medium">
                      {getAppVersion()}
                    </span>
                  </CardDescription>
                </div>
                <Button
                  onClick={onCheckForUpdates}
                  disabled={isCheckingUpdate}
                  aria-label="Check for updates"
                  size="sm"
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
            </CardHeader>
            <CardContent>
              {updateError && (
                <Alert variant="destructive" className="mb-4">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Update Check Failed</AlertTitle>
                  <AlertDescription>{updateError}</AlertDescription>
                </Alert>
              )}

              {updateInfo ? (
                <div className="space-y-4">
                  <div className="bg-muted/50 rounded-lg border p-4">
                    <div className="mb-3 flex flex-wrap items-center gap-3">
                      <Badge
                        className={
                          updateInfo.isBeta
                            ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
                            : "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
                        }
                      >
                        {updateInfo.isBeta ? "Beta Release" : "Stable Release"}
                      </Badge>
                      <span className="font-mono text-sm font-medium">
                        v{updateInfo.version.replace(/^v/, "")}
                      </span>
                      <button
                        type="button"
                        className="text-xs text-blue-500 underline hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300"
                        onClick={onOpenExternal(updateInfo.url)}
                      >
                        Release Notes
                      </button>
                    </div>

                    <div className="flex items-center gap-2 text-sm">
                      {(() => {
                        const current = getAppVersion().replace(/^v/, "");
                        const latest = updateInfo.version.replace(/^v/, "");
                        if (current === latest) {
                          return (
                            <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                              <Check className="h-4 w-4" />
                              <span>You are on the latest version.</span>
                            </div>
                          );
                        }
                        if (compareVersions(current, latest) < 0) {
                          return (
                            <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                              <Download className="h-4 w-4" />
                              <span>A new version is available!</span>
                            </div>
                          );
                        }
                        return (
                          <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
                            <Zap className="h-4 w-4" />
                            <span>You are on a development build.</span>
                          </div>
                        );
                      })()}
                    </div>
                  </div>

                  {/* Download/Install Actions */}
                  {(isDownloading || downloadProgress > 0) && (
                    <div className="space-y-2">
                      <div className="text-muted-foreground flex items-center justify-between text-xs">
                        <span>Downloading update...</span>
                        <span>{Math.round(downloadProgress * 100)}%</span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                        <div
                          className="h-full bg-blue-500 transition-all duration-300"
                          style={{ width: `${downloadProgress * 100}%` }}
                        />
                      </div>
                    </div>
                  )}

                  <div className="flex gap-3">
                    {!isDownloading && !isDownloaded && (
                      <Button
                        onClick={onDownloadUpdate}
                        disabled={isCheckingUpdate}
                        className="flex-1"
                      >
                        <Download className="mr-2 h-4 w-4" />
                        Download Update
                      </Button>
                    )}

                    {isDownloaded && !isDownloading && (
                      <Button
                        onClick={onInstallUpdate}
                        className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                      >
                        <Check className="mr-2 h-4 w-4" />
                        Install & Restart
                      </Button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-muted-foreground flex flex-col items-center justify-center py-6 text-center">
                  <RefreshCw className="mb-2 h-8 w-8 opacity-20" />
                  <p className="text-sm">
                    {isCheckingUpdate
                      ? "Checking for updates..."
                      : "Check for updates to see what's new."}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </SettingsSectionShell>
    </div>
  );
}
