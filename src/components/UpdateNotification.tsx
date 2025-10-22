/**
 * UpdateNotification component for displaying update information and controls.
 * Shows version info, release notes, download progress, and action buttons.
 *
 * @module UpdateNotification
 */

import React, { useState } from "react";
import { motion } from "framer-motion";
import {
  Download,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  X,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";

/**
 * Props for the UpdateNotification component
 */
interface UpdateNotificationProps {
  /** Version string of the available update */
  version: string;
  /** Release notes in markdown or plain text */
  releaseNotes: string;
  /** Release date string */
  releaseDate: string;
  /** Callback when download button is clicked */
  onDownload: () => void;
  /** Callback when dismiss button is clicked */
  onDismiss: () => void;
  /** Callback when install button is clicked */
  onInstall: () => void;
  /** Download progress percentage (0-100) */
  downloadProgress?: number;
  /** Whether download is in progress */
  isDownloading?: boolean;
  /** Whether update has been downloaded */
  isDownloaded?: boolean;
  /** Error message if download/install failed */
  error?: string;
}

/**
 * UpdateNotification component
 * Displays a card with update information and action buttons
 */
export function UpdateNotification({
  version,
  releaseNotes,
  releaseDate,
  onDownload,
  onDismiss,
  onInstall,
  downloadProgress = 0,
  isDownloading = false,
  isDownloaded = false,
  error,
}: Readonly<UpdateNotificationProps>) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Format release date
  const formattedDate = new Date(releaseDate).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  // Truncate release notes for preview
  const previewLength = 150;
  const notesPreview =
    releaseNotes.length > previewLength
      ? `${releaseNotes.substring(0, previewLength)}...`
      : releaseNotes;

  return (
    <motion.div
      initial={{ opacity: 0, y: 50, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 50, scale: 0.9 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
    >
      <Card className="border-border bg-card w-full max-w-md shadow-lg dark:shadow-xl">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <RefreshCw className="text-primary h-5 w-5" />
              <CardTitle className="text-lg">Update Available</CardTitle>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={onDismiss}
              className="h-6 w-6"
              aria-label="Dismiss notification"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <CardDescription className="flex items-center gap-2 pt-1">
            <Badge variant="secondary" className="font-mono">
              v{version}
            </Badge>
            <span className="text-muted-foreground text-xs">
              {formattedDate}
            </span>
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Error Alert */}
          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Release Notes */}
          <div className="space-y-2">
            <div className="text-muted-foreground text-sm">
              {isExpanded ? releaseNotes : notesPreview}
            </div>
            {releaseNotes.length > previewLength && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsExpanded(!isExpanded)}
                className="text-primary h-auto p-0 text-xs hover:underline"
              >
                {isExpanded ? (
                  <>
                    <ChevronUp className="mr-1 h-3 w-3" />
                    Show less
                  </>
                ) : (
                  <>
                    <ChevronDown className="mr-1 h-3 w-3" />
                    Show more
                  </>
                )}
              </Button>
            )}
          </div>

          {/* Download Progress */}
          {isDownloading && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Downloading...</span>
                <span className="font-medium">
                  {Math.round(downloadProgress)}%
                </span>
              </div>
              <Progress value={downloadProgress} className="h-2" />
            </div>
          )}

          {/* Downloaded Status */}
          {isDownloaded && !isDownloading && (
            <div className="flex items-center gap-2 rounded-md bg-green-500/10 p-3 text-sm text-green-600 dark:text-green-400">
              <CheckCircle2 className="h-4 w-4" />
              <span>Update downloaded successfully</span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2 pt-2">
            {!isDownloading && !isDownloaded && (
              <>
                <Button
                  onClick={onDownload}
                  className="flex-1"
                  size="sm"
                  disabled={!!error}
                >
                  <Download className="mr-2 h-4 w-4" />
                  Download Update
                </Button>
                <Button onClick={onDismiss} variant="outline" size="sm">
                  Later
                </Button>
              </>
            )}

            {isDownloaded && (
              <>
                <Button onClick={onInstall} className="flex-1" size="sm">
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Install & Restart
                </Button>
                <Button onClick={onDismiss} variant="outline" size="sm">
                  Later
                </Button>
              </>
            )}

            {isDownloading && (
              <Button
                onClick={onDismiss}
                variant="outline"
                size="sm"
                className="w-full"
              >
                Minimize
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
