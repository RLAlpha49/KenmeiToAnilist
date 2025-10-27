/**
 * @packageDocumentation
 * @module BackupRestoreSection
 * @description Backup and restore section for the Data tab.
 */

import React from "react";
import { motion } from "framer-motion";
import {
  Download,
  Upload,
  History,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { highlightText } from "@/utils/textHighlight";
import { cn } from "@/utils/tailwind";
import { clearBackupHistory, type BackupHistoryEntry } from "@/utils/backup";

interface BackupRestoreSectionProps {
  backupHistory: BackupHistoryEntry[];
  isCreatingBackup: boolean;
  isRestoringBackup: boolean;
  autoBackupEnabled: boolean;
  selectedBackupFile: File | null;
  backupValidationError: string | null;
  showBackupHistory: boolean;
  searchQuery: string;
  highlightedSectionId: string | null;
  onCreateBackup: () => void;
  onRestoreBackup: () => void;
  onToggleAutoBackup: (enabled: boolean) => void;
  onFileSelect: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onToggleBackupHistory: (show: boolean) => void;
  setBackupHistory: (history: BackupHistoryEntry[]) => void;
}

/**
 * Backup and restore section component.
 * Handles creating backups, importing backup files, and managing backup history.
 *
 * @source
 */
export function BackupRestoreSection({
  backupHistory,
  isCreatingBackup,
  isRestoringBackup,
  autoBackupEnabled,
  selectedBackupFile,
  backupValidationError,
  showBackupHistory,
  searchQuery,
  highlightedSectionId,
  onCreateBackup,
  onRestoreBackup,
  onToggleAutoBackup,
  onFileSelect,
  onToggleBackupHistory,
  setBackupHistory,
}: Readonly<BackupRestoreSectionProps>) {
  return (
    <div id="data-backup" className="space-y-4">
      {/* Export Section */}
      <motion.div
        className={cn(
          "bg-muted/40 space-y-4 rounded-xl border p-4",
          highlightedSectionId === "data-backup" &&
            "ring-2 ring-blue-500 ring-offset-2 ring-offset-white dark:ring-blue-400 dark:ring-offset-slate-950",
        )}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.4 }}
      >
        <div>
          <h3 className="flex items-center gap-2 text-sm font-medium">
            <Download className="h-4 w-4 text-violet-500" />
            {searchQuery
              ? highlightText("Create Backup", searchQuery)
              : "Create Backup"}
          </h3>
          <p className="text-muted-foreground text-xs">
            {searchQuery
              ? highlightText(
                  "Export and save all Kenmei data, match results, configuration, and history as a backup file.",
                  searchQuery,
                )
              : "Export and save all Kenmei data, match results, configuration, and history as a backup file."}
          </p>
        </div>

        <Separator />

        <div className="space-y-3">
          <label
            className="hover:bg-muted flex items-center gap-2 rounded-md p-2"
            htmlFor="auto-backup-enabled"
            aria-label="Enable automatic backups"
          >
            <input
              id="auto-backup-enabled"
              type="checkbox"
              className="border-primary text-primary h-4 w-4 rounded"
              checked={autoBackupEnabled}
              onChange={(e) => onToggleAutoBackup(e.target.checked)}
            />
            <div>
              <span className="text-sm font-medium">
                Enable automatic backups
              </span>
              <p className="text-muted-foreground text-xs">
                Create backups before sync and matching operations
              </p>
            </div>
          </label>
        </div>

        <Button
          onClick={onCreateBackup}
          disabled={isCreatingBackup}
          className="w-full"
        >
          {isCreatingBackup ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Creating backup...
            </>
          ) : (
            <>
              <Download className="mr-2 h-4 w-4" />
              Create Backup Now
            </>
          )}
        </Button>

        {backupValidationError && (
          <div className="rounded-md bg-red-50 p-3 dark:bg-red-900/20">
            <div className="flex gap-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 text-red-400" />
              <p className="text-sm text-red-800 dark:text-red-200">
                {backupValidationError}
              </p>
            </div>
          </div>
        )}
      </motion.div>

      {/* Import Section */}
      <motion.div
        className="bg-muted/40 space-y-4 rounded-xl border p-4"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.4 }}
      >
        <div>
          <h3 className="flex items-center gap-2 text-sm font-medium">
            <Upload className="h-4 w-4 text-purple-500" />
            {searchQuery
              ? highlightText("Restore from Backup", searchQuery)
              : "Restore from Backup"}
          </h3>
          <p className="text-muted-foreground text-xs">
            {searchQuery
              ? highlightText(
                  "Import and restore all data from a previously created backup file.",
                  searchQuery,
                )
              : "Import and restore all data from a previously created backup file."}
          </p>
        </div>

        <Separator />

        <div className="rounded-md bg-yellow-50 p-3 dark:bg-yellow-900/20">
          <div className="flex gap-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 text-yellow-400" />
            <p className="text-sm text-yellow-800 dark:text-yellow-200">
              <strong>Warning:</strong> Restoring from backup will overwrite
              your current data. Create a backup first if needed.
            </p>
          </div>
        </div>

        <div>
          <input
            type="file"
            id="backup-file-input"
            accept=".json"
            onChange={onFileSelect}
            className="hidden"
          />
          <label
            htmlFor="backup-file-input"
            className="hover:bg-muted/60 flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 transition-colors"
          >
            <Upload className="text-muted-foreground mb-2 h-8 w-8" />
            <span className="text-sm font-medium">
              {selectedBackupFile
                ? selectedBackupFile.name
                : "Choose backup file or drag and drop"}
            </span>
            <span className="text-muted-foreground text-xs">
              JSON backup file
            </span>
          </label>
        </div>

        <Button
          onClick={onRestoreBackup}
          disabled={isRestoringBackup || !selectedBackupFile}
          className="w-full"
        >
          {isRestoringBackup ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Restoring...
            </>
          ) : (
            <>
              <Upload className="mr-2 h-4 w-4" />
              Restore Backup
            </>
          )}
        </Button>
      </motion.div>

      {/* Backup History Section */}
      <motion.div
        className="bg-muted/40 space-y-4 rounded-xl border p-4"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.4 }}
      >
        <div className="flex items-center justify-between">
          <div>
            <h3 className="flex items-center gap-2 text-sm font-medium">
              <History className="h-4 w-4 text-indigo-500" />
              {searchQuery
                ? highlightText("Recent Backups", searchQuery)
                : "Recent Backups"}
            </h3>
            <p className="text-muted-foreground text-xs">
              {searchQuery
                ? highlightText(
                    `View and restore from ${Math.min(backupHistory.length, 5)} most recent backup files`,
                    searchQuery,
                  )
                : `Last ${Math.min(backupHistory.length, 5)} backups`}
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onToggleBackupHistory(!showBackupHistory)}
          >
            {showBackupHistory ? "Hide" : "Show"}
          </Button>
        </div>

        {showBackupHistory && (
          <>
            <Separator />
            {backupHistory.length > 0 ? (
              <div className="space-y-2">
                {backupHistory.map((entry) => (
                  <div
                    key={entry.id}
                    className="hover:bg-muted/60 flex items-center justify-between rounded-md p-3 transition-colors"
                  >
                    <div className="space-y-1">
                      <p className="text-sm font-medium">
                        {new Date(entry.timestamp).toLocaleString()}
                      </p>
                      <div className="flex gap-2">
                        <Badge variant="outline" className="text-xs">
                          v{entry.appVersion}
                        </Badge>
                        <span className="text-muted-foreground text-xs">
                          {(entry.size / 1024).toFixed(2)} KB
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
                <Separator className="my-2" />
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-xs"
                  onClick={() => {
                    clearBackupHistory();
                    setBackupHistory([]);
                  }}
                >
                  Clear History
                </Button>
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">
                No backups available yet. Create one to get started.
              </p>
            )}
          </>
        )}
      </motion.div>
    </div>
  );
}
