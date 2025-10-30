/**
 * @packageDocumentation
 * @module IpcViewer
 * @description Debug panel for inspecting IPC traffic between renderer and main processes.
 */

import React, { useMemo, useState, useCallback, useEffect } from "react";
import { toast } from "sonner";
import { useDebugActions, useDebugState } from "../../contexts/DebugContext";
import { ScrollArea } from "../ui/scroll-area";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Separator } from "../ui/separator";
import { cn } from "@/utils/tailwind";
import { Copy, Search, Trash2, Filter } from "lucide-react";
import { sanitizeForDebug } from "@/utils/debugSanitizer";
import type { IpcLogEntry } from "@/types/debug";

/** Direction options for IPC message filtering. @source */
const DIRECTIONS = ["sent", "received"] as const;

/** Direction filter type derived from DIRECTIONS array. @source */
type DirectionFilter = (typeof DIRECTIONS)[number];

/**
 * Metadata mapping for IPC message directions with styling.
 * @source
 */
const DIRECTION_META: Record<DirectionFilter, { label: string; tone: string }> =
  {
    // Only include text color (no background) so the button text highlights by color only
    sent: { label: "Sent", tone: "text-sky-500" },
    received: { label: "Received", tone: "text-emerald-500" },
  };

/**
 * Metadata mapping for IPC request/response status codes.
 * @source
 */
const STATUS_META: Record<
  NonNullable<IpcLogEntry["status"]>,
  { label: string; tone: string }
> = {
  pending: { label: "Pending", tone: "bg-amber-500/10 text-amber-500" },
  fulfilled: { label: "Fulfilled", tone: "bg-emerald-500/10 text-emerald-500" },
  rejected: { label: "Rejected", tone: "bg-red-500/10 text-red-500" },
};

/**
 * Metadata mapping for IPC transport mechanisms (invoke, send, event, etc).
 * @source
 */
const TRANSPORT_META: Record<IpcLogEntry["transport"], { label: string }> = {
  invoke: { label: "Invoke" },
  "invoke-response": { label: "Invoke response" },
  send: { label: "Send" },
  event: { label: "Event" },
  message: { label: "Message" },
};

/**
 * Default direction filter state (both sent and received visible).
 * @source
 */
const DEFAULT_DIRECTION_FILTER: Record<DirectionFilter, boolean> = {
  sent: true,
  received: true,
};

/**
 * Maximum characters to display inline before payload preview is truncated.
 * @source
 */
const PREVIEW_MAX_CHARS = 2000;

/**
 * Formats an ISO timestamp to locale date and time string.
 * @param timestamp - ISO 8601 timestamp string
 * @returns Formatted locale date and time, or original string if invalid
 * @source
 */
function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return timestamp;
  }
  return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour12: false })}`;
}

/**
 * Formats duration in milliseconds as a human-readable string.
 * @param duration - Duration in milliseconds
 * @returns Formatted duration string with "ms" suffix, or null if invalid
 * @source
 */
function formatDuration(duration?: number): string | null {
  if (typeof duration !== "number") return null;
  return `${duration.toFixed(2)} ms`;
}

/**
 * Highlights matching text segments in a string with styled marks.
 * Case-insensitive search with yellow background highlighting.
 * @param text - Text to search within
 * @param query - Search query string
 * @returns JSX with highlighted segments or original text
 * @source
 */
function highlight(text: string, query: string): React.ReactNode {
  if (!query) return text;
  const lower = text.toLowerCase();
  const target = query.toLowerCase();
  const parts: React.ReactNode[] = [];
  let cursor = 0;
  let index = lower.indexOf(target);
  let key = 0;

  while (index !== -1) {
    if (index > cursor) {
      parts.push(text.slice(cursor, index));
    }
    const segment = text.slice(index, index + target.length);
    parts.push(
      <mark
        key={`match-${key}`}
        className="rounded bg-yellow-200/80 px-1 text-yellow-900 dark:bg-yellow-500/30 dark:text-yellow-100"
      >
        {segment}
      </mark>,
    );
    key += 1;
    cursor = index + target.length;
    index = lower.indexOf(target, cursor);
  }

  if (cursor < text.length) {
    parts.push(text.slice(cursor));
  }

  return parts.length ? <>{parts}</> : text;
}

/**
 * Formats a payload value as a readable string.
 * Handles primitives, objects, errors, and unserializable values.
 * Optionally redacts sensitive data.
 * @param value - The payload value to format
 * @param redact - Whether to redact sensitive data
 * @returns Formatted string representation
 * @source
 */
function formatPayload(value: unknown, redact: boolean = false): string {
  const processed = redact
    ? sanitizeForDebug(value, { redactSensitive: true })
    : value;

  if (processed === undefined) return "undefined";
  if (processed === null) return "null";
  if (typeof processed === "string") return processed;
  if (
    typeof processed === "number" ||
    typeof processed === "boolean" ||
    typeof processed === "bigint"
  ) {
    return String(processed);
  }
  if (processed instanceof Error) {
    return `${processed.name}: ${processed.message}`;
  }
  try {
    return JSON.stringify(processed, null, 2);
  } catch (error) {
    const asString = Object.prototype.toString.call(processed);
    if (error) {
      return `${asString} (unserialisable)`;
    }
    return asString;
  }
}

/**
 * Checks if an IPC log entry matches a search query across multiple fields.
 * Searches payload preview, channel, transport, status, error, and correlation ID.
 * @param entry - IPC log entry
 * @param query - Search query string (case-insensitive)
 * @returns True if entry matches query in any searchable field
 * @source
 */
function includesQuery(entry: IpcLogEntry, query: string): boolean {
  if (!query) return true;
  const target = query.toLowerCase();
  const preview = entry.payload.preview?.toLowerCase() ?? "";
  const channel = entry.channel.toLowerCase();
  const transport =
    TRANSPORT_META[entry.transport]?.label.toLowerCase() ?? entry.transport;
  const status = entry.status
    ? STATUS_META[entry.status].label.toLowerCase()
    : "";
  const error = entry.error?.toLowerCase() ?? "";
  const correlation = entry.correlationId?.toLowerCase() ?? "";
  return (
    preview.includes(target) ||
    channel.includes(target) ||
    transport.includes(target) ||
    status.includes(target) ||
    error.includes(target) ||
    correlation.includes(target)
  );
}

/**
 * Checks if an IPC log entry matches the active direction filters.
 * @param entry - IPC log entry
 * @param filters - Direction filter state (sent/received)
 * @returns True if entry direction is enabled in filters
 * @source
 */
function matchesDirection(
  entry: IpcLogEntry,
  filters: Record<DirectionFilter, boolean>,
): boolean {
  return filters[entry.direction as DirectionFilter];
}

/**
 * Checks if an IPC log entry matches the channel filter (case-insensitive).
 * @param entry - IPC log entry
 * @param channelFilter - Channel name to filter by
 * @returns True if entry matches channel or no channel filter is active
 * @source
 */
function matchesChannel(entry: IpcLogEntry, channelFilter: string): boolean {
  if (!channelFilter) return true;
  return entry.channel.toLowerCase().includes(channelFilter.toLowerCase());
}

/**
 * IPC traffic viewer for monitoring renderer ↔ main process messages.
 * Displays, filters, and inspects IPC logs with direction, channel, and search filters.
 * @returns JSX element rendering the IPC viewer panel
 * @source
 */
export function IpcViewer(): React.ReactElement {
  const { ipcEvents, maxIpcEntries, logRedactionEnabled } = useDebugState();
  const { clearIpcEvents } = useDebugActions();

  const [searchTerm, setSearchTerm] = useState("");
  const [channelFilter, setChannelFilter] = useState("");
  const [directionFilters, setDirectionFilters] = useState<
    Record<DirectionFilter, boolean>
  >(DEFAULT_DIRECTION_FILTER);
  const DEFAULT_WINDOW = 100;
  const [visibleCount, setVisibleCount] = useState<number>(DEFAULT_WINDOW);

  // Listen for custom events from PerformanceMonitor to set filter
  useEffect(() => {
    const handleSetFilter = (event: CustomEvent) => {
      const detail = event.detail as { channel?: string } | undefined;
      if (detail?.channel) {
        setChannelFilter(detail.channel);
        setVisibleCount(DEFAULT_WINDOW);
      }
    };

    globalThis.addEventListener(
      "debug:ipc:set-filter" as unknown as string,
      handleSetFilter as EventListener,
    );

    return () => {
      globalThis.removeEventListener(
        "debug:ipc:set-filter" as unknown as string,
        handleSetFilter as EventListener,
      );
    };
  }, []);

  const filteredEntries = useMemo(() => {
    return ipcEvents.filter(
      (entry) =>
        matchesDirection(entry, directionFilters) &&
        matchesChannel(entry, channelFilter) &&
        includesQuery(entry, searchTerm),
    );
  }, [ipcEvents, directionFilters, channelFilter, searchTerm]);

  const availableChannels = useMemo(() => {
    const set = new Set<string>();
    for (const entry of ipcEvents) {
      set.add(entry.channel);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [ipcEvents]);

  const totalEntries = ipcEvents.length;

  const toggleDirection = (direction: DirectionFilter) => {
    setDirectionFilters((prev) => ({
      ...prev,
      [direction]: !prev[direction],
    }));
  };

  const handleClear = () => {
    if (!totalEntries) return;
    clearIpcEvents();
    toast.success("IPC log cleared");
  };

  const handleCopy = async (entry: IpcLogEntry) => {
    try {
      const sanitized = logRedactionEnabled
        ? sanitizeForDebug(entry, { redactSensitive: true })
        : entry;
      await navigator.clipboard.writeText(JSON.stringify(sanitized, null, 2));
      toast.success("Entry copied to clipboard");
    } catch (error) {
      toast.error("Unable to copy entry");
      console.error("Failed to copy IPC log entry", error);
    }
  };

  const onCopy = useCallback((entry: IpcLogEntry) => {
    void handleCopy(entry);
  }, []);

  const reversedFiltered = useMemo(() => {
    // show newest entries first
    return [...filteredEntries].reverse();
  }, [filteredEntries]);

  const visibleEntries = useMemo(() => {
    return reversedFiltered.slice(0, visibleCount);
  }, [reversedFiltered, visibleCount]);

  const loadMore = () => setVisibleCount((v) => v + DEFAULT_WINDOW);
  const showAll = () => setVisibleCount(reversedFiltered.length || 0);
  const resetWindow = () => setVisibleCount(DEFAULT_WINDOW);

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2 lg:max-w-2xl">
          <h2 className="text-lg font-semibold">IPC traffic monitor</h2>
          <p className="text-muted-foreground text-sm">
            Observe renderer and main process interactions. Use filters to
            narrow down channels or payload content. The most recent{" "}
            {maxIpcEntries} entries are retained.
          </p>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <Badge variant="outline" className="border-border/60 bg-muted/40">
              {filteredEntries.length} showing
            </Badge>
            <Badge variant="outline" className="border-border/60 bg-muted/40">
              {totalEntries} captured
            </Badge>
            <Badge variant="outline" className="border-border/60 bg-muted/40">
              {availableChannels.length} channel
              {availableChannels.length === 1 ? "" : "s"}
            </Badge>
          </div>
          <div className="mt-2 flex flex-row flex-wrap items-center gap-2">
            {DIRECTIONS.map((direction) => {
              const active = directionFilters[direction];
              return (
                <Button
                  key={direction}
                  type="button"
                  variant={active ? "default" : "outline"}
                  className="rounded-full px-3 py-1 text-xs"
                  onClick={() => toggleDirection(direction)}
                >
                  <span
                    className={cn(
                      "flex items-center gap-1",
                      DIRECTION_META[direction].tone,
                    )}
                  >
                    {DIRECTION_META[direction].label}
                  </span>
                </Button>
              );
            })}
            <Button
              variant="outline"
              onClick={handleClear}
              disabled={!totalEntries}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Clear
            </Button>
            <div className="flex min-w-[220px] max-w-xl flex-1 flex-row gap-2">
              <div className="relative min-w-0 flex-1">
                <Search className="text-muted-foreground pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
                <Input
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Search payload, channel, status"
                  className="pl-9"
                />
              </div>
              <div className="relative min-w-0 flex-1">
                <Filter className="text-muted-foreground pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
                <Input
                  value={channelFilter}
                  onChange={(event) => setChannelFilter(event.target.value)}
                  placeholder="Filter by channel"
                  className="pl-9"
                  list="debug-ipc-channels"
                />
                {availableChannels.length > 0 && (
                  <datalist id="debug-ipc-channels">
                    {availableChannels.map((channel) => (
                      <option key={channel} value={channel} />
                    ))}
                  </datalist>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <Separator />

      <ScrollArea type="always" className="h-full max-h-[35vh] w-full">
        <div className="space-y-3 pr-4">
          {filteredEntries.length === 0 ? (
            <div className="border-border/60 bg-muted/20 flex h-40 flex-col items-center justify-center gap-3 rounded-xl border border-dashed text-center">
              <p className="font-medium">No IPC entries to display</p>
              <p className="text-muted-foreground text-sm">
                Adjust filters or wait for new IPC messages to be captured.
              </p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-end gap-2">
                <div className="text-muted-foreground mr-2 text-xs">
                  Showing {Math.min(visibleCount, reversedFiltered.length)} of{" "}
                  {reversedFiltered.length}
                </div>
                {reversedFiltered.length > visibleCount && (
                  <Button size="sm" variant="outline" onClick={loadMore}>
                    Load more
                  </Button>
                )}
                {reversedFiltered.length > 0 &&
                  reversedFiltered.length !== visibleCount && (
                    <Button size="sm" variant="ghost" onClick={showAll}>
                      Show all
                    </Button>
                  )}
                {visibleCount !== DEFAULT_WINDOW && (
                  <Button size="sm" variant="outline" onClick={resetWindow}>
                    Reset
                  </Button>
                )}
              </div>

              {visibleEntries.map((entry) => (
                <IpcEntry
                  key={entry.id}
                  entry={entry}
                  onCopy={onCopy}
                  searchTerm={searchTerm}
                  logRedactionEnabled={logRedactionEnabled}
                />
              ))}
            </>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

/**
 * Props for the IPC entry component.
 * @source
 */
type IpcEntryProps = {
  entry: IpcLogEntry;
  onCopy: (entry: IpcLogEntry) => void;
  searchTerm: string;
  logRedactionEnabled: boolean;
};

/**
 * IPC log entry card with expandable payload details.
 * Displays direction, channel, transport, status, and formatted payload.
 * Handles long payloads with truncation and preview highlighting.
 * @source
 */
const IpcEntry = React.memo(function IpcEntry({
  entry,
  onCopy,
  searchTerm,
  logRedactionEnabled,
}: IpcEntryProps) {
  const directionMeta = DIRECTION_META[entry.direction as DirectionFilter];
  const transportMeta = TRANSPORT_META[entry.transport];
  const statusMeta = entry.status ? STATUS_META[entry.status] : null;
  const durationLabel = formatDuration(entry.durationMs);
  const [expanded, setExpanded] = useState(false);
  const [showJsonViewer, setShowJsonViewer] = useState(false);
  const payloadRaw = entry.payload?.raw;

  // Detect invoke calls that send no payload (common pattern: invoke with empty array)
  const isInvokeWithNoPayload =
    entry.direction === "sent" &&
    entry.transport === "invoke" &&
    (payloadRaw === undefined ||
      (Array.isArray(payloadRaw) && payloadRaw.length === 0) ||
      (typeof payloadRaw === "object" &&
        payloadRaw !== null &&
        Object.keys(payloadRaw).length === 0));

  // Check if payload parses as valid JSON
  const canShowJsonViewer = useMemo(() => {
    if (isInvokeWithNoPayload) return false;
    if (!payloadRaw) return false;
    try {
      if (typeof payloadRaw === "string") {
        JSON.parse(payloadRaw);
        return true;
      }
      JSON.stringify(payloadRaw);
      return true;
    } catch {
      return false;
    }
  }, [payloadRaw, isInvokeWithNoPayload]);

  // For received messages, null is a valid response value (e.g., store:getItem when key doesn't exist)
  const raw = entry.payload
    ? formatPayload(payloadRaw, logRedactionEnabled)
    : "(no payload)";
  const isTooLong = raw.length > PREVIEW_MAX_CHARS;
  let previewText: string;
  if (isInvokeWithNoPayload) {
    previewText = "Invoked (no payload sent)";
  } else if (isTooLong && !expanded) {
    previewText = raw.slice(0, PREVIEW_MAX_CHARS) + "\n\n... (truncated)";
  } else {
    previewText = raw;
  }

  return (
    <div className="border-border/60 bg-background/95 hover:border-primary/30 w-full max-w-full overflow-hidden rounded-lg border p-4 shadow-sm transition lg:max-w-xl">
      <div className="flex min-w-0 flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <Badge
            variant="outline"
            className={cn("border-transparent", directionMeta.tone)}
          >
            {directionMeta.label}
          </Badge>
          <Badge variant="outline" className="border-border/50 bg-muted/40">
            {transportMeta?.label ?? entry.transport}
          </Badge>
          {statusMeta && (
            <Badge
              variant="outline"
              className={cn("border-transparent", statusMeta.tone)}
            >
              {statusMeta.label}
            </Badge>
          )}
          {durationLabel && (
            <Badge variant="outline" className="border-border/50 bg-muted/40">
              {durationLabel}
            </Badge>
          )}
          <Badge variant="outline" className="border-border/50 bg-muted/40">
            {formatTimestamp(entry.timestamp)}
          </Badge>
          {entry.correlationId && (
            <Badge variant="outline" className="border-border/50 bg-muted/40">
              Correlation: {entry.correlationId.slice(0, 8)}
            </Badge>
          )}
        </div>
        <div className="ml-auto flex flex-row items-center gap-2 text-xs">
          <code className="bg-muted/60 text-muted-foreground max-w-xs overflow-x-auto whitespace-nowrap rounded px-2 py-1">
            {entry.channel}
          </code>
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            onClick={() => onCopy(entry)}
            title="Copy entry JSON"
          >
            <Copy className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="mt-3 space-y-2 text-sm">
        <div className="bg-muted/10 wrap-break-word max-h-48 overflow-auto whitespace-pre-wrap rounded p-2 font-mono text-[13px] leading-relaxed">
          {highlight(previewText, searchTerm)}
        </div>
        {isTooLong && (
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setExpanded((v) => !v)}
            >
              {expanded ? "Show less" : "Show more"}
            </Button>
            <div className="text-muted-foreground text-xs">
              Payload length: {raw.length.toLocaleString()}
            </div>
          </div>
        )}
        {canShowJsonViewer && (
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowJsonViewer((v) => !v)}
            >
              {showJsonViewer ? "Hide JSON" : "View JSON"}
            </Button>
          </div>
        )}
        {showJsonViewer && canShowJsonViewer && (
          <pre className="bg-muted/20 max-h-64 overflow-auto rounded p-2 text-xs">
            {JSON.stringify(
              logRedactionEnabled
                ? sanitizeForDebug(payloadRaw, { redactSensitive: true })
                : payloadRaw,
              null,
              2,
            )}
          </pre>
        )}
        {entry.error && (
          <div className="text-xs text-red-500">Error: {entry.error}</div>
        )}
      </div>
    </div>
  );
});
