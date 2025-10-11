/**
 * @packageDocumentation
 * @module IpcViewer
 * @description Debug panel for inspecting IPC traffic between renderer and main processes.
 */

import React, { useMemo, useState, useCallback } from "react";
import { toast } from "sonner";
import { useDebug } from "../../contexts/DebugContext";
import { ScrollArea } from "../ui/scroll-area";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Separator } from "../ui/separator";
import { cn } from "@/utils/tailwind";
import { Copy, Search, Trash2, Filter } from "lucide-react";
import type { IpcLogEntry } from "@/types/debug";

const DIRECTIONS = ["sent", "received"] as const;
type DirectionFilter = (typeof DIRECTIONS)[number];

const DIRECTION_META: Record<DirectionFilter, { label: string; tone: string }> =
  {
    // Only include text color (no background) so the button text highlights by color only
    sent: { label: "Sent", tone: "text-sky-500" },
    received: { label: "Received", tone: "text-emerald-500" },
  };

const STATUS_META: Record<
  NonNullable<IpcLogEntry["status"]>,
  { label: string; tone: string }
> = {
  pending: { label: "Pending", tone: "bg-amber-500/10 text-amber-500" },
  fulfilled: { label: "Fulfilled", tone: "bg-emerald-500/10 text-emerald-500" },
  rejected: { label: "Rejected", tone: "bg-red-500/10 text-red-500" },
};

const TRANSPORT_META: Record<IpcLogEntry["transport"], { label: string }> = {
  invoke: { label: "Invoke" },
  "invoke-response": { label: "Invoke response" },
  send: { label: "Send" },
  event: { label: "Event" },
  message: { label: "Message" },
};

const DEFAULT_DIRECTION_FILTER: Record<DirectionFilter, boolean> = {
  sent: true,
  received: true,
};

// Maximum characters to render inline before truncating preview
const PREVIEW_MAX_CHARS = 2000;

function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return timestamp;
  }
  return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour12: false })}`;
}

function formatDuration(duration?: number): string | null {
  if (typeof duration !== "number") return null;
  return `${duration.toFixed(2)} ms`;
}

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

function formatPayload(value: unknown): string {
  if (value === undefined) return "undefined";
  if (value === null) return "null";
  if (typeof value === "string") return value;
  if (
    typeof value === "number" ||
    typeof value === "boolean" ||
    typeof value === "bigint"
  ) {
    return String(value);
  }
  if (value instanceof Error) {
    return `${value.name}: ${value.message}`;
  }
  try {
    return JSON.stringify(value, null, 2);
  } catch (error) {
    const asString = Object.prototype.toString.call(value);
    if (error) {
      return `${asString} (unserialisable)`;
    }
    return asString;
  }
}

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

function matchesDirection(
  entry: IpcLogEntry,
  filters: Record<DirectionFilter, boolean>,
): boolean {
  return filters[entry.direction as DirectionFilter];
}

function matchesChannel(entry: IpcLogEntry, channelFilter: string): boolean {
  if (!channelFilter) return true;
  return entry.channel.toLowerCase().includes(channelFilter.toLowerCase());
}

export function IpcViewer(): React.ReactElement {
  const { ipcEvents, clearIpcEvents, maxIpcEntries } = useDebug();

  const [searchTerm, setSearchTerm] = useState("");
  const [channelFilter, setChannelFilter] = useState("");
  const [directionFilters, setDirectionFilters] = useState<
    Record<DirectionFilter, boolean>
  >(DEFAULT_DIRECTION_FILTER);
  const DEFAULT_WINDOW = 100;
  const [visibleCount, setVisibleCount] = useState<number>(DEFAULT_WINDOW);

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
      await navigator.clipboard.writeText(JSON.stringify(entry, null, 2));
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
            <div className="flex max-w-xl min-w-[220px] flex-1 flex-row gap-2">
              <div className="relative min-w-0 flex-1">
                <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
                <Input
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Search payload, channel, status"
                  className="pl-9"
                />
              </div>
              <div className="relative min-w-0 flex-1">
                <Filter className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
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

      <ScrollArea className="h-full max-h-[40vh] w-full">
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
                />
              ))}
            </>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

type IpcEntryProps = {
  entry: IpcLogEntry;
  onCopy: (entry: IpcLogEntry) => void;
  searchTerm: string;
};

const IpcEntry = React.memo(function IpcEntry({
  entry,
  onCopy,
  searchTerm,
}: IpcEntryProps) {
  const directionMeta = DIRECTION_META[entry.direction as DirectionFilter];
  const transportMeta = TRANSPORT_META[entry.transport];
  const statusMeta = entry.status ? STATUS_META[entry.status] : null;
  const durationLabel = formatDuration(entry.durationMs);
  const [expanded, setExpanded] = useState(false);
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

  // For received messages, null is a valid response value (e.g., store:getItem when key doesn't exist)
  const raw = entry.payload ? formatPayload(payloadRaw) : "(no payload)";
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
  <div className="border-border/60 bg-background/95 hover:border-primary/30 w-full max-w-full lg:max-w-xl overflow-hidden rounded-lg border p-4 shadow-sm transition">
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
          <code className="bg-muted/60 text-muted-foreground max-w-xs overflow-x-auto rounded px-2 py-1 whitespace-nowrap">
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
        <div className="bg-muted/10 max-h-48 overflow-auto rounded p-2 font-mono text-[13px] leading-relaxed break-words whitespace-pre-wrap">
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
        {entry.error && (
          <div className="text-xs text-red-500">Error: {entry.error}</div>
        )}
      </div>
    </div>
  );
});
