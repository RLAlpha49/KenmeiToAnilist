/**
 * @packageDocumentation
 * @module ipc-types
 * @description Shared TypeScript types for IPC communication between main and renderer processes.
 */

/**
 * Result type for shell operations.
 * Returns errors as strings instead of Error objects to prevent stack trace exposure to renderer.
 * @property success - Whether the operation succeeded.
 * @property error - Error message if operation failed.
 * @source
 */
export interface ShellOperationResult {
  success: boolean;
  error?: string;
}
