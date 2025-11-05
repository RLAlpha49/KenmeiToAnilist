# Logging & Debugging Architecture

## Overview

The application uses structured logging with module prefixes, automated console interception, log collection for debug mode, and Sentry error tracking. All logs are tagged with module names for easy filtering and debugging.

## Console Logging Pattern

### Module-Tagged Logging

**Convention**: All logs include module name in brackets

```typescript
console.info("[ModuleName] 📦 Message");
console.debug("[ModuleName] 🔍 Debug message");
console.warn("[ModuleName] ⚠️ Warning message");
console.error("[ModuleName] ❌ Error message");
console.log("[ModuleName] 📝 General message");
```

**Emoji Usage**:

- 📦 Info/status messages
- 🔍 Debug/detailed info
- ⚠️ Warnings
- ❌ Errors
- ✅ Success
- 📝 General messages
- ⏱️ Performance/timing
- 🔀 State changes
- 💾 Storage operations
- 🌐 Network operations

### Module Naming Convention

**Format**: PascalCase or CamelCase matching primary export/class

**Examples**:

```
[MangaSearchService]
[MatchEngine]
[AniListSyncService]
[BackupSystem]
[Settings]
[AuthContext]
[OnboardingOverlay]
```

**Why**: Easy to grep logs and correlate with source files

## Console Interception

### LogCollector System

**Location**: `src/utils/logging.ts`

**Exports**:

- `logCollector` - Global collector instance
- `installConsoleInterceptor()` - Setup interception
- `serialiseLogEntries()` - Export logs

### Interception Process

**`installConsoleInterceptor()`**:

1. **Hook all console methods**:
   - `console.log()`
   - `console.info()`
   - `console.debug()`
   - `console.warn()`
   - `console.error()`
   - `console.group()`
   - `console.groupEnd()`

2. **Capture each call**:
   - Timestamp
   - Log level (info, debug, warn, error)
   - Arguments (serialized)
   - Source location (if available)
   - Stack trace (for errors)

3. **Store in collector**:
   - Max 500 entries (oldest auto-removed)
   - Circular buffer
   - In-memory storage

4. **Pass through to original**:
   - Original console method still called
   - Logs appear in DevTools normally
   - Plus captured for UI display

### Log Formats

**LogEntry Structure**:

```typescript
interface LogEntry {
  id: string; // Unique ID
  timestamp: string; // ISO 8601
  level: LogLevel; // "info" | "debug" | "warn" | "error"
  arguments: unknown[]; // Original args
  source?: string; // File/line
  groupStack: string[]; // Console group context
}

type LogLevel = "info" | "debug" | "warn" | "error";
```

**Serialization** (`serialiseLogEntries()`):

- Converts each log entry to JSON-friendly format
- Redacts sensitive data (tokens, passwords)
- Truncates large objects
- Preserves error stack traces

## Log Redaction

### Security - Sensitive Data

**`redactSensitiveData(value)`**:

Automatically removes:

- OAuth tokens: `accessToken`, `access_token`
- Passwords: `password`, `pass`
- Keys: `apiKey`, `api_key`, `clientSecret`
- Auth credentials: `authorization`, `auth`
- Personal data: `email` (partial redaction)

**Redaction patterns**:

```typescript
const redactionPatterns = [
  /^(?!.*userId|.*username)[a-z]*token[a-z]*$/i,
  /.*password[a-z]*$/i,
  /.*secret[a-z]*$/i,
  /.*key[a-z]*$/i,
  /^authorization$/i,
];
```

**Nested Objects**: Recursively redacts fields in all nested objects

### Enabling/Disabling Redaction

**`setLogRedactionEnabled(enabled)`**:

- `true` (default) - Redact sensitive data
- `false` - Keep all data (dev mode only)

**Check status**: `isLogRedactionEnabled()`

## Debug Mode Log Viewer

### Debug Context Integration

**Location**: `src/contexts/DebugContext.tsx`

**Features**:

- Real-time log display (updates as new logs arrive)
- Filter by level (info, debug, warn, error)
- Search logs by content
- Copy logs to clipboard
- Export logs to file
- Clear logs

### Log Viewer UI

**Component**: `src/components/debug/LogViewer.tsx`

**Display**:

- Scrollable list of recent logs
- Timestamp for each entry
- Color-coded by level (red for error, orange for warn, etc.)
- Source location if available
- Full entry details on expand
- Syntax highlighting for JSON

## Module-Specific Logging

### High-Volume Modules

**Log filtering for large modules**:

```
[MangaSearchService] - Search orchestration, batching
[MatchEngine] - Scoring, filtering, ranking
[AniListSyncService] - Sync operations, mutation execution
[BackupSystem] - Backup scheduling, file operations
[MatchingProcess] - UI-level matching operations
```

**Debug logs**: Only in dev mode, verbose output
**Info logs**: Production logs, key operations
**Error logs**: Always shown, exceptions and failures

### Critical Paths Logging

**Always logged**:

- OAuth flow status
- Sync operations start/completion
- Error conditions
- Rate limit hits
- Failed operations

**Debug logs** (dev mode only):

- API request/response details
- Cache hits/misses
- Similarity calculations
- State transitions

## Sentry Integration

### Error Tracking

**Location**: `src/utils/errorHandling.ts`

**`captureError()` function**:

```typescript
captureError(
  type: ErrorType,
  message: string,
  error: unknown,
  context?: Record<string, unknown>,
)
```

**Captured info**:

- Error type (NETWORK, AUTH, VALIDATION, etc.)
- Error message
- Full error object
- Stack trace
- Context data
- User ID (if authenticated)
- App version

**Release to Sentry**:

- Only production errors
- Respects privacy settings
- Redacts sensitive data
- Groups similar errors

### Message Events

**`captureMessage()` for non-error events**:

- User cancellations (info level)
- Feature usage tracking
- Performance metrics

## Performance Logging

### Operation Timing

**Pattern**: Log start, duration, and completion

```typescript
console.info("[Module] ⏱️ Starting operation...");
const start = performance.now();

// Operation...

const duration = performance.now() - start;
console.info(`[Module] ✅ Completed in ${duration.toFixed(2)}ms`);
```

**Group Logging** (`withGroupAsync`):

```typescript
withGroupAsync("[ModuleName] Operation name", async () => {
  // All logs within this block grouped in DevTools
  // Automatically times the operation
  // Outputs duration when complete
});
```

**Location**: `src/utils/logging.ts`

**Benefits**:

- Console.group() in browser DevTools
- Nested logs organized hierarchically
- Automatic duration tracking
- Clean console output

## Log Storage & Export

### Storage Keys

**Logs persisted in**: In-memory circular buffer (500 entries max)

**Not persisted across** app restart (intentional - logs are transient)

**Export during debug**:

- User can export logs from debug panel
- Saved to user's downloads folder
- Filename: `kenmeitoanilist-logs-TIMESTAMP.json`
- Format: JSON array of serialized log entries

### Backup Integration

**Logs included in backup**: Optional (not included by default)

**Reasoning**:

- Logs are large (can be 1MB+ for verbose operations)
- Ephemeral data (not needed for recovery)
- User data is what matters for backups

## Testing & Debugging

### Local Development Logging

**Enhanced logging for troubleshooting**:

```typescript
// Enable verbose logging
localStorage.setItem("DEBUG", "*");

// Or specific modules
localStorage.setItem("DEBUG", "[MangaSearchService],[MatchEngine]");
```

### Debug Commands in Console

```javascript
// Access log collector from DevTools console
window.logCollector.getEntries();

// Get logs as JSON
JSON.stringify(window.logCollector.getEntries());

// Filter logs by level
window.logCollector.getEntries().filter((e) => e.level === "error");
```

## Best Practices

### Logging Guidelines

**DO**:

- ✅ Include module name in brackets: `[Module]`
- ✅ Use appropriate log level (info for user actions, debug for details)
- ✅ Include context in error logs (what operation, what data)
- ✅ Use emojis for visual scanning
- ✅ Log state transitions
- ✅ Log errors with full context

**DON'T**:

- ❌ Log sensitive data (tokens, passwords, keys)
- ❌ Use generic "error" messages without context
- ❌ Spam debug logs in production
- ❌ Create huge log entries (truncate if needed)
- ❌ Log same message multiple times in loop
- ❌ Use console.log without module prefix

### Message Guidelines

**Clear, actionable messages**:

```typescript
// ✅ Good
console.info("[MatchEngine] 🔍 Searching for 500 manga titles...");
console.error("[AniListSyncService] ❌ Failed to update entry 12345: Invalid format");
console.debug("[MangaSearchService] 💾 Cache hit for 'Attack on Titan'");

// ❌ Poor
console.log("error");
console.log(data);
console.error("Something went wrong");
console.log("processing...");
```

## Common Patterns

### Batch Operations Logging

```typescript
console.info(`[Module] 📦 Processing ${count} items...`);
// ... process each item ...
console.debug(`[Module] 🔍 Processed item ${current}/${total}`);
// ... after all ...
console.info(`[Module] ✅ Completed: ${successful} successful, ${failed} failed`);
```

### Error with Context Logging

```typescript
try {
  await operation();
  console.info("[Module] ✅ Operation completed");
} catch (error) {
  console.error(
    "[Module] ❌ Operation failed",
    {
      operationName: "someOperation",
      attemptNumber: retries,
      errorMessage: error?.message,
    },
    error,
  );
  captureError(ErrorType.NETWORK, "Operation failed", error, {
    attemptNumber: retries,
  });
}
```

### Cancellation Logging

```typescript
if (shouldCancel()) {
  console.warn("[Module] ⚠️ Operation cancelled by user");
  throw new CancelledError("Operation cancelled");
}
```

## Limitations

- Logs stored in memory only (lost on restart)
- Circular buffer (oldest logs auto-removed at 500 entries)
- No persistent logging to file (by design)
- Sentry only captures error events
- No log levels filtering at source (all captured)
- Redaction applies globally (can't opt-out per message)
