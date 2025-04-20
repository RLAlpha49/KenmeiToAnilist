/**
 * @packageDocumentation
 * @module tailwind
 * @description Tailwind utility helpers for merging and composing class names.
 */

import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merges and composes class names using clsx and tailwind-merge.
 *
 * @param inputs - The class values to merge.
 * @returns A single merged class name string.
 * @example
 * ```ts
 * cn('p-2', condition && 'bg-red-500', 'text-center');
 * // => 'p-2 bg-red-500 text-center' (if condition is true)
 * @source
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
