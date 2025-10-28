/**
 * Backup IPC channel names
 * Defines channel constants for backup-related IPC communication between renderer and main processes
 *
 * @source
 */

export const BACKUP_CHANNELS = {
  /**
   * Get schedule config
   * @request none
   * @response {BackupScheduleConfig} Current backup schedule configuration
   * @errors none (returns defaults on error)
   */
  GET_SCHEDULE_CONFIG: "backup:get-schedule-config",

  /**
   * Set schedule config and restart scheduler
   * @request {BackupScheduleConfig} New configuration
   * @response {{ success: boolean; error?: string }} Success status with optional error message
   * @errors "Backup location must be a string" | config validation errors
   */
  SET_SCHEDULE_CONFIG: "backup:set-schedule-config",

  /**
   * Get currently configured backup location
   * @request none
   * @response {{ success: boolean; data?: string; error?: string }} Backup location path
   * @errors none (returns default on error)
   */
  GET_BACKUP_LOCATION: "backup:get-backup-location",

  /**
   * Set a new backup location directory
   * @request {string} Full path to backup directory
   * @response {{ success: boolean; error?: string; code?: string }} Success or error with code (ENOENT, EACCES, etc.)
   * @errors "Invalid backup location" | permission errors | "Directory does not exist"
   */
  SET_BACKUP_LOCATION: "backup:set-backup-location",

  /**
   * Open backup location in system file browser
   * @request none
   * @response {{ success: boolean; error?: string }} Success status
   * @errors Error message if open fails
   */
  OPEN_BACKUP_LOCATION: "backup:open-backup-location",

  /**
   * List all backup files in configured location
   * @request none
   * @response {{ success: boolean; data?: Array<{name, timestamp, size}>; error?: string }}
   * @errors "Invalid backup location"
   */
  LIST_LOCAL_BACKUPS: "backup:list-local-backups",

  /**
   * Read a backup file's contents
   * @request {string} Backup filename (basename only, e.g. "backup-1234567890.json")
   * @response {{ success: boolean; data?: string; error?: string }} File contents as JSON string
   * @errors "Invalid filename" | "File not found" | size limit exceeded
   */
  READ_LOCAL_BACKUP: "backup:read-local-backup",

  /**
   * Restore application data from a backup file
   * @request {{ filename: string; options?: {merge?: boolean} }} Backup file and restore options
   * @response {{ success: boolean; errors?: string[] }} Success with optional error list
   * @errors restoration errors by data store type
   */
  RESTORE_LOCAL_BACKUP: "backup:restore-local-backup",

  /**
   * Delete a backup file
   * @request {string} Backup filename to delete
   * @response {{ success: boolean; error?: string }} Success status
   * @errors "Invalid filename" | "File not found" | permission errors
   */
  DELETE_BACKUP: "backup:delete-backup",

  /**
   * Manually trigger a backup outside scheduler
   * @request none
   * @response {{ success: boolean; backupId?: string; error?: string }}
   * @errors backup creation errors
   */
  TRIGGER_BACKUP: "backup:trigger-backup",

  /**
   * Create immediate backup (alias for TRIGGER_BACKUP)
   * @request none
   * @response {{ success: boolean; backupId?: string; error?: string }}
   * @errors backup creation errors
   */
  CREATE_NOW: "backup:create-now",

  /**
   * Get current backup scheduler status
   * @request none
   * @response {{ isRunning: boolean; lastBackup: number|null; nextBackup: number|null }}
   * @errors none (returns null timestamps on error)
   */
  GET_BACKUP_STATUS: "backup:get-backup-status",

  /**
   * Get backup history entries
   * @request none
   * @response {BackupHistoryEntry[]} Array of backup history entries
   * @errors none (returns empty array on error)
   */
  GET_BACKUP_HISTORY: "backup:get-backup-history",

  /**
   * Clear all backup history
   * @request none
   * @response {{ success: boolean; error?: string }}
   * @errors history clear errors
   */
  CLEAR_HISTORY: "backup:clear-history",

  /**
   * Event: Backup creation completed successfully
   * @event {{ backupId: string; timestamp: number }} Backup metadata
   */
  ON_BACKUP_COMPLETE: "backup:on-backup-complete",

  /**
   * Event: Backup operation encountered an error
   * @event {string} Error message
   */
  ON_BACKUP_ERROR: "backup:on-backup-error",

  /**
   * Event: Backup history or file list changed (deletion, rotation, or history clear)
   * @event undefined (no payload, just signals change)
   */
  ON_HISTORY_UPDATED: "backup:on-history-updated",

  /**
   * Event: Backup scheduler status changed (after config update, manual trigger, or schedule fire)
   * @event {{ isRunning: boolean; lastBackup: number|null; nextBackup: number|null }} Status update
   */
  ON_STATUS_CHANGED: "backup:on-status-changed",
} as const;
