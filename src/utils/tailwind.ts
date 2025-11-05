/**
 * @packageDocumentation
 * @module tailwind
 * @description Tailwind utility helpers for merging and composing class names.
 */

import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merges and composes class names using clsx and tailwind-merge; intelligently resolves Tailwind CSS conflicts.
 * @param inputs - The class values to merge and compose.
 * @returns Single merged class name string with conflicts resolved.
 * @source
 */
export function cn(...inputs: ClassValue[]) {
  // clsx flattens and filters inputs, twMerge resolves Tailwind class conflicts
  return twMerge(clsx(inputs));
}
