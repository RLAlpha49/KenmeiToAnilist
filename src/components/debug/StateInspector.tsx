/**
 * @packageDocumentation
 * @module StateInspector
 * @description Debug panel for inspecting and mutating registered application state snapshots.
 */

import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useDebug } from "../../contexts/DebugContext";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Textarea } from "../ui/textarea";
import { ScrollArea } from "../ui/scroll-area";
import { Separator } from "../ui/separator";
import { cn } from "@/utils/tailwind";
import {
  AlertCircle,
  Check,
  ClipboardCopy,
  FileWarning,
  FlaskConical,
  RefreshCcw,
  RotateCcw,
  ShieldAlert,
} from "lucide-react";

interface EditorState {
  value: string;
  isDirty: boolean;
  error?: string | null;
}

function safeStringify(value: unknown): string {
  if (value === undefined) {
    return "undefined";
  }

  try {
    return JSON.stringify(
      value,
      (_key, val) => {
        if (val instanceof Map) {
          return {
            __type: "Map",
            entries: Array.from(val.entries()),
          };
        }
        if (val instanceof Set) {
          return {
            __type: "Set",
            values: Array.from(val.values()),
          };
        }
        if (typeof val === "bigint") {
          return {
            __type: "BigInt",
            value: val.toString(),
          };
        }
        if (typeof val === "function") {
          return {
            __type: "Function",
            source: val.toString(),
          };
        }
        return val;
      },
      2,
    );
  } catch (error) {
    console.error("Failed to serialise state inspector value", error);
    return `/* Unable to serialise value: ${String(error)} */`;
  }
}

function formatTimestamp(timestamp: number): string {
  if (!Number.isFinite(timestamp)) {
    return "Unknown";
  }
  try {
    const date = new Date(timestamp);
    return `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
  } catch (error) {
    console.error("Failed to format timestamp", error);
    return "Unknown";
  }
}

export function StateInspector(): React.ReactElement {
  const {
    stateInspectorSources,
    applyStateInspectorUpdate,
    refreshStateInspectorSource,
  } = useDebug();

  const [editorState, setEditorState] = useState<Record<string, EditorState>>(
    {},
  );

  useEffect(() => {
    setEditorState((prev) => {
      const nextState: Record<string, EditorState> = {};

      for (const source of stateInspectorSources) {
        const previous = prev[source.id];
        const formatted = safeStringify(source.value);
        if (previous && previous.isDirty) {
          nextState[source.id] = previous;
        } else {
          nextState[source.id] = {
            value: formatted,
            isDirty: false,
            error: null,
          };
        }
      }

      return nextState;
    });
  }, [stateInspectorSources]);

  const groups = useMemo(() => {
    return stateInspectorSources.reduce(
      (acc, source) => {
        if (!acc[source.group]) {
          acc[source.group] = [];
        }
        acc[source.group].push(source);
        return acc;
      },
      {} as Record<string, typeof stateInspectorSources>,
    );
  }, [stateInspectorSources]);

  const handleEditorChange = (id: string, value: string) => {
    setEditorState((prev) => ({
      ...prev,
      [id]: {
        value,
        isDirty: true,
        error: null,
      },
    }));
  };

  const handleRefresh = (id: string) => {
    refreshStateInspectorSource(id);
    setEditorState((prev) => ({
      ...prev,
      [id]: prev[id]
        ? {
            ...prev[id],
            isDirty: false,
            error: null,
          }
        : prev[id],
    }));
  };

  const handleCopy = async (id: string) => {
    const current = editorState[id];
    if (!current) return;
    try {
      await navigator.clipboard.writeText(current.value);
      toast.success("State snapshot copied to clipboard");
    } catch (error) {
      toast.error("Failed to copy state snapshot");
      console.error("Failed to copy state inspector snapshot", error);
    }
  };

  const handleApply = (id: string, label: string) => {
    const current = editorState[id];
    if (!current) return;
    try {
      const parsed = JSON.parse(current.value);
      applyStateInspectorUpdate(id, parsed);
      toast.success(`${label} state updated`);
      setEditorState((prev) => ({
        ...prev,
        [id]: {
          value: current.value,
          isDirty: false,
          error: null,
        },
      }));
    } catch (error) {
      const message =
        error instanceof SyntaxError
          ? "Invalid JSON payload"
          : "Failed to apply state mutation";
      toast.error(message);
      console.error("State inspector apply error", error);
      setEditorState((prev) => ({
        ...prev,
        [id]: {
          ...current,
          error: message,
        },
      }));
    }
  };

  if (stateInspectorSources.length === 0) {
    return (
      <div className="border-border/60 bg-muted/20 flex h-full flex-col items-center justify-center gap-4 rounded-2xl border border-dashed p-8 text-center">
        <FlaskConical className="text-muted-foreground h-10 w-10" />
        <div className="space-y-2">
          <h2 className="text-lg font-semibold">No state sources registered</h2>
          <p className="text-muted-foreground text-sm">
            Enable debug instrumentation in providers or hooks to inspect and
            mutate runtime state from this panel.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-6">
      <div className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">State inspector</h2>
        <p className="text-muted-foreground text-sm">
          Review live snapshots of registered application state. When a source
          allows mutations, you can edit the JSON payload and apply it to the
          live runtime for testing.
        </p>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <Badge variant="outline" className="border-border/60 bg-muted/40">
            {stateInspectorSources.length} source
            {stateInspectorSources.length === 1 ? "" : "s"}
          </Badge>
          <Badge variant="outline" className="border-border/60 bg-muted/40">
            {Object.keys(groups).length} group
            {Object.keys(groups).length === 1 ? "" : "s"}
          </Badge>
        </div>
      </div>

      <Separator />

      <ScrollArea className="flex-1">
        <div className="space-y-8 pr-4">
          {Object.entries(groups).map(([group, sources]) => (
            <div key={group} className="space-y-4">
              <div className="flex items-center gap-3">
                <Badge className="bg-primary/10 text-primary border-primary/20 border">
                  {group}
                </Badge>
                <span className="text-muted-foreground text-xs">
                  {sources.length} source
                  {sources.length === 1 ? "" : "s"}
                </span>
              </div>

              <div className="space-y-6 pb-4">
                {sources.map((source) => {
                  const editor = editorState[source.id] ?? {
                    value: safeStringify(source.value),
                    isDirty: false,
                    error: null,
                  };
                  const readOnly = !source.canEdit;

                  let statusBadge: React.ReactNode;
                  if (readOnly) {
                    statusBadge = (
                      <Badge
                        variant="outline"
                        className="border-border/60 text-muted-foreground"
                      >
                        Read only
                      </Badge>
                    );
                  } else if (editor.isDirty) {
                    statusBadge = (
                      <Badge className="bg-amber-500/15 text-amber-600 dark:text-amber-300">
                        Pending update
                      </Badge>
                    );
                  } else {
                    statusBadge = (
                      <Badge
                        variant="outline"
                        className="border-border/60 text-muted-foreground"
                      >
                        Live
                      </Badge>
                    );
                  }

                  return (
                    <div
                      key={source.id}
                      className="border-border/60 bg-background/90 rounded-2xl border p-4 shadow-sm"
                    >
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <h3 className="text-base font-semibold">
                              {source.label}
                            </h3>
                            {statusBadge}
                          </div>
                          {source.description ? (
                            <p className="text-muted-foreground text-sm">
                              {source.description}
                            </p>
                          ) : null}
                        </div>
                        <div className="text-muted-foreground flex flex-col items-start gap-1 text-xs sm:items-end">
                          <span className="flex items-center gap-1">
                            <RefreshCcw className="h-3.5 w-3.5" />
                            Last updated {formatTimestamp(source.lastUpdated)}
                          </span>
                          {editor.error ? (
                            <span className="flex items-center gap-1 text-red-500 dark:text-red-400">
                              <AlertCircle className="h-3.5 w-3.5" />
                              {editor.error}
                            </span>
                          ) : null}
                        </div>
                      </div>

                      <div className="mt-4 space-y-4">
                        <Textarea
                          value={editor.value}
                          onChange={(event) =>
                            handleEditorChange(source.id, event.target.value)
                          }
                          spellCheck={false}
                          className={cn(
                            "min-h-[220px] w-full resize-y font-mono text-xs leading-relaxed whitespace-pre-wrap",
                            readOnly && "opacity-70",
                            editor.error &&
                              "border-red-400 focus-visible:ring-red-400",
                          )}
                          wrap="soft"
                          style={{ overflowWrap: "anywhere" }}
                          readOnly={readOnly}
                        />

                        <div className="flex flex-wrap items-center gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => handleRefresh(source.id)}
                          >
                            <RotateCcw className="mr-2 h-4 w-4" />
                            Refresh snapshot
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => handleCopy(source.id)}
                          >
                            <ClipboardCopy className="mr-2 h-4 w-4" />
                            Copy JSON
                          </Button>
                          <div className="ml-auto flex items-center gap-2">
                            <Button
                              type="button"
                              variant="default"
                              size="sm"
                              onClick={() =>
                                handleApply(source.id, source.label)
                              }
                              disabled={readOnly || !editor.isDirty}
                            >
                              <Check className="mr-2 h-4 w-4" />
                              Apply changes
                            </Button>
                          </div>
                        </div>

                        {readOnly ? (
                          <div className="border-border/60 bg-muted/40 flex items-center gap-2 rounded-md border px-3 py-2 text-xs">
                            <ShieldAlert className="text-muted-foreground h-3.5 w-3.5" />
                            <span>
                              This source is exposed for observation only.
                              Mutations are disabled by the provider.
                            </span>
                          </div>
                        ) : (
                          <div className="border-border/60 bg-muted/30 flex items-start gap-2 rounded-md border px-3 py-2 text-xs">
                            <FileWarning className="text-muted-foreground h-3.5 w-3.5" />
                            <span>
                              Applying malformed state can destabilise the
                              application. Export snapshots before mutating, and
                              restore them if issues occur.
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
