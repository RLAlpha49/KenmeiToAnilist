/**
 * @packageDocumentation
 * @module DebugMenu
 * @description Debug menu component for viewing and editing electron store and localStorage values.
 */

import React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Bug } from "lucide-react";
import { StorageDebugger } from "./StorageDebugger";

interface DebugMenuProps {
  isOpen: boolean;
  onClose: () => void;
}

export function DebugMenu({ isOpen, onClose }: Readonly<DebugMenuProps>) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-h-[70vh] min-h-[50vh] !w-3xl !max-w-full p-0">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle className="flex items-center gap-2">
            <Bug className="h-5 w-5" /> Debug Menu
          </DialogTitle>
          <DialogDescription>
            View and edit electron store and localStorage values. Use with
            caution.
          </DialogDescription>
        </DialogHeader>
        <div className="flex min-h-0 flex-1 flex-col px-6 pb-6">
          <StorageDebugger />
        </div>
      </DialogContent>
    </Dialog>
  );
}
