/**
 * Backup IPC channel names for communication between renderer and main processes.
 * @source
 */

export const BACKUP_CHANNELS = {
  /** Retrieves current backup schedule configuration. @source */
  GET_SCHEDULE_CONFIG: "backup:get-schedule-config",

  /** Updates backup schedule configuration and restarts the scheduler. @source */
  SET_SCHEDULE_CONFIG: "backup:set-schedule-config",

  /** Retrieves the currently configured backup location path. @source */
  GET_BACKUP_LOCATION: "backup:get-backup-location",

  /** Sets a new backup location directory with validation. @source */
  SET_BACKUP_LOCATION: "backup:set-backup-location",

  /** Opens the backup location in the system file browser. @source */
  OPEN_BACKUP_LOCATION: "backup:open-backup-location",

  /** Lists all backup files in the configured backup location. @source */
  LIST_LOCAL_BACKUPS: "backup:list-local-backups",

  /** Reads a backup file's contents by filename. @source */
  READ_LOCAL_BACKUP: "backup:read-local-backup",

  /** Restores application data from a backup file with optional merge mode. @source */
  RESTORE_LOCAL_BACKUP: "backup:restore-local-backup",

  /** Deletes a specific backup file by filename. @source */
  DELETE_BACKUP: "backup:delete-backup",

  /** Manually triggers a backup outside the normal schedule. @source */
  TRIGGER_BACKUP: "backup:trigger-backup",

  /** Creates an immediate backup (alias for TRIGGER_BACKUP). @source */
  CREATE_NOW: "backup:create-now",

  /** Retrieves current backup scheduler status (running state and next backup time). @source */
  GET_BACKUP_STATUS: "backup:get-backup-status",

  /** Retrieves backup history entries. @source */
  GET_BACKUP_HISTORY: "backup:get-backup-history",

  /** Clears all backup history from the main process store. @source */
  CLEAR_HISTORY: "backup:clear-history",

  /** Event fired when backup creation completes successfully. @source */
  ON_BACKUP_COMPLETE: "backup:on-backup-complete",

  /** Event fired when a backup operation encounters an error. @source */
  ON_BACKUP_ERROR: "backup:on-backup-error",

  /** Event fired when backup history is updated (deletion, rotation, or clear). @source */
  ON_HISTORY_UPDATED: "backup:on-history-updated",

  /** Event fired when backup scheduler status changes. @source */
  ON_STATUS_CHANGED: "backup:on-status-changed",
} as const;
