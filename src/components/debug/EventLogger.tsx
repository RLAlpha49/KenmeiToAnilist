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
import { useDebugActions, useDebugState } from "../../contexts/DebugContext";
import { cn } from "@/utils/tailwind";
import { exportToJson } from "@/utils/exportUtils";
import type { DebugEventEntry, DebugEventLevel } from "@/types/debug";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";

/**
 * Mapping of event severity levels to display metadata (label and tone).
 * @source
 */
const LEVEL_META: Record<DebugEventLevel, { label: string; tone: string }> = {
  info: { label: "Info", tone: "bg-sky-500/10 text-sky-500" },
  warn: { label: "Warn", tone: "bg-amber-500/10 text-amber-500" },
  error: { label: "Error", tone: "bg-red-500/10 text-red-500" },
  success: { label: "Success", tone: "bg-emerald-500/10 text-emerald-500" },
  debug: { label: "Debug", tone: "bg-slate-500/10 text-slate-500" },
};

/** Number of events to show initially before "Load more" is needed. @source */
const DEFAULT_VISIBLE_COUNT = 100;

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
 * Checks if an event matches the active type filters.
 * @param entry - Event log entry
 * @param filters - Array of active event types to filter by
 * @returns True if entry matches any active filter or no filters are active
 * @source
 */
function eventMatchesType(entry: DebugEventEntry, filters: string[]) {
  if (!filters.length) return true;
  return filters.includes(entry.type);
}

/**
 * Checks if an event matches a search query across multiple fields.
 * Searches message, type, source, context, tags, and metadata.
 * @param entry - Event log entry
 * @param query - Search query string
 * @returns True if entry matches query in any searchable field
 * @source
 */
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

/**
 * Props for the EventLogger header component.
 * @source
 */
interface EventLoggerHeaderProps {
  filteredCount: number;
  totalCount: number;
  maxEntries: number;
  availableTypesCount: number;
  activeTypesCount: number;
}

/**
 * Displays event log header with statistics and summary information.
 * Shows counts of displayed, captured, and available event types.
 * @source
 */
function EventLoggerHeader({
  filteredCount,
  totalCount,
  maxEntries,
  availableTypesCount,
  activeTypesCount,
}: Readonly<EventLoggerHeaderProps>) {
  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">Event timeline</h2>
        <p className="text-muted-foreground text-sm">
          Track user actions and application events. Use filters to focus on
          relevant time windows or event categories.
        </p>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <Badge variant="outline" className="border-border/60 bg-muted/40">
            {filteredCount} showing
          </Badge>
          <Badge variant="outline" className="border-border/60 bg-muted/40">
            {totalCount} captured (max {maxEntries})
          </Badge>
          <Badge variant="outline" className="border-border/60 bg-muted/40">
            {availableTypesCount} type
            {availableTypesCount === 1 ? "" : "s"}
          </Badge>
          {activeTypesCount > 0 && (
            <Badge variant="outline" className="border-border/60 bg-muted/40">
              {activeTypesCount} type filter
              {activeTypesCount === 1 ? "" : "s"}
            </Badge>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Props for the filter controls component.
 * @source
 */
interface FilterControlsProps {
  availableTypes: string[];
  activeTypes: string[];
  onTypesChange: (types: string[]) => void;
  searchTerm: string;
  onSearchChange: (term: string) => void;
  searchInputId: string;
  onResetFilters: () => void;
  onExport: () => void;
  onClear: () => void;
}

/**
 * Filter controls for event logs including type selection, search, and action buttons.
 * @source
 */
function FilterControls({
  availableTypes,
  activeTypes,
  onTypesChange,
  searchTerm,
  onSearchChange,
  searchInputId,
  onResetFilters,
  onExport,
  onClear,
}: Readonly<FilterControlsProps>) {
  return (
    <div className="bg-muted/20 rounded-2xl p-4">
      <div className="grid grid-cols-2 gap-4">
        <TypeFilter
          availableTypes={availableTypes}
          activeTypes={activeTypes}
          onTypesChange={onTypesChange}
        />
        <SearchFilter
          searchTerm={searchTerm}
          onSearchChange={onSearchChange}
          searchInputId={searchInputId}
        />
      </div>
      <ActionButtons
        onResetFilters={onResetFilters}
        onExport={onExport}
        onClear={onClear}
      />
    </div>
  );
}

/**
 * Props for the type filter component.
 * @source
 */
interface TypeFilterProps {
  availableTypes: string[];
  activeTypes: string[];
  onTypesChange: (types: string[]) => void;
}

/**
 * Type filter dropdown for selecting which event types to display.
 * @source
 */
function TypeFilter({
  availableTypes,
  activeTypes,
  onTypesChange,
}: Readonly<TypeFilterProps>) {
  const handleToggleType = (type: string) => {
    onTypesChange(
      activeTypes.includes(type)
        ? activeTypes.filter((value) => value !== type)
        : [...activeTypes, type],
    );
  };

  return (
    <div className="space-y-2">
      <p className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">
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
              onSelect={() => onTypesChange([])}
              className="font-semibold"
            >
              Clear selection
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {availableTypes.map((type) => (
              <DropdownMenuCheckboxItem
                key={type}
                checked={activeTypes.includes(type)}
                onCheckedChange={() => handleToggleType(type)}
              >
                {type}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

/**
 * Props for the search filter component.
 * @source
 */
interface SearchFilterProps {
  searchTerm: string;
  onSearchChange: (term: string) => void;
  searchInputId: string;
}

/**
 * Search input for filtering events by text query.
 * @source
 */
function SearchFilter({
  searchTerm,
  onSearchChange,
  searchInputId,
}: Readonly<SearchFilterProps>) {
  return (
    <div className="space-y-2">
      <label
        className="text-muted-foreground text-xs font-semibold uppercase tracking-wide"
        htmlFor={searchInputId}
      >
        Search
      </label>
      <div className="relative">
        <Search className="text-muted-foreground pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
        <Input
          id={searchInputId}
          value={searchTerm}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Filter by message, source, metadata"
          className="pl-9"
        />
      </div>
    </div>
  );
}

/**
 * Props for the action buttons component.
 * @source
 */
interface ActionButtonsProps {
  onResetFilters: () => void;
  onExport: () => void;
  onClear: () => void;
}

/**
 * Action buttons for resetting filters, exporting events, and clearing the log.
 * @source
 */
function ActionButtons({
  onResetFilters,
  onExport,
  onClear,
}: Readonly<ActionButtonsProps>) {
  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={onResetFilters}
        >
          <RefreshCw className="mr-2 h-4 w-4" /> Reset filters
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={onExport}>
          <Download className="mr-2 h-4 w-4" /> Export filtered
        </Button>
      </div>
      <Button
        type="button"
        size="sm"
        variant="destructive"
        onClick={onClear}
        className="flex items-center"
      >
        <Trash2 className="mr-2 h-4 w-4" /> Clear log
      </Button>
    </div>
  );
}

/**
 * Props for the pagination controls component.
 * @source
 */
interface PaginationControlsProps {
  visibleCount: number;
  filteredCount: number;
  totalVisible: number;
  totalSorted: number;
  defaultCount: number;
  onLoadMore: () => void;
  onResetWindow: () => void;
}

/**
 * Pagination controls showing event count and load more functionality.
 * @source
 */
function PaginationControls({
  visibleCount,
  filteredCount,
  totalVisible,
  totalSorted,
  defaultCount,
  onLoadMore,
  onResetWindow,
}: Readonly<PaginationControlsProps>) {
  return (
    <div className="text-muted-foreground flex items-center justify-between text-xs">
      <span>
        Showing {visibleCount} of {filteredCount} filtered events
      </span>
      <div className="flex items-center gap-2">
        {totalVisible < totalSorted && (
          <Button size="sm" variant="outline" onClick={onLoadMore}>
            Load more
          </Button>
        )}
        {totalVisible !== defaultCount && (
          <Button size="sm" variant="ghost" onClick={onResetWindow}>
            Reset window
          </Button>
        )}
      </div>
    </div>
  );
}

/**
 * Props for the event list component.
 * @source
 */
interface EventListProps {
  events: DebugEventEntry[];
}

/**
 * Scrollable list of event cards. Shows empty state if no events provided.
 * @source
 */
function EventList({ events }: Readonly<EventListProps>) {
  if (events.length === 0) {
    return <EmptyEventState />;
  }

  return (
    <ScrollArea type="always" className="h-full max-h-[25vh] w-full">
      <div className="space-y-3 pr-4">
        {events.map((entry) => (
          <EventCard key={entry.id} entry={entry} />
        ))}
      </div>
    </ScrollArea>
  );
}

/**
 * Empty state displayed when no events match the current filters.
 * @returns JSX element for empty state message
 * @source
 */
function EmptyEventState() {
  return (
    <ScrollArea type="always" className="h-full max-h-[25vh] w-full">
      <div className="space-y-3 pr-4">
        <div className="border-border/60 bg-muted/20 flex h-40 flex-col items-center justify-center gap-3 rounded-xl border border-dashed text-center">
          <p className="font-medium">No events to display</p>
          <p className="text-muted-foreground text-sm">
            Adjust filters or wait for new events to be captured.
          </p>
        </div>
      </div>
    </ScrollArea>
  );
}

/**
 * Event log viewer with filtering, search, pagination, and export functionality.
 * Displays application and user action events with severity levels and metadata.
 * @returns JSX element rendering the event logger panel
 * @source
 */
export function EventLogger(): React.ReactElement {
  const { eventLogEntries, maxEventLogEntries } = useDebugState();
  const { clearEventLog, recordEvent } = useDebugActions();
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
      exportToJson(payload, "kenmei-event-log");
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
      <EventLoggerHeader
        filteredCount={filteredEvents.length}
        totalCount={eventLogEntries.length}
        maxEntries={maxEventLogEntries}
        availableTypesCount={availableTypes.length}
        activeTypesCount={activeTypes.length}
      />

      <FilterControls
        availableTypes={availableTypes}
        activeTypes={activeTypes}
        onTypesChange={setActiveTypes}
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        searchInputId={searchInputId}
        onResetFilters={resetFilters}
        onExport={handleExport}
        onClear={handleClear}
      />

      <Separator />

      <PaginationControls
        visibleCount={visibleEvents.length}
        filteredCount={filteredEvents.length}
        totalVisible={visibleCount}
        totalSorted={sortedEvents.length}
        defaultCount={DEFAULT_VISIBLE_COUNT}
        onLoadMore={loadMore}
        onResetWindow={resetVisibleWindow}
      />

      <EventList events={visibleEvents} />
    </div>
  );
}

/**
 * Props for the event card component.
 * @source
 */
interface EventCardProps {
  entry: DebugEventEntry;
}

/**
 * Card displaying a single event entry with header, body, and optional metadata.
 * @source
 */
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

  return (
    <div className="border-border/60 bg-background/80 hover:border-primary/40 group rounded-xl border p-4 shadow-sm transition hover:shadow-md">
      <EventCardHeader entry={entry} onCopy={handleCopy} />
      <EventCardBody
        entry={entry}
        metadataExpanded={metadataExpanded}
        onToggleMetadata={() => setMetadataExpanded((value) => !value)}
        onMetadataCopy={handleMetadataCopy}
      />
    </div>
  );
}

/**
 * Props for the event card header component.
 * @source
 */
interface EventCardHeaderProps {
  entry: DebugEventEntry;
  onCopy: () => void;
}

/**
 * Event card header with badges, timestamp, and copy button.
 * @source
 */
function EventCardHeader({ entry, onCopy }: Readonly<EventCardHeaderProps>) {
  const levelMeta = entry.level ? LEVEL_META[entry.level] : null;

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
      <EventBadges entry={entry} levelMeta={levelMeta} />
      <div className="text-muted-foreground flex items-center gap-2 text-sm">
        {formatTimestamp(entry.timestamp)}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onCopy}
          className="h-8 w-8"
          title="Copy event JSON"
        >
          <Copy className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

/**
 * Props for the event badges component.
 * @source
 */
interface EventBadgesProps {
  entry: DebugEventEntry;
  levelMeta: { label: string; tone: string } | null;
}

/**
 * Badges displaying event type, tags, and severity level.
 * @source
 */
function EventBadges({ entry, levelMeta }: Readonly<EventBadgesProps>) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Badge
        variant="outline"
        className="border-primary/40 bg-primary/10 text-primary"
      >
        {entry.type}
      </Badge>
      {entry.tags?.length && (
        <Badge
          variant="outline"
          className="border-slate-400/40 bg-slate-400/10 text-slate-500"
        >
          <Tags className="mr-1 h-3 w-3" /> {entry.tags.join(", ")}
        </Badge>
      )}
      {levelMeta && (
        <Badge
          variant="outline"
          className={cn("flex items-center gap-1", levelMeta.tone)}
        >
          {levelMeta.label}
        </Badge>
      )}
    </div>
  );
}

/**
 * Props for the event card body component.
 * @source
 */
interface EventCardBodyProps {
  entry: DebugEventEntry;
  metadataExpanded: boolean;
  onToggleMetadata: () => void;
  onMetadataCopy: () => void;
}

/**
 * Event card body with message, details, and expandable metadata section.
 * @source
 */
function EventCardBody({
  entry,
  metadataExpanded,
  onToggleMetadata,
  onMetadataCopy,
}: Readonly<EventCardBodyProps>) {
  return (
    <div className="mt-3 space-y-2 text-sm">
      <p className="font-medium">{entry.message}</p>
      <EventDetails entry={entry} />
      {entry.metadata && (
        <EventMetadata
          metadata={entry.metadata}
          expanded={metadataExpanded}
          onToggle={onToggleMetadata}
          onCopy={onMetadataCopy}
        />
      )}
    </div>
  );
}

/**
 * Props for the event details component.
 * @source
 */
interface EventDetailsProps {
  entry: DebugEventEntry;
}

/**
 * Displays source and context information for an event if available.
 * @source
 */
function EventDetails({ entry }: Readonly<EventDetailsProps>) {
  const hasDetails = entry.source || entry.context;
  if (!hasDetails) return null;

  return (
    <dl className="text-muted-foreground grid gap-2 text-xs sm:grid-cols-2">
      {entry.source && (
        <div>
          <dt className="text-[0.6rem] uppercase tracking-wide">Source</dt>
          <dd>{entry.source}</dd>
        </div>
      )}
      {entry.context && (
        <div>
          <dt className="text-[0.6rem] uppercase tracking-wide">Context</dt>
          <dd>{entry.context}</dd>
        </div>
      )}
    </dl>
  );
}

/**
 * Props for the event metadata component.
 * @source
 */
interface EventMetadataProps {
  metadata: Record<string, unknown>;
  expanded: boolean;
  onToggle: () => void;
  onCopy: () => void;
}

/**
 * Expandable metadata section showing event JSON with copy functionality.
 * @source
 */
function EventMetadata({
  metadata,
  expanded,
  onToggle,
  onCopy,
}: Readonly<EventMetadataProps>) {
  const metadataString = JSON.stringify(metadata, null, 2);

  return (
    <div className="bg-muted/40 rounded-lg p-1">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={onToggle}
          className="text-left text-xs font-medium uppercase tracking-wide"
        >
          <span className="flex items-center gap-2">
            <ChevronDown
              className={cn(
                "h-4 w-4 transition-transform",
                expanded ? "rotate-360" : "rotate-270",
              )}
            />
            Metadata
          </span>
        </button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onCopy}
          className="h-7 w-7"
          title="Copy metadata JSON"
        >
          <Copy className="h-4 w-4" />
        </Button>
      </div>
      {expanded && (
        <pre className="text-muted-foreground bg-background/70 mt-3 overflow-x-auto rounded-md p-3 text-xs">
          {metadataString}
        </pre>
      )}
    </div>
  );
}
