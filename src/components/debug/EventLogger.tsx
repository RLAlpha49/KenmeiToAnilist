/**
 * @packageDocumentation
 * @module EventLogger
 * @description Debug panel for reviewing application and user action events.
 */

import React, { useId, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  ChevronDown,
  Copy,
  Download,
  Filter,
  RefreshCw,
  Search,
  Tags,
  Trash2,
} from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Badge } from "../ui/badge";
import { ScrollArea } from "../ui/scroll-area";
import { Separator } from "../ui/separator";
import { useDebug } from "../../contexts/DebugContext";
import { cn } from "@/utils/tailwind";
import type { DebugEventEntry, DebugEventLevel } from "@/types/debug";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";

const LEVEL_META: Record<DebugEventLevel, { label: string; tone: string }> = {
  info: { label: "Info", tone: "bg-sky-500/10 text-sky-500" },
  warn: { label: "Warn", tone: "bg-amber-500/10 text-amber-500" },
  error: { label: "Error", tone: "bg-red-500/10 text-red-500" },
  success: { label: "Success", tone: "bg-emerald-500/10 text-emerald-500" },
  debug: { label: "Debug", tone: "bg-slate-500/10 text-slate-500" },
};

const DEFAULT_VISIBLE_COUNT = 100;

function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return timestamp;
  }
  return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour12: false })}`;
}

function eventMatchesType(entry: DebugEventEntry, filters: string[]) {
  if (!filters.length) return true;
  return filters.includes(entry.type);
}

function eventMatchesSearch(entry: DebugEventEntry, query: string) {
  if (!query) return true;
  const target = query.toLowerCase();
  const haystacks: string[] = [
    entry.message,
    entry.type,
    entry.source ?? "",
    entry.context ?? "",
    entry.tags?.join(" ") ?? "",
  ];

  if (entry.metadata) {
    try {
      haystacks.push(JSON.stringify(entry.metadata).toLowerCase());
    } catch (error) {
      console.error("Failed to serialise metadata for search", error);
    }
  }

  return haystacks.some((segment) => segment.toLowerCase().includes(target));
}

export function EventLogger(): React.ReactElement {
  const { eventLogEntries, clearEventLog, maxEventLogEntries, recordEvent } =
    useDebug();
  const [activeTypes, setActiveTypes] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [visibleCount, setVisibleCount] = useState(DEFAULT_VISIBLE_COUNT);
  const searchInputId = useId();

  const availableTypes = useMemo(() => {
    const unique = new Set<string>();
    for (const entry of eventLogEntries) {
      unique.add(entry.type);
    }
    return Array.from(unique).sort((a, b) => a.localeCompare(b));
  }, [eventLogEntries]);

  const filteredEvents = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return eventLogEntries.filter(
      (entry) =>
        eventMatchesType(entry, activeTypes) &&
        eventMatchesSearch(entry, query),
    );
  }, [activeTypes, eventLogEntries, searchTerm]);

  const sortedEvents = useMemo(() => {
    return [...filteredEvents].sort((a, b) => {
      const aTime = Date.parse(a.timestamp);
      const bTime = Date.parse(b.timestamp);

      const aValid = !Number.isNaN(aTime);
      const bValid = !Number.isNaN(bTime);

      if (aValid && bValid) {
        return bTime - aTime;
      }

      if (aValid) return -1;
      if (bValid) return 1;

      return b.timestamp.localeCompare(a.timestamp);
    });
  }, [filteredEvents]);

  const visibleEvents = useMemo(() => {
    return sortedEvents.slice(0, visibleCount);
  }, [sortedEvents, visibleCount]);

  const handleClear = () => {
    if (!eventLogEntries.length) {
      toast.info("Event log already empty");
      return;
    }
    clearEventLog();
    setVisibleCount(DEFAULT_VISIBLE_COUNT);
    toast.success("Event log cleared");
    recordEvent({
      type: "debug.event-logger",
      message: "Event log cleared",
      level: "warn",
    });
  };

  const handleExport = () => {
    if (!filteredEvents.length) {
      toast.info("Nothing to export for current filters");
      return;
    }

    try {
      const payload = {
        exportedAt: new Date().toISOString(),
        totalEntries: filteredEvents.length,
        filters: {
          types: activeTypes.length ? activeTypes : undefined,
          search: searchTerm || undefined,
        },
        events: filteredEvents,
      };
      const json = JSON.stringify(payload, null, 2);
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const timestamp = new Date()
        .toISOString()
        .replaceAll(":", "-")
        .replaceAll(".", "-");
      link.href = url;
      link.download = `kenmei-event-log-${timestamp}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      toast.success("Exported filtered events");
      recordEvent({
        type: "debug.event-logger",
        message: "Exported event log snapshot",
        level: "info",
        metadata: { totalEntries: filteredEvents.length },
      });
    } catch (error) {
      console.error("Failed to export event log", error);
      toast.error("Unable to export events");
      recordEvent(
        {
          type: "debug.event-logger",
          message: "Event log export failed",
          level: "error",
          metadata: {
            error: error instanceof Error ? error.message : String(error),
          },
        },
        { force: true },
      );
    }
  };

  const resetFilters = () => {
    setActiveTypes([]);
    setSearchTerm("");
    setVisibleCount(DEFAULT_VISIBLE_COUNT);
  };

  const loadMore = () =>
    setVisibleCount((value) => value + DEFAULT_VISIBLE_COUNT);
  const resetVisibleWindow = () => setVisibleCount(DEFAULT_VISIBLE_COUNT);

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="space-y-4">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">Event timeline</h2>
          <p className="text-muted-foreground text-sm">
            Track user actions and application events. Use filters to focus on
            relevant time windows or event categories.
          </p>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <Badge variant="outline" className="border-border/60 bg-muted/40">
              {filteredEvents.length} showing
            </Badge>
            <Badge variant="outline" className="border-border/60 bg-muted/40">
              {eventLogEntries.length} captured (max {maxEventLogEntries})
            </Badge>
            <Badge variant="outline" className="border-border/60 bg-muted/40">
              {availableTypes.length} type
              {availableTypes.length === 1 ? "" : "s"}
            </Badge>
            {activeTypes.length ? (
              <Badge variant="outline" className="border-border/60 bg-muted/40">
                {activeTypes.length} type filter
                {activeTypes.length === 1 ? "" : "s"}
              </Badge>
            ) : null}
          </div>
        </div>

        <div className="bg-muted/20 rounded-2xl p-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                Event types
              </p>
              <div className="flex flex-wrap gap-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="rounded-full"
                    >
                      <Filter className="mr-2 h-4 w-4" />
                      {activeTypes.length
                        ? `${activeTypes.length} selected`
                        : "All event types"}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-64">
                    <DropdownMenuItem
                      onSelect={() => setActiveTypes([])}
                      className="font-semibold"
                    >
                      Clear selection
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    {availableTypes.map((type) => (
                      <DropdownMenuCheckboxItem
                        key={type}
                        checked={activeTypes.includes(type)}
                        onCheckedChange={() =>
                          setActiveTypes((prev) =>
                            prev.includes(type)
                              ? prev.filter((value) => value !== type)
                              : [...prev, type],
                          )
                        }
                      >
                        {type}
                      </DropdownMenuCheckboxItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            <div className="space-y-2">
              <label
                className="text-muted-foreground text-xs font-semibold tracking-wide uppercase"
                htmlFor={searchInputId}
              >
                Search
              </label>
              <div className="relative">
                <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
                <Input
                  id={searchInputId}
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Filter by message, source, metadata"
                  className="pl-9"
                />
              </div>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={resetFilters}
              >
                <RefreshCw className="mr-2 h-4 w-4" /> Reset filters
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={handleExport}
              >
                <Download className="mr-2 h-4 w-4" /> Export filtered
              </Button>
            </div>
            <Button
              type="button"
              size="sm"
              variant="destructive"
              onClick={handleClear}
              className="flex items-center"
            >
              <Trash2 className="mr-2 h-4 w-4" /> Clear log
            </Button>
          </div>
        </div>
      </div>

      <Separator />

      <div className="text-muted-foreground flex items-center justify-between text-xs">
        <span>
          Showing {visibleEvents.length} of {filteredEvents.length} filtered
          events
        </span>
        <div className="flex items-center gap-2">
          {visibleCount < sortedEvents.length && (
            <Button size="sm" variant="outline" onClick={loadMore}>
              Load more
            </Button>
          )}
          {visibleCount !== DEFAULT_VISIBLE_COUNT && (
            <Button size="sm" variant="ghost" onClick={resetVisibleWindow}>
              Reset window
            </Button>
          )}
        </div>
      </div>

      <ScrollArea type="always" className="h-full max-h-[25vh] w-full">
        <div className="space-y-3 pr-4">
          {visibleEvents.length === 0 ? (
            <div className="border-border/60 bg-muted/20 flex h-40 flex-col items-center justify-center gap-3 rounded-xl border border-dashed text-center">
              <p className="font-medium">No events to display</p>
              <p className="text-muted-foreground text-sm">
                Adjust filters or wait for new events to be captured.
              </p>
            </div>
          ) : (
            visibleEvents.map((entry) => (
              <EventCard key={entry.id} entry={entry} />
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

interface EventCardProps {
  entry: DebugEventEntry;
}

function EventCard({ entry }: Readonly<EventCardProps>) {
  const [metadataExpanded, setMetadataExpanded] = useState(false);
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(entry, null, 2));
      toast.success("Event copied to clipboard");
    } catch (error) {
      toast.error("Unable to copy event");
      console.error("Failed to copy event entry", error);
    }
  };

  const handleMetadataCopy = async () => {
    if (!entry.metadata) return;
    try {
      await navigator.clipboard.writeText(
        JSON.stringify(entry.metadata, null, 2),
      );
      toast.success("Metadata copied to clipboard");
    } catch (error) {
      toast.error("Unable to copy metadata");
      console.error("Failed to copy event metadata", error);
    }
  };

  const metadataString = entry.metadata
    ? JSON.stringify(entry.metadata, null, 2)
    : null;

  const levelMeta = entry.level ? LEVEL_META[entry.level] : null;

  return (
    <div className="border-border/60 bg-background/80 group hover:border-primary/40 rounded-xl border p-4 shadow-sm transition hover:shadow-md">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <Badge
            variant="outline"
            className="border-primary/40 bg-primary/10 text-primary"
          >
            {entry.type}
          </Badge>
          {entry.tags?.length ? (
            <Badge
              variant="outline"
              className="border-slate-400/40 bg-slate-400/10 text-slate-500"
            >
              <Tags className="mr-1 h-3 w-3" /> {entry.tags.join(", ")}
            </Badge>
          ) : null}
          {levelMeta ? (
            <Badge
              variant="outline"
              className={cn("flex items-center gap-1", levelMeta.tone)}
            >
              {levelMeta.label}
            </Badge>
          ) : null}
        </div>
        <div className="text-muted-foreground flex items-center gap-2 text-sm">
          {formatTimestamp(entry.timestamp)}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={handleCopy}
            className="h-8 w-8"
            title="Copy event JSON"
          >
            <Copy className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="mt-3 space-y-2 text-sm">
        <p className="font-medium">{entry.message}</p>
        <dl className="text-muted-foreground grid gap-2 text-xs sm:grid-cols-2">
          {entry.source ? (
            <div>
              <dt className="text-[0.6rem] tracking-wide uppercase">Source</dt>
              <dd>{entry.source}</dd>
            </div>
          ) : null}
          {entry.context ? (
            <div>
              <dt className="text-[0.6rem] tracking-wide uppercase">Context</dt>
              <dd>{entry.context}</dd>
            </div>
          ) : null}
        </dl>
        {entry.metadata ? (
          <div className="bg-muted/40 rounded-lg p-1">
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setMetadataExpanded((value) => !value)}
                className="text-left text-xs font-medium tracking-wide uppercase"
              >
                <span className="flex items-center gap-2">
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 transition-transform",
                      metadataExpanded ? "rotate-360" : "rotate-270",
                    )}
                  />
                  Metadata
                </span>
              </button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={handleMetadataCopy}
                className="h-7 w-7"
                title="Copy metadata JSON"
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            {metadataExpanded ? (
              <pre className="text-muted-foreground bg-background/70 mt-3 overflow-x-auto rounded-md p-3 text-xs">
                {metadataString}
              </pre>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
