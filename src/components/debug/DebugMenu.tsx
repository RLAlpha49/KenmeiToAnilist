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

          {/* Storage Behavior Notice */}
          <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950/20">
            <div className="flex items-start gap-2">
              <div className="mt-0.5 flex-shrink-0">
                <svg
                  className="h-4 w-4 text-amber-600 dark:text-amber-400"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <div className="text-sm">
                <p className="mb-1 font-medium text-amber-800 dark:text-amber-200">
                  Storage Behavior
                </p>
                <p className="text-amber-700 dark:text-amber-300">
                  <strong>Electron Store takes precedence.</strong> Changes to
                  electron store automatically sync to localStorage and cache.
                  Direct localStorage edits may be overwritten. Both stores
                  should contain the same data in normal operation.
                </p>
                <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
                  📚 For detailed technical documentation, see{" "}
                  <a
                    href="https://github.com/RLAlpha49/Anilist-Manga-Updater/blob/master/docs/guides/STORAGE_IMPLEMENTATION.md"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline hover:text-amber-500 dark:hover:text-amber-300"
                  >
                    STORAGE_IMPLEMENTATION.md
                  </a>
                </p>
              </div>
            </div>
          </div>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col px-6 pb-6">
          <StorageDebugger />
        </div>
      </DialogContent>
    </Dialog>
  );
}
