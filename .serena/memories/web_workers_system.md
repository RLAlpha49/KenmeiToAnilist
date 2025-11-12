# Web Workers & Thread Pool System

## Overview

The application uses a sophisticated web workers system to offload CPU-intensive operations from the main thread, preventing UI freezing. The system implements worker pools for different operation types with support for cancellation, error handling, and progress tracking.

## Architecture

### Core Components

**Location**: `src/workers/core/`

```text
workers/core/
├─ pool.ts              # WorkerPool class (generic pool management)
├─ types.ts             # Type definitions
├─ utils.ts             # Helper utilities
├─ worker-pool.ts       # Main pool instance
├─ worker.ts            # Worker implementation
└─ worker/
   ├─ cancellationHandler.ts  # Cancellation logic
   ├─ errorUtils.ts          # Error handling
   ├─ operations/             # Operation implementations
   │  ├─ advancedFilterOperations.ts
   │  ├─ batchSyncOperations.ts
   │  ├─ csvOperations.ts
   │  ├─ dataTableOperations.ts
   │  ├─ duplicateDetectionOperations.ts
   │  ├─ jsonOperations.ts
   │  ├─ matchingOperations.ts
   │  ├─ readingHistoryOperations.ts
   │  ├─ statisticsOperations.ts
   │  └─ titleNormalizationOperations.ts
   └─ types.ts           # Worker-specific types
```

### Worker Pool Classes

**Generic Pool** (`src/workers/core/pool.ts`):

```typescript
class WorkerPool<InputType, OutputType> {
  // Generic pool for any work type
  // Manages N worker threads
  // Queues tasks automatically when all workers busy
  // Supports cancellation tokens
  // Tracks progress and completion
}
```

**Operation-Specific Pools** (`src/workers/data-processing/`, `src/workers/matching/`, etc.):

```text
Specialized pools:
├─ CsvWorkerPool - CSV parsing/processing
├─ FilterWorkerPool - Advanced filtering operations
├─ JsonSerializationWorkerPool - JSON serialization
├─ MatchingWorkerPool - Confidence scoring
├─ BatchSyncWorkerPool - Batch sync operations
├─ DuplicateWorkerPool - Duplicate detection
├─ ReadingHistoryWorkerPool - Statistics calculations
├─ StatisticsWorkerPool - Analytics data processing
├─ TitleNormalizationWorkerPool - Normalization tasks
└─ DataTableWorkerPool - UI table rendering
```

## Task Execution Flow

### Request → Processing → Response

**1. Client submits task**:

```typescript
const pool = getCsvWorkerPool();
const result = await pool.execute(
  { filePath, options },
  cancellationToken // Optional
);
```

**2. Pool routes task**:

- Check queue → Available worker?
- Yes: Send task immediately
- No: Queue task for when worker available

**3. Worker processes**:

- Runs operation in separate thread
- Emit progress updates (streaming)
- Handle errors locally
- Return typed result or throw

**4. Client receives result**:

- Main thread continues (no blocking)
- UI responsive even during heavy compute
- Progress updates received via callbacks

### Task Types

**Long-Running Operations**:

- CSV parsing (1000+ lines)
- Title normalization (1000+ manga)
- Statistics calculations
- Batch sync operations
- Duplicate detection

**Short Operations**:

- JSON serialization
- Single-item filtering
- Quick transformations

## Cancellation System

### Cancellation Token Pattern

**`src/workers/core/worker/cancellationHandler.ts`**:

```typescript
class CancellationToken {
  isCancelled: boolean;
  cancel(): void; // Mark as cancelled
  throwIfCancelled(): void; // Check & throw if cancelled
}
```

**Usage in Client**:

```typescript
const token = new CancellationToken();

// Start task
const resultPromise = pool.execute(data, token);

// User clicks Cancel
token.cancel();

// Task stops on next cancellation check
```

**Worker Responsibility**:

- Check `token.throwIfCancelled()` periodically
- Usually in loop: `for (const item of items) { token.throwIfCancelled(); ... }`
- Throwing cancellation error stops execution immediately

### Error Handling

**`src/workers/core/worker/errorUtils.ts`**:

- Serializable error wrapper (browser workers can't send Error objects directly)
- Stack trace preservation
- Error context inclusion
- Type-safe error passing

**Pattern**:

```typescript
try {
  // Worker code
  result = performOperation(data);
} catch (error) {
  // Serialize and send back
  throw new SerializableError(error);
}
```

**Client receives**:

```typescript
try {
  const result = await pool.execute(data);
} catch (error) {
  // Already deserialized back to Error-like object
  logError(error.message, error.stack);
}
```

## Operation Categories

### CSV Operations

**`src/workers/core/worker/operations/csvOperations.ts`**:

- Parse CSV file
- Validate structure
- Extract manga data
- Handle special characters
- Batch processing with progress

**Example**:

```typescript
const csvWorkerPool = getCsvWorkerPool();
const { manga, stats } = await csvWorkerPool.execute({
  filePath: '/path/to/export.csv',
  options: { skipValidation: false }
});
```

### Matching Operations

**`src/workers/core/worker/operations/matchingOperations.ts`**:

- Calculate similarity scores
- Score candidates
- Rank matches
- Apply filters

**Example**:

```typescript
const matchingPool = getMatchingWorkerPool();
const results = await matchingPool.execute({
  searchTitle: 'Attack on Titan',
  candidates: [anilistManga1, anilistManga2, ...],
  options: { includeAlternatives: true }
});
```

### Statistics Operations

**`src/workers/core/worker/operations/statisticsOperations.ts`**:

- Calculate reading habits
- Aggregate data by genre/format/status
- Compute trends
- Generate distribution charts

**Example**:

```typescript
const statsPool = getStatisticsWorkerPool();
const stats = await statsPool.execute({
  manga: allManga,
  options: { timeRange: 'last-90-days' }
});
```

### Filter Operations

**`src/workers/core/worker/operations/advancedFilterOperations.ts`**:

- Apply multiple filter criteria
- Combination logic (AND, OR, NOT)
- Text search
- Complex queries

### Duplicate Detection

**`src/workers/core/worker/operations/duplicateDetectionOperations.ts`**:

- Find duplicate entries
- Title similarity matching
- Confidence scoring
- Batch deduplication

### Title Normalization

**`src/workers/core/worker/operations/titleNormalizationOperations.ts`**:

- Normalize many titles at once
- Cache results
- Return mapping for quick lookup

### JSON Operations

**`src/workers/core/worker/operations/jsonOperations.ts`**:

- Serialize large data structures
- Deserialize JSON
- Format for storage/export

### Data Table Operations

**`src/workers/core/worker/operations/dataTableOperations.ts`**:

- Pagination computation
- Sorting large datasets
- Filtering table data
- Column visibility calculations

### Reading History Operations

**`src/workers/core/worker/operations/readingHistoryOperations.ts`**:

- Aggregate reading progress
- Calculate velocity metrics
- Track completion trends

### Batch Sync Operations

**`src/workers/core/worker/operations/batchSyncOperations.ts`**:

- Prepare entries for sync
- Batch categorization
- Sync prioritization

## Progress Tracking

### Progress Callbacks

**During long operations**:

```typescript
const pool = getCsvWorkerPool();
const result = await pool.execute(data, null, {
  onProgress: (progress: ProgressUpdate) => {
    console.log(`${progress.current}/${progress.total} items processed`);
    updateProgressBar(progress.percentage);
  }
});
```

**Progress structure**:

```typescript
interface ProgressUpdate {
  current: number; // Items completed
  total: number; // Total items
  percentage: number; // 0-100
  message?: string; // Optional status message
}
```

## Pool Configuration

### Worker Count

**Default**: Number of CPU cores (e.g., 8 workers on 8-core CPU)

**Each pool maintains separate worker count**:

- CSV pool: N workers
- Matching pool: N workers
- Statistics pool: N workers

**Total active workers**: Limited by OS and browser capabilities

### Queue Management

**Automatic queuing**:

```text
Task 1 → Worker 1 (executing)
Task 2 → Worker 2 (executing)
Task 3 → Queue (waiting)
Task 4 → Queue (waiting)

When Worker 1 finishes:
Task 3 → Worker 1 (executing)
```

**FIFO order**: Tasks processed in submission order

### Memory Management

**Worker cleanup**:

- Workers terminate after inactivity
- Memory released back to OS
- Automatic restart on next task
- No memory leaks from persistent workers

## Integration Points

### How Components Use Workers

**Example: CSV Import**

```typescript
// In ImportPage.tsx
const csvPool = getCsvWorkerPool();
const { manga, stats } = await csvPool.execute({
  filePath: selectedFile.path,
  options: { skipValidation: false }
}, cancellationToken, {
  onProgress: (p) => setProgress(p)
});
```

**Example: Statistics Page**

```typescript
// In StatisticsPage.tsx
const statsPool = getStatisticsWorkerPool();
const chartData = await statsPool.execute({
  manga: matchResults,
  options: { aggregateBy: 'genre' }
});
```

**Example: Matching**

```typescript
// In MatchingPage.tsx
const matchPool = getMatchingWorkerPool();
const scores = await matchPool.execute({
  searchTitle: kenmeiManga.title,
  candidates: anilistResults
});
```

## Testing Workers

### Simulating Heavy Load

```typescript
// In test file
const pool = getCsvWorkerPool();
const largeData = { filePath: '/huge-export.csv' };
const start = performance.now();
const result = await pool.execute(largeData);
const duration = performance.now() - start;
console.log(`Processed in ${duration}ms`);
```

### Cancellation Testing

```typescript
const token = new CancellationToken();
const resultPromise = pool.execute(data, token);

// After 500ms, cancel
setTimeout(() => token.cancel(), 500);

try {
  await resultPromise;
} catch (error) {
  expect(error.message).toContain('cancelled');
}
```
