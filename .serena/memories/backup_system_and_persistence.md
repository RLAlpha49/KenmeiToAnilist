# Backup System & Automatic Persistence

## Overview

The backup system provides automatic scheduled backups with rotation, manual backup creation, file management, and full recovery capabilities. All operations are atomic and protected by a mutex to prevent corruption.

## Architecture

### BackupSystem Structure

**Location**: `src/helpers/ipc/backup/`

```text
backup/
├─ backup-listeners.ts    # Main IPC handler & orchestration
├─ backup-context.ts      # Context bridge exposure
├─ backup-channels.ts     # IPC channel constants
└─ types.ts              # Backup-related types
```

### Core Components

**Scheduler State Management**:

```typescript
interface SchedulerState {
  enabled: boolean;
  currentTimer?: NodeJS.Timeout;
  nextBackupTime?: number;
  isBackupInProgress: boolean;
  lastBackupResult?: {
    success: boolean;
    timestamp: number;
    reason?: string;
  };
}
```

**File Operations Mutex**: Ensures atomic backup operations, prevents race conditions

## Backup Locations

### Default Location

**Platform-Specific**:

- **Windows**: `%APPDATA%\KenmeiToAnilist\backups\`
- **macOS**: `~/Library/Application Support/KenmeiToAnilist/backups/`
- **Linux**: `~/.local/share/kenmeitoanilist/backups/`

**Retrieved via**: `getDefaultBackupLocation()`

### Custom Location Support

**User can change backup location**:

1. Update `BACKUP_LOCATION` in electron-store
2. System validates new path:
   - Must be absolute path
   - Must be accessible (read/write permissions)
   - Creates directory if doesn't exist
3. Future backups go to new location
4. Old backups remain in previous location (no migration)

**Validation**: `validateBackupLocationPath()` checks accessibility

## Scheduled Backups

### Schedule Configuration

**User-Configurable** (`src/utils/storage.ts`):

```typescript
interface BackupScheduleConfig {
  enabled: boolean;
  interval: BackupInterval; // "never", "hourly", "daily", "weekly"
  maxBackups: number; // 3-52, default 10
  autoDeleteOldest: boolean; // Automatic rotation
}

type BackupInterval = "never" | "hourly" | "daily" | "weekly";
```

**Stored in**: `BACKUP_SCHEDULE_CONFIG` storage key

### Scheduler Operation

**When enabled**:

1. **Calculate next backup time** from interval
2. **Set timer** to execute backup
3. **On timer fire**:
   - Perform backup
   - Record result
   - Schedule next backup
   - Handle errors gracefully

**If app crashes**:

- Next app launch recalculates next backup time
- Timer resumes from scratch
- No data loss (only missed 1 backup)

### Interval Calculations

**`calculateIntervalMs(interval)`**:

- `hourly`: 3,600,000 ms (1 hour)
- `daily`: 86,400,000 ms (24 hours)
- `weekly`: 604,800,000 ms (7 days)
- `never`: Timer never set

## Backup Operations

### Backup Data Collection

**`collectBackupData()`** gathers:

1. **User Data**:
   - Kenmei import data
   - Match results
   - Sync history
   - User configuration

2. **Metadata**:
   - Backup timestamp
   - App version
   - Export format version
   - Data checksums

3. **Statistics**:
   - Total entries
   - Sync stats
   - Import stats

**Data Format**: JSON with `BackupStoreSchema`

### File Management

**Backup Filename Format**:

```text
kenmeitoanilist-backup-YYYYMMDD-HHMMSS.json
```

**Example**: `kenmeitoanilist-backup-20251104-143022.json`

**File Structure**:

- Plain JSON (human-readable)
- Uncompressed (simple recovery)
- Atomic writes (write to temp, then rename)

### Atomic Backup Process

**`performBackupWithMutex()`**:

1. **Acquire mutex** (prevents concurrent backups)
2. **Collect data** (`collectBackupData()`)
3. **Write to temp file** (atomic operation)
4. **Rename to final name** (atomic filesystem operation)
5. **Update history** (`addBackupToStoredHistory()`)
6. **Perform rotation** (`performRotation()`)
7. **Release mutex**
8. **Emit status** (notify UI)

**Safety**: If process crashes during write, temp file left behind (cleaned on next startup)

### Rotation Logic

**`performRotation()`** when maxBackups exceeded:

1. **List all backups** by timestamp
2. **Sort by age** (oldest first)
3. **Delete oldest** backup files
4. **Update history** to match actual files
5. **Continue until** count ≤ maxBackups

**Reconciliation**: `reconcileStoredHistory()` syncs stored list with actual files

## Recovery

### Restore Process

**User-initiated via Settings**:

1. **Browse backup files** from backup location
2. **Select backup to restore**
3. **Confirm action** (destructive operation)
4. **Parse backup file** (validate JSON structure)
5. **Restore data** to electron-store
6. **Update UI** (refresh all state)
7. **Restart matching/sync** if needed

**Validation**: Backup must have correct format and required fields

### Backup History

**Stored in electron-store**:

```typescript
interface BackupHistory {
  backups: {
    filename: string;
    timestamp: number;
    size: number;
    appVersion?: string;
    dataVersion?: string;
  }[];
  totalBackups: number;
}
```

**Stored Key**: Custom key in main process storage

## Manual Backups

### Immediate Backup

**`createImmediateBackup()`**:

1. User clicks "Backup Now" button
2. System collects data
3. Creates timestamped file
4. Adds to history
5. Performs rotation (if configured)
6. Returns success/error to UI

**Non-blocking**: Progress shown in UI, doesn't freeze app

## Error Handling

### Error Types

**`handleBackupError(error, stage)`**:

- **Collection errors** - Can't read data (permissions)
- **Write errors** - Can't create file (disk full, permissions)
- **Rotation errors** - Can't delete old files
- **Schedule errors** - Timer issues (rare)

**Response**:

1. Log detailed error
2. Emit error event to UI
3. Continue without backup (don't crash)
4. Show user notification

### Graceful Degradation

**If backup fails**:

- App continues functioning normally
- User notified via toast notification
- No loss of unsaved data (app state intact)
- Can retry later with "Backup Now"

## IPC Integration

### Backup Channels

**Constants** (`src/helpers/ipc/backup/backup-channels.ts`):

- `backup:status-changed` - Emit when backup status changes
- `backup:backup-now` - Handle immediate backup request
- `backup:get-status` - Get current backup status
- `backup:get-history` - Get backup history
- `backup:restore` - Restore from backup file
- `backup:update-schedule` - Update schedule config
- `backup:get-schedule` - Get current schedule

### Context Bridge

**Exposed via** `globalThis.electronBackup`:

```typescript
{
  backupNow(): Promise<{ success: boolean; message: string }>;
  getStatus(): Promise<SchedulerState>;
  getHistory(): Promise<BackupHistory>;
  restore(filename: string): Promise<{ success: boolean; message: string }>;
  updateSchedule(config: BackupScheduleConfig): Promise<void>;
  getSchedule(): Promise<BackupScheduleConfig>;
}
```

## Storage Integration

### Storage Keys (Main Process)

**Custom keys stored in electron-store**:

```typescript
const MAIN_PROCESS_STORAGE_KEYS = {
  BACKUP_LOCATION: "backup_location",
  BACKUP_HISTORY: "backup_history",
  BACKUP_SCHEDULE_CONFIG: "backup_schedule_config",
  LAST_BACKUP_TIME: "last_backup_time",
} as const;
```

**Note**: Separate from renderer process storage (main process only)

### Reconciliation

**On app startup**:

1. **List actual files** in backup directory
2. **Get stored history** from electron-store
3. **Reconcile differences**:
   - Files in directory but not in history → Add to history
   - Files in history but not in directory → Remove from history
4. **Write corrected history** back to store

**Purpose**: Handle manual file deletions or migrations

## Configuration

### Backup Schedule Config

**Default**:

```typescript
{
  enabled: true,
  interval: "daily",
  maxBackups: 10,
  autoDeleteOldest: true
}
```

**User options**:

- Enable/disable scheduling
- Change interval (hourly, daily, weekly, never)
- Set max backups (3-52)
- Auto-delete oldest when limit reached

### Customization Points

1. **Backup location** - Changed in Settings
2. **Schedule interval** - Changed in Settings
3. **Max backups** - Changed in Settings
4. **Data collected** - Hard-coded (all current user data)
5. **File format** - Hard-coded (JSON)

## Performance Characteristics

### Backup Performance

**Typical backup time** (for 500 manga):

- Collect: ~50-100ms
- Write: ~100-200ms
- Rotation: ~0-50ms (if needed)
- **Total**: ~200-350ms

**Backup file size**:

- 500 manga: ~200-500KB (depends on notes/history)
- Max practical: ~10MB (app can handle larger)
- Stored: Plain text JSON (compresses well)

### Storage Usage

**With 10 daily backups**:

- Space per backup: 200-500KB
- Total for 10 backups: 2-5MB
- Additional overhead: <1MB (history, config)

**Typical disk usage**: 5-10MB for full backup system

## Monitoring & Logging

### Logging

**Module tag**: `[BackupSystem]`

**Events logged**:

- Backup started/completed
- Errors during backup
- Rotation performed
- Schedule updated
- Files deleted
- Restore initiated

**Log levels**:

- `info` - Backup completed, schedule changed
- `debug` - File operations, data collection
- `warn` - Recoverable errors (permissions, disk space)
- `error` - Fatal errors, unable to backup

### Status Emission

**Events emitted to UI**:

- `backup:status-changed` - Status updates
- Toast notifications on error
- Progress indication during backup

## Limitations

- Backups are manual/scheduled only (no version control)
- No incremental backups (full backup each time)
- No compression (takes more disk space)
- No encryption of backup files (app responsibility)
- No backup verification (assumes valid JSON)
- Sequential backups (can't run simultaneously with sync)
- No cloud backup integration

## Future Enhancements

- Incremental backups (only changed data)
- Compression (gzip backups)
- Encryption (user password or system keyring)
- Cloud storage integration (Google Drive, Dropbox)
- Backup verification and checksums
- Backup comparison/diff view
- Automated restores on corruption detection
- Backup migration tools
