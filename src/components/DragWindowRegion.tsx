/**
 * @packageDocumentation
 * @module DragWindowRegion
 * @description Provides a draggable window region with window control buttons for Electron apps.
 */
import {
  closeWindow,
  maximizeWindow,
  minimizeWindow,
} from "@/helpers/window_helpers";
import React, { type ReactNode } from "react";

/**
 * Props for the DragWindowRegion component.
 *
 * @property title - Optional title to display in the draggable region (can be a string or ReactNode)
 *
 * @internal
 * @source
 */
export interface DragWindowRegionProps {
  title?: ReactNode;
}

/**
 * Provides a draggable window region with minimize, maximize, and close buttons for Electron windows.
 *
 * @param title - Optional title to display in the draggable region (can be a string or ReactNode)
 * @returns A React element containing the draggable region and window control buttons
 * @example
 * ```tsx
 * <DragWindowRegion title="My App" />
 * ```
 * @source
 */
export default function DragWindowRegion({
  title,
}: Readonly<DragWindowRegionProps>) {
  return (
    <div className="flex w-screen items-stretch justify-between">
      <div className="draglayer w-full">
        {title && (
          <div className="flex flex-1 p-2 text-xs whitespace-nowrap text-gray-400 select-none">
            {title}
          </div>
        )}
      </div>
      <WindowButtons />
    </div>
  );
}

/**
 * Renders the window control buttons (minimize, maximize, close) for the Electron globalThis.
 *
 * @returns A React element with window control buttons
 * @internal
 * @source
 */
export function WindowButtons() {
  return (
    <div className="flex">
      <button
        title="Minimize"
        type="button"
        className="p-2 hover:bg-slate-300"
        onClick={minimizeWindow}
      >
        <svg
          aria-hidden="true"
          width="12"
          height="12"
          viewBox="0 0 12 12"
          aria-label="Minimize window"
        >
          <rect fill="currentColor" width="10" height="1" x="1" y="6"></rect>
        </svg>
      </button>
      <button
        title="Maximize"
        type="button"
        className="p-2 hover:bg-slate-300"
        onClick={maximizeWindow}
      >
        <svg
          aria-label="Maximize window"
          width="12"
          height="12"
          viewBox="0 0 12 12"
        >
          <rect
            width="9"
            height="9"
            x="1.5"
            y="1.5"
            fill="none"
            stroke="currentColor"
          ></rect>
        </svg>
      </button>
      <button
        type="button"
        title="Close"
        className="p-2 hover:bg-red-300"
        onClick={closeWindow}
      >
        <svg
          aria-label="Close window"
          width="12"
          height="12"
          viewBox="0 0 12 12"
        >
          <polygon
            fill="currentColor"
            fillRule="evenodd"
            points="11 1.576 6.583 6 11 10.424 10.424 11 6 6.583 1.576 11 1 10.424 5.417 6 1 1.576 1.576 1 6 5.417 10.424 1"
          ></polygon>
        </svg>
      </button>
    </div>
  );
}
