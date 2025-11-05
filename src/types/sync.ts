/**
 * @packageDocumentation
 * @module Types/Sync
 * @description Shared type definitions for sync operations and metrics.
 */

/**
 * Synchronization metrics tracking sync performance and status.
 *
 * @property lastSyncTime - ISO timestamp of the most recent sync operation, or null if never synced.
 * @property entriesSynced - Number of manga entries successfully synced in the last operation.
 * @property failedSyncs - Number of entries that failed during the last sync operation.
 * @property totalSyncs - Cumulative count of all sync operations performed.
 * @source
 */
export interface SyncStats {
  readonly lastSyncTime: string | null;
  readonly entriesSynced: number;
  readonly failedSyncs: number;
  readonly totalSyncs: number;
}
