/**
 * @packageDocumentation
 * @module DebugToolsSection
 * @description Debug tools section for the Data tab.
 */

import React from "react";
import { motion } from "framer-motion";
import { AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { highlightText } from "@/utils/textHighlight";
import { cn } from "@/utils/tailwind";

/**
 * Props for DebugToolsSection component.
 * @source
 */
interface DebugToolsSectionProps {
  /** Whether debug mode is enabled. */
  isDebugEnabled: boolean;
  /** Whether storage debugger is enabled. */
  storageDebuggerEnabled: boolean;
  /** Whether log viewer is enabled. */
  logViewerEnabled: boolean;
  /** Whether log redaction is enabled. */
  logRedactionEnabled: boolean;
  /** Whether state inspector is enabled. */
  stateInspectorEnabled: boolean;
  /** Whether IPC viewer is enabled. */
  ipcViewerEnabled: boolean;
  /** Whether event logger is enabled. */
  eventLoggerEnabled: boolean;
  /** Whether confidence test exporter is enabled. */
  confidenceTestExporterEnabled: boolean;
  /** Whether performance monitor is enabled. */
  performanceMonitorEnabled: boolean;
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
  storageDebuggerEnabled,
  logViewerEnabled,
  logRedactionEnabled,
  stateInspectorEnabled,
  ipcViewerEnabled,
  eventLoggerEnabled,
  confidenceTestExporterEnabled,
  performanceMonitorEnabled,
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
        "bg-muted/40 space-y-4 rounded-xl border p-4",
        highlightedSectionId === "data-debug" &&
          "ring-2 ring-blue-500 ring-offset-2 ring-offset-white dark:ring-blue-400 dark:ring-offset-slate-950",
      )}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2, duration: 0.4 }}
    >
      {/* Confidence Test Exporter - Always Visible */}
      <div className="border-border/60 bg-background/40 rounded-2xl border border-dashed p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-semibold">
                {renderHighlightedText("Confidence test exporter", searchQuery)}
              </h4>
              <Badge className="bg-orange-100 text-xs text-orange-700 dark:bg-orange-900/30 dark:text-orange-300">
                Debug Tool
              </Badge>
            </div>
            <p className="text-muted-foreground text-xs">
              {renderHighlightedText(
                "Add export buttons on match cards to debug confidence calculations and scoring. This tool is always available and doesn't require the debug menu to be enabled.",
                searchQuery,
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground text-xs">
              {renderHighlightedText("Enable", searchQuery)}
            </span>
            <Switch
              id="confidence-test-exporter-enabled"
              checked={confidenceTestExporterEnabled}
              onCheckedChange={(checked) =>
                onConfidenceTestExporterChange(Boolean(checked))
              }
            />
          </div>
        </div>
        <p className="text-muted-foreground mt-3 text-xs">
          {renderHighlightedText(
            "When enabled, debug buttons appear next to confidence scores on match cards. Generate and copy test commands for troubleshooting.",
            searchQuery,
          )}
        </p>
      </div>

      {/* Debug Menu Toggle */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-0.5">
          <h3 className="text-sm font-medium">
            {renderHighlightedText("Debug menu", searchQuery)}
          </h3>
          <p className="text-muted-foreground text-xs">
            {renderHighlightedText(
              "Enable the in-app debug hub to access advanced diagnostics, logs, and debugging tools.",
              searchQuery,
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm" htmlFor="debug-enabled">
            Enable debug menu
          </label>
          <Switch
            id="debug-enabled"
            checked={isDebugEnabled}
            onCheckedChange={onToggleDebug}
          />
        </div>
      </div>

      {/* Other Debug Tools (when debug menu is enabled) */}
      {isDebugEnabled ? (
        <div className="space-y-4">
          <div className="rounded-md bg-yellow-50 p-3 dark:bg-yellow-900/20">
            <div className="flex gap-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 text-yellow-400" />
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                <strong>Heads up:</strong> Debug tools expose persistent data
                and captured logs that may include sensitive information. Enable
                them only on trusted devices and disable when finished
                troubleshooting.
              </p>
            </div>
          </div>
          {(() => {
            type ToolConfig = {
              id: string;
              title: string;
              description: string;
              checked: boolean;
              onChange: (value: boolean) => void;
              label?: string;
              extra?: React.ReactNode;
              footer?: string;
            };

            const tools: ToolConfig[] = [
              {
                id: "log-viewer-enabled",
                title: "Log viewer",
                description:
                  "Inspect and filter captured console logs by severity. Export logger output for support.",
                checked: logViewerEnabled,
                onChange: (v) => onLogViewerChange(Boolean(v)),
                label: "Enable panel",
                extra: (
                  <div className="bg-muted/30 mt-3 flex flex-col gap-3 rounded-lg p-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="space-y-0.5">
                      <p className="text-sm font-medium">
                        {renderHighlightedText(
                          "Redact sensitive data",
                          searchQuery,
                        )}
                      </p>
                      <p className="text-muted-foreground text-xs">
                        {renderHighlightedText(
                          "Automatically redact and sanitize tokens, API keys, and credentials in logs.",
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
                        checked={logRedactionEnabled}
                        onCheckedChange={(checked) =>
                          onLogRedactionChange(Boolean(checked))
                        }
                        disabled={!logViewerEnabled}
                      />
                    </div>
                  </div>
                ),
                footer:
                  "Logs can contain access tokens or other personally-identifiable information. Review before exporting or sharing.",
              },
              {
                id: "storage-debugger-enabled",
                title: "Storage debugger",
                description:
                  "Inspect, debug, and edit Electron Store and localStorage data from the command center.",
                checked: storageDebuggerEnabled,
                onChange: (v) => onStorageDebuggerChange(Boolean(v)),
                label: "Enable panel",
              },
              {
                id: "state-inspector-enabled",
                title: "State inspector",
                description:
                  "Inspect and edit live application state: auth, sync state, and settings. Export and simulate scenarios.",
                checked: stateInspectorEnabled,
                onChange: (v) => onStateInspectorChange(Boolean(v)),
                label: "Enable panel",
                footer:
                  "Edited state updates immediately in the app. Export snapshots before testing and use them to reset state.",
              },
              {
                id: "event-logger-enabled",
                title: "Event logger",
                description:
                  "Record and review user actions, events, and system timeline. Filter by event type and time window.",
                checked: eventLoggerEnabled,
                onChange: (v) => onEventLoggerChange(Boolean(v)),
                label: "Enable panel",
                footer:
                  "Event recording is active when debug mode is on. Disable to stop tracking events and clear recorded history.",
              },
              {
                id: "ipc-viewer-enabled",
                title: "IPC traffic monitor",
                description:
                  "Record and capture inter-process communication (IPC) messages between renderer and main process.",
                checked: ipcViewerEnabled,
                onChange: (v) => onIpcViewerChange(Boolean(v)),
                label: "Enable panel",
                footer:
                  "Disable to prevent recording IPC traffic and reduce debug data collection. Enable only for troubleshooting.",
              },
              {
                id: "performance-monitor-enabled",
                title: "Performance monitor",
                description:
                  "Real-time monitoring of API latency, cache hit rates, matching speed, and memory usage with interactive charts.",
                checked: performanceMonitorEnabled,
                onChange: (v) => onPerformanceMonitorChange(Boolean(v)),
                label: "Enable panel",
                footer:
                  "When enabled, a dedicated Performance Monitor panel appears in the debug center showing live performance metrics and trends.",
              },
            ];

            return tools.map((t) => (
              <div
                key={t.id}
                className="border-border/60 bg-background/40 rounded-2xl border border-dashed p-4"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-semibold">
                        {renderHighlightedText(t.title, searchQuery)}
                      </h4>
                    </div>
                    <p className="text-muted-foreground text-xs">
                      {renderHighlightedText(t.description, searchQuery)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground text-xs">
                      {renderHighlightedText(
                        t.label ?? "Enable panel",
                        searchQuery,
                      )}
                    </span>
                    <Switch
                      id={t.id}
                      checked={t.checked}
                      onCheckedChange={(checked) =>
                        t.onChange(Boolean(checked))
                      }
                    />
                  </div>
                </div>
                {t.extra}
                {t.footer ? (
                  <p className="text-muted-foreground mt-3 text-xs">
                    {renderHighlightedText(t.footer, searchQuery)}
                  </p>
                ) : null}
              </div>
            ));
          })()}
        </div>
      ) : (
        <p className="text-muted-foreground text-xs">
          Turn on the debug menu to manage individual tools.
        </p>
      )}
    </motion.div>
  );
}
