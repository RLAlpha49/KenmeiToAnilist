# Kenmei Data Import & Processing System

## Overview

The Kenmei data processing system handles CSV import, data validation, manga metadata extraction, and integration with the matching system. It supports batch processing with progress tracking and comprehensive error handling.

## Architecture

**Location**: `src/api/kenmei/`

```text
kenmei/
├─ parser.ts          # CSV parsing and structure validation
├─ data-processor.ts  # Data transformation and enrichment
├─ matcher.ts         # Legacy matching (mostly deprecated)
├─ status-mapper.ts   # Reading status conversion
└─ types.ts           # Type definitions
```

**Supporting utilities**:

- `src/utils/manga-import-utils.ts` - Import workflow utilities
- `src/workers/core/worker/operations/csvOperations.ts` - Worker for parsing

## Data Flow

```text
CSV File
   ↓
[Parse CSV] (parser.ts)
   ↓
[Validate Structure] (parser.ts)
   ↓
[Extract Metadata] (data-processor.ts)
   ↓
[Map Reading Status] (status-mapper.ts)
   ↓
[Prepare for Matching] (matcher.ts)
   ↓
[Store in Pending Manga] (storage)
   ↓
[Ready for Matching Page]
```

## CSV File Format

### Expected Structure

**Exported by Kenmei as CSV**:

| Field | Type | Example | Required |
|-------|------|---------|----------|
| `title` | string | "Attack on Titan" | ✅ Yes |
| `author` | string | "Hajime Isayama" | ❌ Optional |
| `chapters` | number | "42" | ❌ Optional |
| `volumes` | number | "12" | ❌ Optional |
| `status` | string | "Reading" / "Completed" / "Dropped" | ❌ Optional |
| `rating` | number | "9" | ❌ Optional |
| `notes` | string | "Great series" | ❌ Optional |
| `source` | string | "Kenmei" | ℹ️ Info only |

### Character Encoding

**UTF-8 required**:

- Japanese characters support
- Emoji support
- Special punctuation

**Quote handling**:

- Fields with commas wrapped in quotes: `"Series, The"`
- Fields with quotes escaped: `"Author ""Pen Name"""`
- Newlines in fields: `"Multi-line\nnotes"`

### CSV Parsing Process

**Location**: `src/api/kenmei/parser.ts`

**`parseKenmeiCsvExport(csvContent: string)`**:

```typescript
interface ParseResult {
  manga: KenmeiManga[];
  errors: ParseError[];
  stats: ParseStats;
}

interface KenmeiManga {
  title: string;
  author?: string;
  chapters?: number;
  volumes?: number;
  status?: string;
  rating?: number;
  notes?: string;
}
```

### Parsing Steps

**1. Validate CSV Structure**

```typescript
validateCsvStructure(csvContent)
```

- Check header row exists
- Verify required columns present
- Detect delimiter (usually comma)
- Handle BOM (byte order mark)

**2. Parse CSV Rows**

```typescript
parseCSVRows(csvContent, delimiter)
```

- Handle quoted fields
- Unescape internal quotes
- Preserve whitespace
- Extract field values in order

**3. Extract Field Values**

```typescript
extractFieldValues(row, headerMap)
```

- Map columns to fields
- Handle column order variations
- Extract optional fields
- Store missing fields as undefined

**4. Normalize Values**

```typescript
normalizeKenmeiManga(rawManga)
```

- Trim whitespace
- Parse numeric fields
- Validate status values
- Clean up formatting

### Error Detection

**`logValidationErrors()` & `validateStatus()`**:

Errors collected but don't stop parsing:

- **Missing required fields** - Title missing
- **Invalid status** - Unknown reading status
- **Invalid numbers** - Non-numeric chapters
- **Encoding issues** - Invalid UTF-8 sequence
- **Malformed rows** - Missing delimiter

**Error reporting**:

```typescript
interface ValidationError {
  rowNumber: number;
  field: string;
  value: unknown;
  reason: string;
  severity: "error" | "warning";
}
```

## Data Processing

### Data Enrichment

**Location**: `src/api/kenmei/data-processor.ts`

**`extractMangaMetadata()` and related functions**:

Extracted metadata:

- **Title extraction** - Clean punctuation
- **Author parsing** - Split multiple authors
- **Reading status mapping** - "Reading" → "CURRENT"
- **Completion estimation** - Infer from chapters
- **Quality score** - From rating if available

### Status Mapping

**Location**: `src/api/kenmei/status-mapper.ts`

**Kenmei Status → AniList MediaListStatus**:

```typescript
type KenmeiStatus = 
  | "Reading"
  | "Completed"
  | "Dropped"
  | "Plan to Read"
  | "On Hold";

type AniListStatus = 
  | "CURRENT"
  | "COMPLETED"
  | "DROPPED"
  | "PLANNING"
  | "PAUSED";

// Mapping
const STATUS_MAP = {
  "Reading": "CURRENT",
  "Completed": "COMPLETED",
  "Dropped": "DROPPED",
  "Plan to Read": "PLANNING",
  "On Hold": "PAUSED"
};
```

### Batch Processing

**`processKenmeiMangaBatches()` and `processMangaInBatches()`**:

Handles large imports efficiently:

```typescript
interface ProcessOptions {
  batchSize?: number; // Default: 50
  skipValidation?: boolean; // Default: false
  onProgress?: (progress: ProgressUpdate) => void;
  cancellationToken?: CancellationToken;
}

const options: ProcessOptions = {
  batchSize: 100,
  onProgress: (p) => updateProgressBar(p)
};

const result = await processKenmeiMangaBatches(manga, options);
```

**Batch processing benefits**:

- Process in chunks to avoid memory spikes
- Emit progress updates for UI
- Support cancellation
- Worker thread friendly

**Worker integration**:

```typescript
// In UI
const csvPool = getCsvWorkerPool();
const { manga, stats } = await csvPool.execute({
  filePath: selectedFile.path,
  options: { batchSize: 100 }
}, cancellationToken);
```

## Integration with Matching

### Create Pending Manga

**After successful import**:

```typescript
// From import-utils
const kenmeiManga: KenmeiManga[] = [...]; // From CSV

// Create pending entries (unmatched)
const pending = kenmeiManga.map(k => ({
  kenmeiManga: k,
  anilistMatches: [],
  selectedMatch: undefined,
  matchStatus: "pending"
}));

// Store in PENDING_MANGA
storage.setItem(STORAGE_KEYS.PENDING_MANGA, JSON.stringify(pending));
```

### Prepare for Matching

**`prepareEntryForSync()` from data-processor**:

```typescript
// Before sending to matching
const prepared = prepareEntryForSync(kenmeiManga, {
  includeAuthor: true,
  includeFormat: false
});

// Now ready for search queries
const searchQuery = `${prepared.title} ${prepared.author}`;
```

## Import Utilities

**Location**: `src/utils/manga-import-utils.ts`

### Import Results

```typescript
interface ImportResults {
  successCount: number;
  errorCount: number;
  totalCount: number;
  manga: KenmeiManga[];
  errors: ValidationError[];
  stats: {
    withAuthor: number;
    withRating: number;
    withStatus: number;
    withNotes: number;
  };
}
```

### Key Functions

**`validateMangaData(data)`**:

- Checks required fields
- Validates types
- Returns validation report

**`normalizeMangaItems(items)`**:

- Trim whitespace
- Fix encoding
- Standardize format

**`mergeMangaData(existing, new)`**:

- Combine with previous imports
- Detect duplicates
- Handle conflicts (newer wins)

**`updateMatchResults(manga, matchResults)`**:

- Link Kenmei → AniList
- Update storage
- Track changes

**`clearPendingMangaStorage()`**:

- Remove pending entries after sync
- Clean up temporary data

**`getPreviousMangaData()`**:

- Retrieve previous import
- For merging or comparison

## Import Workflow

### Step 1: File Selection

**`ImportPage.tsx` with `FileDropZone`**:

- User selects or drags CSV file
- File read as text
- Pass to parser

### Step 2: Parse CSV

```typescript
const csvContent = await file.text();
const parseResult = parseKenmeiCsvExport(csvContent);

if (parseResult.errors.length > 0) {
  showValidationErrors(parseResult.errors);
  // Partial import with warnings
}
```

### Step 3: Show Preview

**`DataTable` component**:

```typescript
const { manga, errors, stats } = parseResult;

// Show summary
console.log(`Importing ${manga.length} manga`);
console.log(`${errors.length} errors found`);

// Show table with parsed data
<DataTable columns={["Title", "Author", "Status"]} rows={manga} />
```

### Step 4: Confirm Import

```typescript
// User clicks "Import" button
const result = await importManga(parseResult.manga);

// Store in pending
storage.setItem(STORAGE_KEYS.PENDING_MANGA, JSON.stringify(result));

// Navigate to matching
router.navigate({ to: "/matching" });
```

### Step 5: Show Summary

**`ImportSummary` component**:

```typescript
return (
  <div>
    <h2>Import Complete</h2>
    <p>✅ {result.successCount} manga imported</p>
    <p>⚠️ {result.errorCount} errors</p>
    <p>Next: Proceed to matching →</p>
  </div>
);
```

## Error Handling

### Common Errors

**Missing title**:

```text
Row 5: Missing required field 'title'
→ Skipped, appears in error report
```

**Invalid status**:

```text
Row 12: Unknown status 'Unknown'
→ Warning, status set to undefined
→ User must select manually in matching
```

**Invalid chapter number**:

```text
Row 8: Invalid number '42+' for chapters
→ Warning, chapters set to undefined
→ Data still imported
```

**Encoding issue**:

```text
Row 20: Invalid UTF-8 sequence
→ Error, row skipped
→ User can rexport with correct encoding
```

### Error Display

**Import page shows issues**:

```typescript
{errors.length > 0 && (
  <Alert variant="destructive">
    <h3>Import Issues ({errors.length})</h3>
    <ul>
      {errors.map(e => (
        <li key={`${e.rowNumber}-${e.field}`}>
          Row {e.rowNumber}: {e.reason}
        </li>
      ))}
    </ul>
  </Alert>
)}
```

## Performance Considerations

### Typical Performance

**CSV with 500 manga**:

- Parse: ~100-150ms (worker)
- Validate: ~50-100ms (worker)
- Store: ~20-50ms (main thread)
- **Total: ~200-300ms**

**CSV with 5000 manga**:

- Parse: ~1000-1500ms (worker)
- Validate: ~500-800ms (worker)
- Store: ~200-500ms (main thread)
- **Total: ~2-3 seconds**

### Memory Usage

**Per manga entry**: ~1-2KB

- 500 manga: ~1MB
- 5000 manga: ~10MB
- Negligible for modern systems

## Configuration

### Default Options

```typescript
const DEFAULT_PROCESS_OPTIONS = {
  batchSize: 50,
  skipValidation: false,
  onProgress: undefined,
  cancellationToken: undefined
};
```

### Customization Points

- Batch size (tune for memory/speed trade-off)
- Skip validation (for trusted sources)
- Progress tracking
- Cancellation support

## Best Practices

✅ **DO**:

- Validate CSV structure first
- Show progress for large imports
- Preserve original data until confirmed
- Report all errors to user
- Support cancellation

❌ **DON'T**:

- Silently skip rows
- Lose error information
- Modify data without feedback
- Import invalid manga
- Block main thread
