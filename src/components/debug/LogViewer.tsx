/**
 * @packageDocumentation
 * @module LogViewer
 * @description Debug panel for inspecting and exporting captured log messages.
 */

import React, { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useDebug } from "../../contexts/DebugContext";
import {
  type LogEntry,
  type LogLevel,
  serialiseLogEntries,
} from "../../utils/logging";
import { cn } from "@/utils/tailwind";
import { ScrollArea } from "../ui/scroll-area";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Switch } from "../ui/switch";
import { Separator } from "../ui/separator";
import {
  AlertCircle,
  AlertTriangle,
  Bug,
  Copy,
  Download,
  ScrollText,
  Search,
  Trash2,
} from "lucide-react";

const LEVELS = ["error", "warn", "log"] as const;
type VisibleLogLevel = (typeof LEVELS)[number];

const LEVEL_META: Record<
  VisibleLogLevel,
  { label: string; icon: React.ReactNode; tone: string }
> = {
  error: {
    label: "Error",
    icon: <AlertCircle className="h-4 w-4" />,
    tone: "text-red-500 dark:text-red-400",
  },
  warn: {
    label: "Warning",
    icon: <AlertTriangle className="h-4 w-4" />,
    tone: "text-amber-500 dark:text-amber-300",
  },
  log: {
    label: "Log",
    icon: <ScrollText className="h-4 w-4" />,
    tone: "text-slate-500 dark:text-slate-300",
  },
};

const DEFAULT_LEVEL_FILTER: Record<VisibleLogLevel, boolean> = {
  error: true,
  warn: true,
  log: true,
};

function highlight(text: string, query: string): React.ReactNode {
  if (!query) return text;
  const parts: React.ReactNode[] = [];
  const lower = text.toLowerCase();
  const target = query.toLowerCase();
  let start = 0;
  let index = lower.indexOf(target, start);
  let key = 0;

  while (index !== -1) {
    if (index > start) {
      parts.push(sliceText(text, start, index));
    }
    const matched = sliceText(text, index, index + target.length);
    parts.push(
      <mark
        key={`match-${key}`}
        className="rounded bg-yellow-200/80 px-1 text-yellow-900 dark:bg-yellow-500/30 dark:text-yellow-100"
      >
        {matched}
      </mark>,
    );
    key += 1;
    start = index + target.length;
    index = lower.indexOf(target, start);
  }

  if (start < text.length) {
    parts.push(sliceText(text, start, text.length));
  }

  return parts.length ? <>{parts}</> : text;
}

function sliceText(value: string, start: number, end: number) {
  return value.slice(start, end);
}

function formatTimestamp(timestamp: string): { date: string; time: string } {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return { date: "", time: timestamp };
  }
  return {
    date: date.toLocaleDateString(),
    time: date.toLocaleTimeString([], { hour12: false }),
  };
}

function toVisibleLevel(level: LogLevel): VisibleLogLevel | null {
  return LEVELS.includes(level as VisibleLogLevel)
    ? (level as VisibleLogLevel)
    : null;
}

function matchesEntry(
  entry: LogEntry,
  filters: Record<VisibleLogLevel, boolean>,
): boolean {
  const visibleLevel = toVisibleLevel(entry.level) ?? "log";
  return Boolean(filters[visibleLevel]);
}

function includesQuery(entry: LogEntry, query: string): boolean {
  if (!query) return true;
  const target = query.toLowerCase();
  return (
    entry.message.toLowerCase().includes(target) ||
    entry.details.some((detail) => detail.toLowerCase().includes(target)) ||
    (entry.source?.toLowerCase().includes(target) ?? false)
  );
}

export function LogViewer(): React.ReactElement {
  const { logEntries, clearLogs, exportLogs, maxLogEntries } = useDebug();
  const [searchTerm, setSearchTerm] = useState("");
  const [levelFilters, setLevelFilters] = useState(DEFAULT_LEVEL_FILTER);
  const [autoScroll, setAutoScroll] = useState(true);
  const scrollRootRef = useRef<HTMLDivElement | null>(null);

  const filteredEntries = useMemo(() => {
    return logEntries.filter(
      (entry) =>
        matchesEntry(entry, levelFilters) && includesQuery(entry, searchTerm),
    );
  }, [logEntries, levelFilters, searchTerm]);

  useEffect(() => {
    if (!autoScroll) return;
    const viewport = scrollRootRef.current?.querySelector<HTMLDivElement>(
      '[data-slot="scroll-area-viewport"]',
    );
    if (viewport) {
      viewport.scrollTop = viewport.scrollHeight;
    }
  }, [filteredEntries, autoScroll]);

  const toggleLevel = (level: VisibleLogLevel) => {
    setLevelFilters((prev) => ({
      ...prev,
      [level]: !prev[level],
    }));
  };

  const totalEntries = logEntries.length;

  const handleClear = () => {
    if (!totalEntries) return;
    clearLogs();
    toast.success("Captured logs cleared");
  };

  const handleExport = () => {
    if (!totalEntries) return;
    exportLogs();
    toast.success("Debug logs exported");
  };

  const handleCopyEntry = async (entry: LogEntry) => {
    try {
      const [serialised] = serialiseLogEntries([entry]);
      await navigator.clipboard.writeText(JSON.stringify(serialised, null, 2));
      toast.success("Log entry copied to clipboard");
    } catch (error) {
      toast.error("Unable to copy log entry");
      console.error("Failed to copy log entry", error);
    }
  };

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex flex-col gap-4 lg:items-center lg:justify-between">
        <div className="space-y-2 lg:max-w-3xl">
          <h2 className="text-lg font-semibold">Console log viewer</h2>
          <p className="text-muted-foreground text-sm">
            Inspect captured logs when developer tools are unavailable. The most
            recent {maxLogEntries} entries are retained.
          </p>
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <Badge variant="outline" className="border-border/60 bg-muted/40">
              {filteredEntries.length} showing
            </Badge>
            <Badge variant="outline" className="border-border/60 bg-muted/40">
              {totalEntries} captured
            </Badge>
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
          <div className="text-muted-foreground flex items-center gap-2">
            <Switch
              id="debug-log-autoscroll"
              checked={autoScroll}
              onCheckedChange={(checked) => setAutoScroll(Boolean(checked))}
            />
            <label htmlFor="debug-log-autoscroll" className="cursor-pointer">
              Auto-scroll to newest
            </label>
          </div>
          <div className="relative w-full sm:w-72">
            <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
            <Input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search message, details, or source"
              className="pl-9"
            />
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={handleClear}
              disabled={!totalEntries}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Clear
            </Button>
            <Button
              variant="default"
              onClick={handleExport}
              disabled={!totalEntries}
            >
              <Download className="mr-2 h-4 w-4" />
              Export JSON
            </Button>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {LEVELS.map((level) => {
          const active = levelFilters[level];
          const meta = LEVEL_META[level];
          return (
            <Button
              key={level}
              type="button"
              variant={active ? "default" : "outline"}
              className={cn(
                "flex items-center gap-2 rounded-full px-3 py-1 text-xs",
                !active && "bg-transparent",
              )}
              onClick={() => toggleLevel(level)}
            >
              <span className={cn(meta.tone, "flex items-center gap-1")}>
                {meta.icon}
              </span>
              {meta.label}
            </Button>
          );
        })}
      </div>

      <Separator />

      <div ref={scrollRootRef} className="flex h-full min-h-0 flex-1">
        <ScrollArea className="h-full w-full">
          <div className="space-y-3 pr-2">
            {filteredEntries.length === 0 ? (
              <div className="border-border/60 bg-muted/40 flex h-40 flex-col items-center justify-center gap-3 rounded-xl border border-dashed text-center">
                <Bug className="text-muted-foreground h-6 w-6" />
                <div className="space-y-1">
                  <p className="font-medium">No log entries to display</p>
                  <p className="text-muted-foreground text-sm">
                    Adjust your filters or wait for new logs to be captured.
                  </p>
                </div>
              </div>
            ) : (
              filteredEntries.map((entry) => {
                const visibleLevel = toVisibleLevel(entry.level) ?? "log";
                const meta = LEVEL_META[visibleLevel];
                const { time } = formatTimestamp(entry.timestamp);
                const hasDetails = entry.details.length > 0;

                return (
                  <div
                    key={entry.id}
                    className="border-border/60 bg-background/90 hover:border-primary/30 rounded-lg border p-3 shadow-sm transition"
                  >
                    <div className="flex flex-col gap-3 md:grid md:grid-cols-[auto,1fr,auto] md:items-start md:gap-4">
                      <div className="text-muted-foreground flex items-start gap-2 text-xs">
                        <Badge
                          variant="outline"
                          className={cn(
                            "bg-muted/60 border-transparent font-semibold",
                            meta.tone,
                          )}
                        >
                          <span className="flex items-center gap-1">
                            {meta.icon}
                            {meta.label}
                          </span>
                        </Badge>
                        <div className="flex flex-col gap-1 leading-tight">
                          <div className="flex flex-col">
                            <div className="text-foreground flex items-center gap-2 font-medium">
                              <span>{time}</span>
                              {entry.isDebug && (
                                <span className="text-purple-500 dark:text-purple-300">
                                  Debug flagged
                                </span>
                              )}
                            </div>

                            {entry.source && (
                              <TruncatedSource
                                source={entry.source}
                                query={searchTerm}
                              />
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between font-mono text-[13px] leading-relaxed break-words whitespace-pre-wrap">
                          {highlight(
                            entry.message || "(no message)",
                            searchTerm,
                          )}
                          <div className="text-muted-foreground flex items-center justify-end gap-2 text-xs">
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => handleCopyEntry(entry)}
                              title="Copy entry JSON"
                              className="h-6 w-6"
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>

                        {hasDetails && (
                          <details className="border-border/60 bg-muted/30 text-muted-foreground rounded-md border border-dashed p-2 text-xs">
                            <summary className="text-foreground cursor-pointer select-none">
                              View additional details ({entry.details.length})
                            </summary>
                            <div className="mt-2 space-y-2">
                              {entry.details.map((detail, index) => (
                                <pre
                                  key={`${entry.id}-detail-${index}`}
                                  className="bg-background/80 rounded p-2 text-[11px] break-words whitespace-pre-wrap"
                                >
                                  {highlight(detail, searchTerm)}
                                </pre>
                              ))}
                            </div>
                          </details>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}

function TruncatedSource({
  source,
  query,
}: {
  source: string;
  query: string;
}): React.ReactElement {
  const [expanded, setExpanded] = useState(false);
  const maxChars = 80;
  const needsTruncate = source.length > maxChars;
  const display =
    needsTruncate && !expanded ? `${source.slice(0, maxChars)}` : source;

  return (
    <div className="text-muted-foreground mt-1 flex items-center gap-2 text-xs">
      <div className="max-w-full break-words">
        {highlight(display, query)}
        {needsTruncate && !expanded && (
          <span className="text-muted-foreground">…</span>
        )}
      </div>
      {needsTruncate && (
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setExpanded((s) => !s)}
          className="h-6"
        >
          {expanded ? "Collapse" : "Expand"}
        </Button>
      )}
    </div>
  );
}
