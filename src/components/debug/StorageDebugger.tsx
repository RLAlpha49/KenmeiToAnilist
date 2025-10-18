/**
 * @packageDocumentation
 * @module StorageDebugger
 * @description Storage debugger component for viewing and editing electron store and localStorage values.
 */

import React, { useState, useEffect, useMemo } from "react";
import { toast } from "sonner";
import { storageCache } from "../../utils/storage";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Textarea } from "../ui/textarea";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { Badge } from "../ui/badge";
import { ScrollArea } from "../ui/scroll-area";
import { Switch } from "../ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "../ui/alert-dialog";
import {
  Trash2,
  RefreshCw,
  Edit,
  Plus,
  Save,
  X,
  Database,
  HardDrive,
  Search,
  Copy,
  Download,
  Upload,
} from "lucide-react";

/**
 * Represents a storage item with key, value, type, and size information.
 * @source
 */
interface StorageItem {
  key: string;
  value: string;
  type: "string" | "object" | "number" | "boolean";
  size: number;
}

/**
 * Safely parses JSON string and returns parse result with optional error message.
 * @param value - JSON string to parse
 * @returns Object with ok flag, parsed data if successful, or error message if failed
 * @source
 */
const tryParseJSON = (
  value: string,
): { ok: boolean; data?: unknown; error?: string } => {
  try {
    const data = JSON.parse(value);
    return { ok: true, data };
  } catch (e) {
    const err = e as { message?: string };
    return { ok: false, error: err?.message || "Invalid JSON" };
  }
};

/**
 * Formats byte size into human-readable string (B, KB, MB).
 * @param bytes - Size in bytes
 * @returns Formatted size string
 * @source
 */
const formatSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

/**
 * Analyzes a value and returns its inferred storage type and size in bytes.
 * Detects JSON objects, numbers, and booleans within strings.
 * @param value - Value to analyze
 * @returns Object with detected type and size in bytes
 * @source
 */
const getValueInfo = (
  value: unknown,
): { type: StorageItem["type"]; size: number } => {
  const jsonString = typeof value === "string" ? value : JSON.stringify(value);
  const size = new Blob([jsonString ?? ""]).size;

  if (value === null || value === undefined) return { type: "string", size };
  if (typeof value !== "string") return { type: "string", size };

  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return { type: "object", size };
    if (typeof parsed === "object" && parsed !== null)
      return { type: "object", size };
    if (typeof parsed === "number") return { type: "number", size };
    if (typeof parsed === "boolean") return { type: "boolean", size };
  } catch {
    // not JSON
  }
  return { type: "string", size };
};

/**
 * Badge component for displaying storage item type with appropriate styling.
 * @param type - Storage item type
 * @returns Badge element
 * @source
 */
const TypeBadge: React.FC<{ type: StorageItem["type"] }> = ({ type }) => {
  let variant: "default" | "secondary" | "outline" = "secondary";
  if (type === "object") {
    variant = "default";
  } else if (type === "boolean") {
    variant = "outline";
  }
  return <Badge variant={variant}>{type}</Badge>;
};

/**
 * Highlights the first occurrence of query string in text with yellow mark.
 * Case-insensitive search.
 * @param text - Text to search within
 * @param query - Query string to highlight
 * @returns JSX with highlighted segment or original text
 * @source
 */
const highlight = (text: string, query: string) => {
  if (!query) return text;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-yellow-200 text-black dark:bg-yellow-400/40">
        {text.slice(idx, idx + query.length)}
      </mark>
      {text.slice(idx + query.length)}
    </>
  );
};

/**
 * Displays a truncated value preview up to maxChars with ellipsis for overflow.
 * Lightweight rendering for storage overview.
 * @source
 */
const OverviewValue: React.FC<{ value: string; maxChars: number }> = ({
  value,
  maxChars,
}) => {
  const len = value.length;
  const sliceLen = Math.min(maxChars, len);
  const sliced = len > sliceLen ? value.slice(0, sliceLen) + "…" : value;
  return <span>{sliced}</span>;
};

/**
 * Storage debugger for viewing and editing localStorage and Electron Store entries.
 * Displays storage statistics, allows search, export, import, and item editing.
 * @returns JSX element rendering the storage debugger panel
 * @source
 */
export function StorageDebugger() {
  const [electronStoreItems, setElectronStoreItems] = useState<StorageItem[]>(
    [],
  );
  const [localStorageItems, setLocalStorageItems] = useState<StorageItem[]>([]);
  const [editingItem, setEditingItem] = useState<{
    key: string;
    value: string;
    isElectron: boolean;
  } | null>(null);
  const [newItem, setNewItem] = useState<{
    key: string;
    value: string;
    isElectron: boolean;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchInValues, setSearchInValues] = useState(true);

  // Add formatter helper
  const tryFormatJSON = (raw: string): string | null => {
    const parsed = tryParseJSON(raw);
    if (!parsed.ok) return null;
    try {
      return JSON.stringify(parsed.data, null, 2);
    } catch {
      return null;
    }
  };

  // Load localStorage items
  const loadLocalStorageItems = () => {
    const items: StorageItem[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) {
        const value = localStorage.getItem(key) || "";
        const { type, size } = getValueInfo(value);
        items.push({ key, value, type, size });
      }
    }
    items.sort((a, b) => a.key.localeCompare(b.key));
    setLocalStorageItems(items);
  };

  // Get all localStorage keys
  const getLocalStorageKeys = (): string[] => {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) keys.push(key);
    }
    return keys;
  };

  // Get all keys to check for electron store
  const getAllKeysToCheck = (): string[] => {
    const localKeys = getLocalStorageKeys();
    const electronSpecificKeys = [
      "window-bounds",
      "app-preferences",
      "cache-settings",
      "sync-config",
      "match-config",
      "kenmei-data",
      "saved-match-results",
      "pending-manga",
      "auth-token",
      "theme-preferences",
      "anilist-credentials",
      "app-version",
      "last-sync-date",
    ];
    return [...new Set([...localKeys, ...electronSpecificKeys])];
  };

  // Process a single electron store item
  const processElectronStoreItem = async (
    key: string,
  ): Promise<StorageItem | null> => {
    try {
      const value = await globalThis.electronStore.getItem(key);
      if (value === null || value === undefined) return null;

      const str = typeof value === "string" ? value : JSON.stringify(value);
      const { type, size } = getValueInfo(str);
      return { key, value: str, type, size };
    } catch (error) {
      console.warn(`Failed to get electron store item "${key}":`, error);
      return null;
    }
  };

  // Load electron store items (using localStorage keys as reference)
  const loadElectronStoreItems = async () => {
    if (!globalThis.electronStore) return;

    try {
      const items: StorageItem[] = [];
      const keysToCheck = getAllKeysToCheck();

      for (const key of keysToCheck) {
        const item = await processElectronStoreItem(key);
        if (item) {
          items.push(item);
        }
      }

      items.sort((a, b) => a.key.localeCompare(b.key));
      setElectronStoreItems(items);
    } catch (error) {
      console.error("Failed to load electron store items:", error);
      toast.error("Failed to load electron store items.");
    }
  };

  const refreshData = async () => {
    setIsLoading(true);
    try {
      loadLocalStorageItems();
      await loadElectronStoreItems();
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void refreshData();
  }, []);

  const saveEditedItem = async () => {
    if (!editingItem) return;

    try {
      if (editingItem.isElectron) {
        if (globalThis.electronStore) {
          await globalThis.electronStore.setItem(
            editingItem.key,
            editingItem.value,
          );

          // Automatically sync to localStorage and cache (following storage precedence behavior)
          localStorage.setItem(editingItem.key, editingItem.value);
          storageCache[editingItem.key] = editingItem.value;

          toast.success(
            "Electron store item updated successfully. localStorage and cache automatically synced.",
          );
        } else {
          toast.error("Electron store bridge unavailable.");
        }
      } else {
        localStorage.setItem(editingItem.key, editingItem.value);
        toast.success("localStorage item updated successfully.");
      }

      setEditingItem(null);
      await refreshData();
    } catch (error) {
      console.error("Failed to save item:", error);
      toast.error("Failed to save item.");
    }
  };

  const addNewItem = async () => {
    if (!newItem?.key?.trim()) return;

    try {
      if (newItem.isElectron) {
        if (globalThis.electronStore) {
          await globalThis.electronStore.setItem(newItem.key, newItem.value);

          // Automatically sync to localStorage and cache (following storage precedence behavior)
          localStorage.setItem(newItem.key, newItem.value);
          storageCache[newItem.key] = newItem.value;

          toast.success(
            "New electron store item added successfully. localStorage and cache automatically synced.",
          );
        } else {
          toast.error("Electron store bridge unavailable.");
        }
      } else {
        localStorage.setItem(newItem.key, newItem.value);
        toast.success("New localStorage item added successfully.");
      }

      setNewItem(null);
      await refreshData();
    } catch (error) {
      console.error("Failed to add item:", error);
      toast.error("Failed to add new item.");
    }
  };

  const deleteItem = async (key: string, isElectron: boolean) => {
    try {
      if (isElectron) {
        if (globalThis.electronStore) {
          await globalThis.electronStore.removeItem(key);

          // Automatically sync deletion to localStorage and cache (following storage precedence behavior)
          localStorage.removeItem(key);
          delete storageCache[key];

          toast.success(
            "Electron store item deleted successfully. localStorage and cache automatically synced.",
          );
        } else {
          toast.error("Electron store bridge unavailable.");
        }
      } else {
        localStorage.removeItem(key);
        toast.success("localStorage item deleted successfully.");
      }

      await refreshData();
    } catch (error) {
      console.error("Failed to delete item:", error);
      toast.error("Failed to delete item.");
    }
  };

  // Export/Import helpers
  const exportItems = (items: StorageItem[], filename: string) => {
    const blob = new Blob([JSON.stringify(items, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const onImportJson = async (file: File, isElectron: boolean) => {
    try {
      const text = await file.text();
      const parsed = tryParseJSON(text);
      if (!parsed.ok || !Array.isArray(parsed.data))
        throw new Error("Invalid import format: expected array");

      type ImportEntry = { key: string; value?: unknown };
      let applied = 0;
      for (const entry of parsed.data as ImportEntry[]) {
        if (!entry || typeof entry.key !== "string") continue;
        const value =
          typeof entry.value === "string"
            ? entry.value
            : JSON.stringify(entry.value);
        if (isElectron) {
          if (globalThis.electronStore) {
            await globalThis.electronStore.setItem(entry.key, value);

            // Automatically sync to localStorage and cache (following storage precedence behavior)
            localStorage.setItem(entry.key, value);
            storageCache[entry.key] = value;

            applied++;
          }
        } else {
          localStorage.setItem(entry.key, value);
          applied++;
        }
      }
      toast.success(
        `Imported ${applied} items${isElectron ? ". localStorage and cache automatically synced." : ""}`,
      );
      await refreshData();
    } catch (e) {
      const err = e as { message?: string };
      toast.error(err?.message || "Import failed");
    }
  };

  // Copy to clipboard helper
  const handleCopyValue = (value: string) => {
    navigator.clipboard
      .writeText(value)
      .then(() => toast.success("Copied value"))
      .catch(() => toast.error("Failed to copy value"));
  };

  // Filters
  const filterItems = (items: StorageItem[]) => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (it) =>
        it.key.toLowerCase().includes(q) ||
        (searchInValues && it.value.toLowerCase().includes(q)),
    );
  };

  const renderStorageTable = (
    items: StorageItem[],
    isElectron: boolean,
    title: string,
    icon: React.ReactNode,
  ) => {
    const filtered = filterItems(items);

    return (
      <Card className="border-border/60 bg-background/90 flex h-full max-h-[40vh] flex-col border pb-6 pt-0 shadow-md backdrop-blur-sm">
        <CardHeader className="border-border/60 bg-muted/10 flex-shrink-0 border-b px-5 py-4">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              {icon}
              {title}
              <Badge variant="outline">
                {searchQuery
                  ? `${filtered.length}/${items.length}`
                  : `${items.length}`}{" "}
                items
              </Badge>
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setNewItem({ key: "", value: "", isElectron })}
              >
                <Plus className="mr-1 h-4 w-4" /> Add
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  exportItems(
                    items,
                    `${isElectron ? "electron" : "local"}-storage.json`,
                  )
                }
              >
                <Download className="mr-1 h-4 w-4" /> Export
              </Button>
              <label className="inline-flex items-center">
                <input
                  type="file"
                  accept="application/json"
                  className="hidden"
                  onChange={(e) =>
                    e.target.files &&
                    onImportJson(e.target.files[0], isElectron)
                  }
                />
                <Button asChild variant="outline" size="sm">
                  <span>
                    <Upload className="mr-1 h-4 w-4" /> Import
                  </span>
                </Button>
              </label>
            </div>
          </div>
        </CardHeader>
        <CardContent className="min-h-0 flex-1 overflow-hidden p-0">
          <ScrollArea type="always" className="h-full max-h-[420px]">
            <div className="space-y-3 p-4">
              {filtered.length === 0 ? (
                <div className="text-muted-foreground py-8 text-center">
                  {searchQuery
                    ? "No items match your search"
                    : "No items found"}
                </div>
              ) : (
                filtered.map((item) => (
                  <div
                    key={item.key}
                    className="border-border/50 bg-muted/10 hover:border-primary/40 hover:bg-primary/5 group rounded-xl border transition-all"
                  >
                    <div className="flex items-center justify-between gap-3 p-4">
                      <div className="min-w-0 flex-1">
                        <div className="mb-1 flex flex-wrap items-center gap-2">
                          <code className="bg-background/80 rounded px-1.5 font-mono text-sm shadow-sm">
                            {highlight(item.key, searchQuery)}
                          </code>
                          <TypeBadge type={item.type} />
                          <span className="text-muted-foreground text-xs">
                            {formatSize(item.size)}
                          </span>
                        </div>
                        <div className="text-muted-foreground break-all font-mono text-sm leading-relaxed">
                          <OverviewValue value={item.value} maxChars={160} />
                        </div>
                      </div>
                      <div className="ml-2 flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleCopyValue(item.value)}
                          aria-label="Copy value"
                          title="Copy value"
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            setEditingItem({
                              key: item.key,
                              value: item.value,
                              isElectron,
                            })
                          }
                          aria-label="Edit item"
                          title="Edit item"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              aria-label="Delete item"
                              title="Delete item"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>
                                Delete Storage Item
                              </AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to delete the key &ldquo;
                                {item.key}&rdquo;? This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => deleteItem(item.key, isElectron)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    );
  };

  const jsonValidity = useMemo(() => {
    if (!editingItem) return null;
    return tryParseJSON(editingItem.value);
  }, [editingItem]);

  const editingItemType = useMemo(() => {
    if (!editingItem) return "string";
    return getValueInfo(editingItem.value).type;
  }, [editingItem]);

  const storageStats = useMemo(() => {
    const localCount = localStorageItems.length;
    const electronCount = electronStoreItems.length;
    const localSize = localStorageItems.reduce(
      (acc, item) => acc + item.size,
      0,
    );
    const electronSize = electronStoreItems.reduce(
      (acc, item) => acc + item.size,
      0,
    );
    const uniqueKeys = new Set([
      ...localStorageItems.map((item) => item.key),
      ...electronStoreItems.map((item) => item.key),
    ]);

    return {
      local: { count: localCount, size: localSize },
      electron: { count: electronCount, size: electronSize },
      total: {
        count: uniqueKeys.size,
        size: localSize + electronSize,
      },
    };
  }, [localStorageItems, electronStoreItems]);

  const statCards = useMemo(
    () => [
      {
        id: "local",
        label: "localStorage",
        count: storageStats.local.count,
        size: storageStats.local.size,
        accent: "from-sky-500/25 via-blue-500/10 to-transparent",
      },
      {
        id: "electron",
        label: "Electron Store",
        count: storageStats.electron.count,
        size: storageStats.electron.size,
        accent: "from-purple-500/25 via-fuchsia-500/10 to-transparent",
      },
      {
        id: "total",
        label: "Merged footprint",
        count: storageStats.total.count,
        size: storageStats.total.size,
        accent: "from-emerald-500/20 via-teal-500/10 to-transparent",
      },
    ],
    [storageStats],
  );

  return (
    <>
      <div className="border-border/60 bg-background/95 relative mt-2 overflow-hidden rounded-3xl border shadow-xl backdrop-blur">
        <div className="from-primary/10 pointer-events-none absolute inset-0 bg-gradient-to-br via-blue-500/10 to-transparent" />
        <div className="bg-primary/20 pointer-events-none absolute -right-24 top-1/2 h-96 w-96 -translate-y-1/2 rounded-full blur-[120px]" />
        <div className="relative z-10 flex flex-col gap-6 p-6 md:p-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="relative w-full sm:min-w-[240px]">
              <Search className="text-muted-foreground pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
              <Input
                placeholder="Search by key or value…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="border-border/60 bg-background/80 w-full rounded-full pl-9 pr-4 text-sm shadow-inner"
              />
            </div>
            <div className="flex items-center justify-end gap-3">
              <div className="text-muted-foreground flex items-center gap-2 text-xs">
                <Switch
                  id="search-values-toggle"
                  checked={searchInValues}
                  onCheckedChange={(checked) =>
                    setSearchInValues(Boolean(checked))
                  }
                  aria-labelledby="search-values-label"
                />
                <span id="search-values-label" className="font-medium">
                  Search values
                </span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={refreshData}
                disabled={isLoading}
                className="border-primary/40 bg-primary/10 text-primary hover:bg-primary/20 shadow-sm transition-colors"
              >
                <RefreshCw
                  className={`mr-1 h-4 w-4 ${isLoading ? "animate-spin" : ""}`}
                />
                Refresh
              </Button>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            {statCards.map((stat) => (
              <div
                key={stat.id}
                className="border-border/60 bg-background/90 relative overflow-hidden rounded-2xl border p-4 shadow-inner"
              >
                <div
                  className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${stat.accent}`}
                />
                <div className="relative z-10 space-y-2">
                  <p className="text-muted-foreground text-xs uppercase tracking-wide">
                    {stat.label}
                  </p>
                  <div className="font-mono text-2xl font-semibold">
                    {stat.count.toLocaleString()}
                    <span className="text-muted-foreground ml-2 text-sm font-medium">
                      keys
                    </span>
                  </div>
                  <p className="text-muted-foreground text-xs">
                    {formatSize(stat.size)} total footprint
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-start gap-3 rounded-2xl border border-amber-200/80 bg-amber-50/70 p-4 text-sm shadow-sm dark:border-amber-800/70 dark:bg-amber-950/40">
            <div className="mt-1 flex items-center justify-center rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-300">
              <svg
                className="m-1 h-4 w-4"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div className="text-muted-foreground space-y-2">
              <p className="font-medium text-amber-800 dark:text-amber-200">
                Storage precedence
              </p>
              <p>
                <strong>Electron Store overrides localStorage.</strong> Edits
                sync downstream automatically, so prefer modifying the Electron
                layer when possible.
              </p>
              <p className="text-xs">
                📚 Learn more in{" "}
                <a
                  href="https://github.com/RLAlpha49/Anilist-Manga-Updater/blob/master/docs/guides/STORAGE_IMPLEMENTATION.md"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline decoration-dotted underline-offset-4 hover:text-amber-600 dark:hover:text-amber-300"
                >
                  STORAGE_IMPLEMENTATION.md
                </a>
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 flex min-h-0 flex-1 flex-col">
        <Tabs defaultValue="localStorage" className="min-h-0 flex-1 gap-4">
          <TabsList className="bg-muted/40 grid w-full grid-cols-2 gap-2 rounded-full p-1 text-sm font-medium">
            <TabsTrigger
              value="localStorage"
              className="data-[state=active]:bg-background rounded-full data-[state=active]:shadow-md"
            >
              localStorage
            </TabsTrigger>
            <TabsTrigger
              value="electronStore"
              className="data-[state=active]:bg-background rounded-full data-[state=active]:shadow-md"
            >
              Electron Store
            </TabsTrigger>
          </TabsList>

          <TabsContent
            value="localStorage"
            className="min-h-[480px] flex-1 pb-4"
          >
            {renderStorageTable(
              localStorageItems,
              false,
              "localStorage",
              <HardDrive className="h-4 w-4" />,
            )}
          </TabsContent>

          <TabsContent
            value="electronStore"
            className="min-h-[480px] flex-1 pb-4"
          >
            {renderStorageTable(
              electronStoreItems,
              true,
              "Electron Store",
              <Database className="h-4 w-4" />,
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Edit Item Dialog */}
      {editingItem && (
        <Dialog open={!!editingItem} onOpenChange={() => setEditingItem(null)}>
          <DialogContent className="!max-w-2xl">
            <DialogHeader>
              <DialogTitle>Edit Storage Item</DialogTitle>
              <DialogDescription>
                Modify the value for key:{" "}
                <code className="font-mono">{editingItem.key}</code>
                {editingItem.isElectron && (
                  <div className="mt-2 text-sm text-blue-600 dark:text-blue-400">
                    💡 Electron store changes will automatically sync to
                    localStorage and cache
                  </div>
                )}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="edit-key" className="pb-2">
                  Key
                </Label>
                <div>
                  <Input
                    id="edit-key"
                    value={editingItem.key}
                    disabled
                    className="font-mono"
                  />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="edit-value">Value</Label>
                  <div className="flex items-center gap-3">
                    {editingItemType === "object" && (
                      <>
                        <div className="text-muted-foreground text-xs">
                          {jsonValidity &&
                            (jsonValidity.ok ? (
                              <span className="text-green-600">JSON valid</span>
                            ) : (
                              <span className="text-red-600">
                                {jsonValidity.error}
                              </span>
                            ))}
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            if (!editingItem) return;
                            const formatted = tryFormatJSON(editingItem.value);
                            if (!formatted) {
                              toast.error("Value is not valid JSON");
                              return;
                            }
                            setEditingItem({
                              ...editingItem,
                              value: formatted,
                            });
                            toast.success("Formatted JSON");
                          }}
                        >
                          Format JSON
                        </Button>
                      </>
                    )}
                  </div>
                </div>
                <div className="pt-2">
                  <div>
                    <Textarea
                      id="edit-value"
                      value={editingItem.value}
                      onChange={(e) =>
                        setEditingItem({
                          ...editingItem,
                          value: e.target.value,
                        })
                      }
                      className="h-64 w-full max-w-xl resize-y overflow-auto whitespace-pre-wrap break-words font-mono"
                      style={{ resize: "none" }}
                      placeholder="Enter value (JSON or string)..."
                    />
                  </div>
                </div>
              </div>
              <div className="flex w-full justify-end gap-2">
                <Button variant="outline" onClick={() => setEditingItem(null)}>
                  <X className="mr-1 h-4 w-4" /> Cancel
                </Button>
                <Button onClick={saveEditedItem}>
                  <Save className="mr-1 h-4 w-4" /> Save
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Add New Item Dialog */}
      {newItem && (
        <Dialog open={!!newItem} onOpenChange={() => setNewItem(null)}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>Add New Storage Item</DialogTitle>
              <DialogDescription>
                Add a new item to{" "}
                {newItem.isElectron ? "Electron Store" : "localStorage"}
                {newItem.isElectron && (
                  <div className="mt-2 text-sm text-blue-600 dark:text-blue-400">
                    💡 Electron store items will automatically sync to
                    localStorage and cache
                  </div>
                )}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="new-key">Key</Label>
                <Input
                  id="new-key"
                  value={newItem.key}
                  onChange={(e) =>
                    setNewItem({ ...newItem, key: e.target.value })
                  }
                  className="font-mono"
                  placeholder="Enter key..."
                />
              </div>
              <div>
                <Label htmlFor="new-value">Value</Label>
                <Textarea
                  id="new-value"
                  value={newItem.value}
                  onChange={(e) =>
                    setNewItem({ ...newItem, value: e.target.value })
                  }
                  className="h-64 resize-y overflow-y-auto font-mono"
                  style={{ width: "100%", maxWidth: "100%" }}
                  placeholder="Enter value (JSON or string)..."
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setNewItem(null)}>
                  <X className="mr-1 h-4 w-4" /> Cancel
                </Button>
                <Button onClick={addNewItem} disabled={!newItem.key.trim()}>
                  <Plus className="mr-1 h-4 w-4" /> Add Item
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
