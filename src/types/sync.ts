/**
 * @packageDocumentation
 * @module Types/Sync
 * @description Shared type definitions for sync operations and metrics.
 */

/**
 * Synchronization metrics tracking sync performance and status.
 * @remarks
 * - `lastSyncTime` - ISO timestamp of the most recent sync operation, or null if never synced.
 * - `entriesSynced` - Number of manga entries successfully synced in the last operation.
 * - `failedSyncs` - Number of entries that failed during the last sync operation.
 * - `totalSyncs` - Cumulative count of all sync operations performed.
 */
export interface SyncStats {
  readonly lastSyncTime: string | null;
  readonly entriesSynced: number;
  readonly failedSyncs: number;
  readonly totalSyncs: number;
}
