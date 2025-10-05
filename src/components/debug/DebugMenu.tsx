/**
 * @packageDocumentation
 * @module DebugMenu
 * @description Debug menu component for viewing and editing electron store and localStorage values.
 */

import React, { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Braces, Bug, ScrollText } from "lucide-react";
import { StorageDebugger } from "./StorageDebugger";
import { LogViewer } from "./LogViewer";
import { StateInspector } from "./StateInspector";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { Badge } from "../ui/badge";
import { useDebug } from "../../contexts/DebugContext";
import { cn } from "@/utils/tailwind";
import { Button } from "../ui/button";
import { ScrollArea } from "../ui/scroll-area";

interface DebugPanelDefinition {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  element: React.ReactNode;
}

interface DebugMenuProps {
  isOpen: boolean;
  onClose: () => void;
}

export function DebugMenu({ isOpen, onClose }: Readonly<DebugMenuProps>) {
  const { storageDebuggerEnabled, logViewerEnabled, stateInspectorEnabled } =
    useDebug();

  const panels = useMemo(() => {
    const entries: DebugPanelDefinition[] = [];

    if (storageDebuggerEnabled) {
      entries.push({
        id: "storage",
        label: "Storage Explorer",
        description:
          "Inspect and edit localStorage and Electron Store entries in real time.",
        icon: (
          <div className="bg-primary/10 text-primary grid h-10 w-10 place-items-center rounded-xl">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-5 w-5"
            >
              <rect x="3" y="4" width="18" height="7" rx="1" />
              <rect x="3" y="13" width="18" height="7" rx="1" />
              <path d="M7 17h0" />
              <path d="M7 8h0" />
            </svg>
          </div>
        ),
        element: <StorageDebugger />,
      });
    }

    if (logViewerEnabled) {
      entries.push({
        id: "logs",
        label: "Log Viewer",
        description:
          "Review captured console output, filter by severity, and export logs for support.",
        icon: (
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-purple-500/10 text-purple-500">
            <ScrollText className="h-5 w-5" />
          </div>
        ),
        element: <LogViewer />,
      });
    }

    if (stateInspectorEnabled) {
      entries.push({
        id: "state",
        label: "State Inspector",
        description:
          "Inspect registered application state snapshots and safely mutate values for testing.",
        icon: (
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-amber-500/10 text-amber-500">
            <Braces className="h-5 w-5" />
          </div>
        ),
        element: <StateInspector />,
      });
    }

    return entries;
  }, [logViewerEnabled, stateInspectorEnabled, storageDebuggerEnabled]);

  const [activePanel, setActivePanel] = useState<string>(panels[0]?.id ?? "");

  useEffect(() => {
    if (!panels.length) {
      setActivePanel("");
      return;
    }

    if (!panels.some((panel) => panel.id === activePanel)) {
      setActivePanel(panels[0].id);
    }
  }, [panels, activePanel]);

  const hasPanels = panels.length > 0;

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
    >
      <DialogContent className="border-border/60 bg-background/95 max-h-[80vh] !max-w-5xl grid-rows-[auto,1fr] overflow-hidden border p-0 shadow-2xl backdrop-blur-xl">
        <DialogHeader className="relative overflow-hidden px-8 pt-8 pb-4">
          <div className="from-primary/10 absolute inset-0 h-full w-full bg-gradient-to-br via-purple-500/10 to-transparent" />
          <div className="bg-primary/15 absolute top-8 right-10 h-32 w-32 rounded-full blur-3xl" />
          <div className="relative z-10 flex flex-col gap-3">
            <DialogTitle className="flex items-center gap-3 text-2xl font-semibold">
              <span className="bg-muted/60 text-primary border-primary/20 hidden h-11 w-11 items-center justify-center rounded-xl border shadow-inner sm:flex">
                <Bug className="h-5 w-5" />
              </span>
              <div>
                <p className="text-muted-foreground text-xs tracking-[0.3em] uppercase">
                  Internal Tools
                </p>
                <span>Debug Command Center</span>
              </div>
            </DialogTitle>
            <DialogDescription className="text-muted-foreground max-w-2xl text-sm">
              Access experimental developer utilities. Toggle individual panels
              from Settings → Data → Debug Tools.
            </DialogDescription>
            {hasPanels ? (
              <Badge
                variant="outline"
                className="border-primary/40 bg-primary/10 text-primary w-fit rounded-full text-xs font-semibold"
              >
                {panels.length} panel{panels.length === 1 ? "" : "s"} enabled
              </Badge>
            ) : (
              <Badge
                variant="outline"
                className="w-fit rounded-full border-orange-300/60 bg-orange-100/40 text-xs font-semibold text-orange-600 dark:border-orange-500/40 dark:bg-orange-900/30 dark:text-orange-200"
              >
                No panels enabled
              </Badge>
            )}
          </div>
        </DialogHeader>
        <div className="flex h-full max-h-[60vh] min-h-0 flex-1 flex-col gap-6 px-8 pt-6 pb-8">
          {hasPanels ? (
            <Tabs
              value={activePanel}
              onValueChange={setActivePanel}
              orientation="vertical"
              className="flex min-h-0 flex-1"
            >
              <div className="flex min-h-0 flex-col gap-6 lg:flex-row">
                <div className="border-border/80 bg-muted/10 relative flex w-full flex-col overflow-hidden rounded-2xl border shadow-sm lg:w-64">
                  <ScrollArea type="always" className="flex h-full w-full">
                    <div className="p-2">
                      <TabsList
                        className={cn("flex h-auto w-full flex-col gap-2")}
                        aria-label="Debug panel selector"
                      >
                        {panels.map((panel) => (
                          <TabsTrigger
                            key={panel.id}
                            value={panel.id}
                            className={cn(
                              "group w-full flex-none justify-start gap-3 rounded-xl border px-3 py-3 text-left text-sm transition-all",
                              "h-auto min-h-[3.25rem]",
                              // default card appearance
                              "bg-background/90 border-border/40",
                              // active state: stronger background, border, subtle shadow and left accent
                              "data-[state=active]:bg-primary/10 data-[state=active]:border-primary/40 data-[state=active]:text-primary data-[state=active]:shadow-md",
                              "data-[state=active]:-ml-1 data-[state=active]:pl-4",
                              "data-[state=active]:before:bg-primary/60 data-[state=active]:before:absolute data-[state=active]:before:top-0 data-[state=active]:before:left-0 data-[state=active]:before:h-full data-[state=active]:before:w-1 data-[state=active]:before:rounded-l-md data-[state=active]:before:content-['']",
                              "hover:border-primary/30 hover:bg-primary/5",
                              // Ensure text can wrap instead of overflowing
                              "min-w-0 break-words whitespace-normal",
                            )}
                            style={{ position: "relative" }}
                          >
                            <div className="flex items-start gap-3">
                              <div className="flex-shrink-0">{panel.icon}</div>
                              <div className="min-w-0 flex-1 space-y-1">
                                <div className="leading-tight font-semibold">
                                  {panel.label}
                                </div>
                                <p className="text-muted-foreground text-xs">
                                  {panel.description}
                                </p>
                              </div>
                            </div>
                          </TabsTrigger>
                        ))}
                      </TabsList>
                    </div>
                  </ScrollArea>
                </div>

                {/* Content column */}
                <div className="border-border/80 bg-background/95 relative flex-1 overflow-hidden rounded-2xl border shadow-inner">
                  <div className="from-primary/10 absolute inset-x-12 top-0 h-24 rounded-b-full bg-gradient-to-b to-transparent blur-3xl" />
                  <div className="relative h-full min-h-0 overflow-y-auto p-4">
                    {panels.map((panel) => (
                      <TabsContent
                        key={panel.id}
                        value={panel.id}
                        className="h-full"
                      >
                        <div className="flex h-full min-h-0 flex-col">
                          {panel.element}
                        </div>
                      </TabsContent>
                    ))}
                  </div>
                </div>
              </div>
            </Tabs>
          ) : (
            <div className="border-border/60 bg-muted/20 flex h-full flex-col items-center justify-center gap-4 rounded-2xl border border-dashed py-4 text-center">
              <p className="text-muted-foreground max-w-md text-sm">
                Enable at least one debug panel from{" "}
                <strong>Settings → Data → Debug tools</strong> to start using
                the command center.
              </p>
              <Button variant="outline" onClick={onClose}>
                Close
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
