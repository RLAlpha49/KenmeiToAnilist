/**
 * @packageDocumentation
 * @module DebugToolsSection
 * @description Debug tools section for the Data tab.
 */

import React from "react";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  Bug,
  Activity,
  Database,
  FileText,
  Terminal,
  Eye,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Switch } from "@/components/ui/Switch";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/Card";
import { highlightText } from "@/utils/text-highlight";
import { cn } from "@/utils/tailwind";

/**
 * Props for DebugToolsSection component.
 * @source
 */
interface DebugToolsSectionProps {
  /** Whether debug mode is enabled. */
  isDebugEnabled: boolean;
  /** Whether storage debugger is enabled. */
  isStorageDebuggerEnabled: boolean;
  /** Whether log viewer is enabled. */
  isLogViewerEnabled: boolean;
  /** Whether log redaction is enabled. */
  isLogRedactionEnabled: boolean;
  /** Whether state inspector is enabled. */
  isStateInspectorEnabled: boolean;
  /** Whether IPC viewer is enabled. */
  isIpcViewerEnabled: boolean;
  /** Whether event logger is enabled. */
  isEventLoggerEnabled: boolean;
  /** Whether confidence test exporter is enabled. */
  isConfidenceTestExporterEnabled: boolean;
  /** Whether performance monitor is enabled. */
  isPerformanceMonitorEnabled: boolean;
  /** Current search query. */
  searchQuery: string;
  /** Currently highlighted section ID. */
  highlightedSectionId: string | null;
  /** Callback to toggle debug mode. */
  onToggleDebug: () => void;
  /** Callback to toggle storage debugger. */
  onStorageDebuggerChange: (enabled: boolean) => void;
  /** Callback to toggle log viewer. */
  onLogViewerChange: (enabled: boolean) => void;
  /** Callback to toggle log redaction. */
  onLogRedactionChange: (enabled: boolean) => void;
  /** Callback to toggle state inspector. */
  onStateInspectorChange: (enabled: boolean) => void;
  /** Callback to toggle IPC viewer. */
  onIpcViewerChange: (enabled: boolean) => void;
  /** Callback to toggle event logger. */
  onEventLoggerChange: (enabled: boolean) => void;
  /** Callback to toggle confidence test exporter. */
  onConfidenceTestExporterChange: (enabled: boolean) => void;
  /** Callback to toggle performance monitor. */
  onPerformanceMonitorChange: (enabled: boolean) => void;
}

/**
 * Helper function to render text with highlighting if search query exists.
 * @param text - The text to potentially highlight.
 * @param searchQuery - The search query to highlight with.
 * @returns Highlighted text or plain text.
 * @source
 */
const renderHighlightedText = (
  text: string,
  searchQuery: string,
): React.ReactNode => {
  return searchQuery ? highlightText(text, searchQuery) : text;
};

/**
 * Debug tools section component.
 * Manages debug mode and individual debug tool toggles.
 * @param props - Component props.
 * @returns The rendered debug tools section.
 * @source
 */
export function DebugToolsSection({
  isDebugEnabled,
  isStorageDebuggerEnabled,
  isLogViewerEnabled,
  isLogRedactionEnabled,
  isStateInspectorEnabled,
  isIpcViewerEnabled,
  isEventLoggerEnabled,
  isConfidenceTestExporterEnabled,
  isPerformanceMonitorEnabled,
  searchQuery,
  highlightedSectionId,
  onToggleDebug,
  onStorageDebuggerChange,
  onLogViewerChange,
  onLogRedactionChange,
  onStateInspectorChange,
  onIpcViewerChange,
  onEventLoggerChange,
  onConfidenceTestExporterChange,
  onPerformanceMonitorChange,
}: Readonly<DebugToolsSectionProps>) {
  return (
    <motion.div
      id="data-debug"
      className={cn(
        "space-y-6",
        highlightedSectionId === "data-debug" &&
          "rounded-xl ring-2 ring-blue-500 ring-offset-2 ring-offset-white dark:ring-blue-400 dark:ring-offset-slate-950",
      )}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2, duration: 0.4 }}
    >
      {/* Confidence Test Exporter - Always Visible */}
      <Card className="border-dashed border-orange-200 bg-orange-50/30 dark:border-orange-900/50 dark:bg-orange-950/10">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2 text-base">
                {renderHighlightedText("Confidence test exporter", searchQuery)}
                <Badge
                  variant="outline"
                  className="border-orange-200 bg-orange-100 text-orange-700 dark:border-orange-800 dark:bg-orange-900/30 dark:text-orange-300"
                >
                  {renderHighlightedText("Debug Tool", searchQuery)}
                </Badge>
              </CardTitle>
              <CardDescription>
                {renderHighlightedText(
                  "Add export buttons on match cards to debug confidence calculations and scoring.",
                  searchQuery,
                )}
              </CardDescription>
            </div>
            <Switch
              id="confidence-test-exporter-enabled"
              checked={isConfidenceTestExporterEnabled}
              onCheckedChange={(checked) =>
                onConfidenceTestExporterChange(Boolean(checked))
              }
            />
          </div>
        </CardHeader>
      </Card>

      {/* Debug Menu Toggle */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2 text-base">
                <Bug className="h-4 w-4 text-slate-500" />
                {renderHighlightedText("Debug menu", searchQuery)}
              </CardTitle>
              <CardDescription>
                {renderHighlightedText(
                  "Enable the in-app debug hub to access advanced diagnostics, logs, and debugging tools.",
                  searchQuery,
                )}
              </CardDescription>
            </div>
            <Switch
              id="debug-enabled"
              checked={isDebugEnabled}
              onCheckedChange={onToggleDebug}
            />
          </div>
        </CardHeader>
      </Card>

      {/* Other Debug Tools (when debug menu is enabled) */}
      {isDebugEnabled && (
        <div className="animate-in fade-in slide-in-from-top-4 space-y-4 duration-300">
          <div className="rounded-md border border-yellow-100 bg-yellow-50 p-3 dark:border-yellow-900/30 dark:bg-yellow-900/20">
            <div className="flex gap-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 text-yellow-600 dark:text-yellow-400" />
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                <strong>Heads up:</strong> Debug tools expose persistent data
                and captured logs that may include sensitive information. Enable
                them only on trusted devices and disable when finished
                troubleshooting.
              </p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {/* Log Viewer */}
            <Card className="md:col-span-2">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <FileText className="h-4 w-4 text-slate-500" />
                      {renderHighlightedText("Log viewer", searchQuery)}
                    </CardTitle>
                    <CardDescription>
                      {renderHighlightedText(
                        "Inspect and filter captured console logs by severity. Export logger output for support.",
                        searchQuery,
                      )}
                    </CardDescription>
                  </div>
                  <Switch
                    id="log-viewer-enabled"
                    checked={isLogViewerEnabled}
                    onCheckedChange={(v) => onLogViewerChange(Boolean(v))}
                  />
                </div>
              </CardHeader>
              <CardContent className="pb-3">
                <div className="bg-muted/50 flex flex-col gap-3 rounded-lg p-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-0.5">
                    <p className="text-sm font-medium">
                      {renderHighlightedText(
                        "Redact sensitive data",
                        searchQuery,
                      )}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      {renderHighlightedText(
                        isLogViewerEnabled
                          ? "Automatically redact and sanitize tokens, API keys, and credentials in logs."
                          : "Global log redaction sanitizes stored logs and exports even when the viewer panel is closed.",
                        searchQuery,
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground text-xs">
                      {renderHighlightedText("Redact", searchQuery)}
                    </span>
                    <Switch
                      id="log-redaction-enabled"
                      checked={isLogRedactionEnabled}
                      disabled={!isLogViewerEnabled}
                      onCheckedChange={(checked) =>
                        onLogRedactionChange(Boolean(checked))
                      }
                    />
                  </div>
                </div>
              </CardContent>
              <CardFooter>
                <p className="text-muted-foreground text-xs">
                  {renderHighlightedText(
                    "Logs can contain access tokens or other personally-identifiable information. Review before exporting or sharing.",
                    searchQuery,
                  )}
                </p>
              </CardFooter>
            </Card>

            {/* Storage Debugger */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Database className="h-4 w-4 text-slate-500" />
                      {renderHighlightedText("Storage debugger", searchQuery)}
                    </CardTitle>
                    <CardDescription>
                      {renderHighlightedText(
                        "Inspect, debug, and edit Electron Store and localStorage data.",
                        searchQuery,
                      )}
                    </CardDescription>
                  </div>
                  <Switch
                    id="storage-debugger-enabled"
                    checked={isStorageDebuggerEnabled}
                    onCheckedChange={(v) => onStorageDebuggerChange(Boolean(v))}
                  />
                </div>
              </CardHeader>
            </Card>

            {/* State Inspector */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Eye className="h-4 w-4 text-slate-500" />
                      {renderHighlightedText("State inspector", searchQuery)}
                    </CardTitle>
                    <CardDescription>
                      {renderHighlightedText(
                        "Inspect and edit live application state: auth, sync state, and settings.",
                        searchQuery,
                      )}
                    </CardDescription>
                  </div>
                  <Switch
                    id="state-inspector-enabled"
                    checked={isStateInspectorEnabled}
                    onCheckedChange={(v) => onStateInspectorChange(Boolean(v))}
                  />
                </div>
              </CardHeader>
              <CardFooter>
                <p className="text-muted-foreground text-xs">
                  {renderHighlightedText(
                    "Edited state updates immediately. Export snapshots before testing.",
                    searchQuery,
                  )}
                </p>
              </CardFooter>
            </Card>

            {/* Event Logger */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Activity className="h-4 w-4 text-slate-500" />
                      {renderHighlightedText("Event logger", searchQuery)}
                    </CardTitle>
                    <CardDescription>
                      {renderHighlightedText(
                        "Record and review user actions, events, and system timeline.",
                        searchQuery,
                      )}
                    </CardDescription>
                  </div>
                  <Switch
                    id="event-logger-enabled"
                    checked={isEventLoggerEnabled}
                    onCheckedChange={(v) => onEventLoggerChange(Boolean(v))}
                  />
                </div>
              </CardHeader>
              <CardFooter>
                <p className="text-muted-foreground text-xs">
                  {renderHighlightedText(
                    "Disable to stop tracking events and clear recorded history.",
                    searchQuery,
                  )}
                </p>
              </CardFooter>
            </Card>

            {/* IPC Viewer */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Terminal className="h-4 w-4 text-slate-500" />
                      {renderHighlightedText(
                        "IPC traffic monitor",
                        searchQuery,
                      )}
                    </CardTitle>
                    <CardDescription>
                      {renderHighlightedText(
                        "Record and capture inter-process communication (IPC) messages.",
                        searchQuery,
                      )}
                    </CardDescription>
                  </div>
                  <Switch
                    id="ipc-viewer-enabled"
                    checked={isIpcViewerEnabled}
                    onCheckedChange={(v) => onIpcViewerChange(Boolean(v))}
                  />
                </div>
              </CardHeader>
              <CardFooter>
                <p className="text-muted-foreground text-xs">
                  {renderHighlightedText(
                    "Enable only for troubleshooting to reduce overhead.",
                    searchQuery,
                  )}
                </p>
              </CardFooter>
            </Card>

            {/* Performance Monitor */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Activity className="h-4 w-4 text-slate-500" />
                      {renderHighlightedText(
                        "Performance monitor",
                        searchQuery,
                      )}
                    </CardTitle>
                    <CardDescription>
                      {renderHighlightedText(
                        "Real-time monitoring of API latency, cache hit rates, and memory usage.",
                        searchQuery,
                      )}
                    </CardDescription>
                  </div>
                  <Switch
                    id="performance-monitor-enabled"
                    checked={isPerformanceMonitorEnabled}
                    onCheckedChange={(v) =>
                      onPerformanceMonitorChange(Boolean(v))
                    }
                  />
                </div>
              </CardHeader>
              <CardFooter>
                <p className="text-muted-foreground text-xs">
                  {renderHighlightedText(
                    "Shows live performance metrics and trends in a dedicated panel.",
                    searchQuery,
                  )}
                </p>
              </CardFooter>
            </Card>
          </div>
        </div>
      )}
    </motion.div>
  );
}
