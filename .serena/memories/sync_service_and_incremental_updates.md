# Sync Service & Incremental Update System

## Overview

The sync service handles batch updates of manga entries to AniList with sophisticated error handling, rate limiting, and incremental processing. It supports resumable operations and partial retries.

## Architecture

### AniListSyncService

**Location**: `src/api/anilist/sync-service.ts`

Orchestrates all sync operations with:

- Batch processing
- Incremental retry logic
- Rate limit handling
- Error recovery
- Progress tracking

### Rate Limiting

**Constants**:

- `MAX_REQUESTS_PER_MINUTE = 60`
- `REQUEST_INTERVAL = 1000ms` (1 second = 60 requests/min)

**Strategy**: Sequential requests with 1-second delay maintains rate compliance.

## Batch Processing Flow

### syncMangaBatch()

**Input**: Array of manga entries to sync

**Processing Steps**:

1. **Categorize entries** - Group by status (new, existing, delete)
2. **Organize by media ID** - Batch entries with same AniList ID
3. **Determine update steps** - Calculate GraphQL steps needed per entry
4. **Execute sequentially** - Process each entry with rate limiting
5. **Handle errors** - Collect failures for retry
6. **Generate report** - Return sync statistics

### Incremental Update Steps

**3-Step Incremental Process** (for maximum API efficiency):

**Step 1**: Update progress (chapters/episodes read)

- Most common operation
- Low bandwidth
- ~0.5KB per request

**Step 2**: Update score/status

- Separate from progress for flexibility
- Can be skipped if only progress changes

**Step 3**: Update notes/metadata

- Optional, only if user provided notes
- Usually skipped

**Logic**:

```text
For existing entry:
  IF progress changed → Step 1
  IF status/score changed → Step 2
  IF notes provided → Step 3

For new entry:
  Build complete data → Single mutation
  (New entries sent atomically)
```

**Benefits**:

- Reduces request size (smaller payloads)
- Allows partial updates (skip unnecessary steps)
- Better error isolation (Step 1 fails doesn't affect Step 2)
- Cleaner retry logic (know exactly which step failed)

## Entry Processing

### Processing Types

**New Entries** (`createMediaListEntry` mutation):

- Single atomic GraphQL mutation
- Includes status, progress, score, notes
- One request per unique AniList ID

**Existing Entries** (multiple steps):

- Step 1: Update progress/chapters
- Step 2: Update status/score
- Step 3: Update notes/metadata
- May execute 1-3 requests depending on changes

**Deletions** (`deleteMediaListEntry` mutation):

- Remove entry from user's list
- One request per unique AniList ID

### EntryProcessingContext

**Tracked Information**:

```typescript
interface EntryProcessingContext {
  mediaId: number;
  entries: MangaMatchResult[];

  // Step tracking
  step: 1 | 2 | 3;
  stepsRequired: number;

  // State
  status: "pending" | "processing" | "completed" | "failed";
  progress: { completed: number; total: number };

  // Error handling
  lastError?: Error;
  retryCount: number;
  nextRetryTime?: number;
}
```

## Error Handling

### Error Types Detected

**Rate Limit (429)**:

```text
- Extract Retry-After header
- Queue for later retry
- Continue with next entry
- Implement exponential backoff
```

**500 Server Errors**:

```text
- Log error details
- Queue for retry (server may recover)
- Continue with next entry
```

**GraphQL Errors**:

```text
- Parse GraphQL error array
- Log field-specific errors
- Skip entry or queue for retry
- Don't retry if validation error
```

**Network Errors**:

```text
- Temporary connection issues
- Queue for retry
- Continue with other entries
```

### Error Recovery

**Failed Operations Queue** (`src/utils/storage.ts`):

```typescript
interface FailedOperation {
  id: string;
  type: FailedOperationType;
  timestamp: number;
  retryCount: number;
  lastError: string;
  data: FailedSyncOperationData;
  nextRetryTime?: number;
}
```

**Storage Keys**:

- `FAILED_OPERATIONS_QUEUE` - Persists failed operations
- `ACTIVE_SYNC_SNAPSHOT` - Current sync state (resumable)
- `MAX_FAILED_OPERATIONS = 1000`
- `FAILED_OPERATION_EXPIRY_DAYS = 30`

**Retry Logic**:

1. Collect failed entries during sync
2. Persist to storage
3. User can retry later via `retryFailedUpdates()`
4. Automatic cleanup after 30 days
5. Max 1000 operations stored

## Progress Tracking

### SyncProgress

**Tracked Metrics**:

```typescript
interface SyncProgress {
  totalEntries: number;
  processedEntries: number;
  successfulEntries: number;
  failedEntries: number;

  currentMediaId?: number;
  currentStep?: 1 | 2 | 3;
  statusMessage: string;

  startTime: number;
  estimatedRemainingTime?: number;
}
```

**Progress Updates**:

- Emitted via IPC during processing
- UI receives real-time updates
- Can calculate ETA
- Shows current entry being processed

## Sync Report

### SyncReport Output

**After sync completes**:

```typescript
interface SyncReport {
  startTime: number;
  endTime: number;
  totalProcessed: number;

  new: number; // Entries added to AniList
  updated: number; // Entries updated
  deleted: number; // Entries removed

  failed: number;
  failureRate: number; // percentage

  statistics: {
    progressChanged: number;
    statusChanged: number;
    scoreChanged: number;
    notesAdded: number;
  };
}
```

**Available for display in UI/export**

## Processing Order

### determineProcessingOrder()

**Strategy** (to maximize success rate):

1. **Known IDs first** - MediaIds already confirmed to exist
2. **Existing entries** - Less likely to fail
3. **New entries** - May fail if ID doesn't exist
4. **Deletions last** - Safe to do last

**Rationale**: Process safest operations first, accumulate data, then handle riskier ones

## Configuration & Customization

### Sync Preferences

**User-configurable** (`src/utils/storage.ts`):

```typescript
interface SyncConfig {
  updateProgress?: boolean; // Sync chapters read
  updateStatus?: boolean; // Update reading status
  updateScore?: boolean; // Update user's score
  updateNotes?: boolean; // Add user's notes
  overwriteExisting?: boolean; // Allow overwriting existing entries
  autoResume?: boolean; // Resume failed operations
}
```

**Stored in**: `SYNC_CONFIG` storage key

## Concurrency & Resumability

### Single Sync Constraint

**Only one sync can run at a time** (enforced by UI/IPC):

- Prevents data corruption
- Simplifies error handling
- Clear progress tracking

### Resume Capability

**Sync can be resumed if interrupted**:

1. **Snapshot**: `ACTIVE_SYNC_SNAPSHOT` stores current progress
2. **Interruption**: User cancels or app crashes
3. **Resume**: Next sync checks for snapshot
4. **Continue**: Resumes from last entry, skips completed ones

**Snapshot contains**:

- Entries already synced
- Current progress
- MediaIds being processed
- Step information

**Cleanup**: Snapshot cleared when sync completes or is explicitly cancelled

## Integration Points

### IPC Communication

**sync:batch** - Start batch sync

```typescript
// Request
{
  entries: MangaMatchResult[];
  config: Partial<SyncConfig>;
}

// Response (streamed via events)
{
  type: "progress" | "complete" | "error";
  data: SyncProgress | SyncReport | ErrorInfo;
}
```

**sync:retry** - Retry failed operations

```typescript
{
  config?: Partial<SyncConfig>;
}
```

### Storage Integration

- Reads match results from storage
- Persists sync config
- Stores failed operations
- Maintains sync history
- Tracks failed operation retries

## Testing & Debugging

### Debug Mode Features

**When debug mode enabled** (`src/contexts/DebugContext.tsx`):

- Detailed sync logs with timestamps
- Step-by-step mutation logging
- GraphQL query/response logging
- Rate limit tracking
- Failed operation details

### Logging

**Module tag**: `[AniListSyncService]`

**Log levels**:

- `info` - Sync started/completed
- `debug` - Step execution, categorization
- `warn` - Recoverable errors
- `error` - Fatal errors

## Performance Characteristics

**Typical sync of 500 entries**:

- Duration: ~8-10 minutes (respects 60 req/min limit)
- API calls: ~750-1000 (1-3 per entry)
- Memory: Minimal (streaming processing)
- Network: Bidirectional ~2-5MB

**Optimization opportunities**:

- Parallel source requests (currently sequential)
- Batch mutations (1-3 mutations per entry)
- Compression (small requests)

## Limitations & Constraints

- Must maintain 60 req/min rate limit
- Sequential processing (not parallelized)
- Cannot update deleted entries
- No batch deletion support
- Failed entries expire after 30 days
- Max 1000 concurrent failed operations
