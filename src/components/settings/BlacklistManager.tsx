import React, { useState, useCallback } from "react";
import { toast } from "sonner";
import { Plus, Trash2, Edit2, Ban } from "lucide-react";
import {
  getMatchConfig,
  saveMatchConfig,
  type BlacklistConfig,
} from "@/utils/storage";
import { useDebugActions } from "@/contexts/debug-context";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Switch } from "@/components/ui/Switch";
import { Badge } from "@/components/ui/Badge";
import { CollapsibleChevron } from "@/components/ui/CollapsibleChevron";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/Dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/AlertDialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/Table";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/Collapsible";

function BlacklistManagerComponent(): React.JSX.Element {
  const { recordEvent } = useDebugActions();
  const [isCollapsibleOpen, setIsCollapsibleOpen] = useState(false);

  const [blacklist, setBlacklist] = useState<BlacklistConfig>(() => {
    const config = getMatchConfig();
    return config.blacklist || { enabled: true, items: [] };
  });

  const [isAdding, setIsAdding] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [deleteConfirmIndex, setDeleteConfirmIndex] = useState<number | null>(
    null,
  );
  const [titleForm, setTitleForm] = useState("");

  const handleSave = useCallback(() => {
    if (!titleForm.trim()) {
      toast.error("Title cannot be empty");
      return;
    }

    const matchConfig = getMatchConfig();
    const updatedBlacklist = { ...blacklist };
    const newItems = [...updatedBlacklist.items];

    if (editingIndex === null) {
      // Check for duplicates
      if (
        newItems.some(
          (item) => item.title.toLowerCase() === titleForm.trim().toLowerCase(),
        )
      ) {
        toast.error("This title is already in the blacklist");
        return;
      }
      newItems.push({ title: titleForm.trim(), enabled: true });
      toast.success("Title added to blacklist");
    } else {
      newItems[editingIndex] = {
        ...newItems[editingIndex],
        title: titleForm.trim(),
      };
      toast.success("Blacklist item updated");
    }

    updatedBlacklist.items = newItems;
    saveMatchConfig({ ...matchConfig, blacklist: updatedBlacklist });
    setBlacklist(updatedBlacklist);

    recordEvent({
      type: "settings.match-config-update",
      message:
        editingIndex === null
          ? "Added blacklist item"
          : "Updated blacklist item",
      level: "info",
      metadata: {
        changed_field: "blacklist",
        config: updatedBlacklist,
      },
    });

    setIsAdding(false);
    setEditingIndex(null);
    setTitleForm("");
  }, [blacklist, editingIndex, titleForm, recordEvent]);

  const handleDelete = useCallback(() => {
    if (deleteConfirmIndex === null) return;

    const matchConfig = getMatchConfig();
    const updatedBlacklist = { ...blacklist };
    const newItems = updatedBlacklist.items.filter(
      (_, i) => i !== deleteConfirmIndex,
    );

    updatedBlacklist.items = newItems;
    saveMatchConfig({ ...matchConfig, blacklist: updatedBlacklist });
    setBlacklist(updatedBlacklist);
    toast.success("Title removed from blacklist");

    recordEvent({
      type: "settings.match-config-update",
      message: "Removed blacklist item",
      level: "info",
      metadata: {
        changed_field: "blacklist",
        config: updatedBlacklist,
      },
    });

    setDeleteConfirmIndex(null);
  }, [blacklist, deleteConfirmIndex, recordEvent]);

  const handleToggleItem = useCallback(
    (index: number, enabled: boolean) => {
      const matchConfig = getMatchConfig();
      const updatedBlacklist = { ...blacklist };
      const newItems = [...updatedBlacklist.items];
      newItems[index] = { ...newItems[index], enabled };

      updatedBlacklist.items = newItems;
      saveMatchConfig({ ...matchConfig, blacklist: updatedBlacklist });
      setBlacklist(updatedBlacklist);
    },
    [blacklist],
  );

  const handleToggleGlobal = useCallback(
    (enabled: boolean) => {
      const matchConfig = getMatchConfig();
      const updatedBlacklist = { ...blacklist, enabled };
      saveMatchConfig({ ...matchConfig, blacklist: updatedBlacklist });
      setBlacklist(updatedBlacklist);
      toast.success(enabled ? "Blacklist enabled" : "Blacklist disabled");

      recordEvent({
        type: "settings.match-config-update",
        message: enabled ? "Enabled blacklist" : "Disabled blacklist",
        level: "info",
        metadata: {
          changed_field: "blacklist",
          config: updatedBlacklist,
        },
      });
    },
    [blacklist, recordEvent],
  );

  return (
    <Collapsible
      open={isCollapsibleOpen}
      onOpenChange={setIsCollapsibleOpen}
      className="space-y-4"
    >
      <CollapsibleTrigger asChild>
        <Button
          variant="outline"
          className="bg-muted/40 hover:bg-muted/60 mb-0! w-full justify-between border-2"
        >
          <span className="flex items-center gap-2">
            <Ban className="h-5 w-5 text-red-500" />
            <span className="text-base font-semibold">Blacklisted Titles</span>
            <Badge variant="secondary" className="ml-2">
              {blacklist.items.filter((i) => i.enabled).length} Active
            </Badge>
          </span>
          <CollapsibleChevron isExpanded={isCollapsibleOpen} />
        </Button>
      </CollapsibleTrigger>

      <CollapsibleContent className="m-6 space-y-4">
        <div className="bg-muted/40 space-y-6 rounded-xl border p-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold">Blacklist Management</h2>
              <p className="text-muted-foreground text-sm">
                Manage titles that should be excluded from search results
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Enable Blacklist</span>
              <Switch
                checked={blacklist.enabled}
                onCheckedChange={handleToggleGlobal}
              />
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex justify-end">
              <Button
                onClick={() => {
                  setIsAdding(true);
                  setTitleForm("");
                }}
                size="sm"
                variant="outline"
                disabled={!blacklist.enabled}
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Title
              </Button>
            </div>

            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead className="w-24">Enabled</TableHead>
                    <TableHead className="w-24">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {blacklist.items.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={3}
                        className="text-muted-foreground text-center"
                      >
                        No blacklisted titles.
                      </TableCell>
                    </TableRow>
                  ) : (
                    blacklist.items.map((item, index) => (
                      <TableRow
                        key={item.title}
                        className={blacklist.enabled ? "" : "opacity-50"}
                      >
                        <TableCell className="break-all font-medium">
                          {item.title}
                        </TableCell>
                        <TableCell>
                          <Switch
                            checked={item.enabled}
                            onCheckedChange={(checked) =>
                              handleToggleItem(index, checked)
                            }
                            disabled={!blacklist.enabled}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              onClick={() => {
                                setEditingIndex(index);
                                setTitleForm(item.title);
                              }}
                              size="icon"
                              variant="ghost"
                              aria-label="Edit title"
                              disabled={!blacklist.enabled}
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button
                              onClick={() => setDeleteConfirmIndex(index)}
                              size="icon"
                              variant="ghost"
                              aria-label="Delete title"
                              disabled={!blacklist.enabled}
                            >
                              <Trash2 className="text-destructive h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>
      </CollapsibleContent>

      <Dialog
        open={isAdding || editingIndex !== null}
        onOpenChange={(open) => {
          if (!open) {
            setIsAdding(false);
            setEditingIndex(null);
            setTitleForm("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingIndex === null
                ? "Add Blacklisted Title"
                : "Edit Blacklisted Title"}
            </DialogTitle>
            <DialogDescription>
              Enter the exact title of the manga to blacklist.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label htmlFor="title" className="text-sm font-medium">
                Title
              </label>
              <Input
                id="title"
                placeholder="e.g. One Piece"
                value={titleForm}
                onChange={(e) => setTitleForm(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsAdding(false);
                setEditingIndex(null);
                setTitleForm("");
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleSave}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={deleteConfirmIndex !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteConfirmIndex(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove from Blacklist?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove this title from the blacklist?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Collapsible>
  );
}

export const BlacklistManager = React.memo(BlacklistManagerComponent);
