/**
 * @packageDocumentation
 * @module ipc_types
 * @description Shared TypeScript types for IPC communication between main and renderer processes.
 */

/**
 * Result type for shell operations (e.g., opening external URLs).
 * Used to safely return error messages as strings instead of raw Error objects,
 * preventing exposure of stack traces or sensitive details to the renderer process.
 * @source
 */
export interface ShellOperationResult {
  success: boolean;
  error?: string;
}
