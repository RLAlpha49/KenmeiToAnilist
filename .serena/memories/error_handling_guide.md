# Error Handling Architecture & Guide

## Overview

The application uses a comprehensive error handling system with:

1. **Structured Error Types** (`ErrorType` enum in `src/utils/errorHandling.ts`)
2. **Error Boundaries** (React components that catch and recover from errors)
3. **Sentry Integration** (production error tracking)
4. **Structured Logging** (`src/utils/logging.ts` with MODULE_TAGS)
5. **Recovery Actions** (`ErrorRecoveryAction` enum for user-facing recovery)

## Error Types

- `UNKNOWN` - Unclassified errors
- `VALIDATION` - Data validation failures (invalid input, malformed API responses)
- `NETWORK` - Network issues (API failures, connectivity, timeouts, rate limits)
- `AUTH` - Authentication errors (missing token, invalid token, insufficient permissions)
- `SERVER` - 5xx server errors
- `CLIENT` - 4xx client errors (except auth)
- `STORAGE` - Storage operations (localStorage/electron-store read/write/parse failures)
- `SYSTEM` - System-level errors (Electron IPC, file system, permissions)

## Core Functions

### createError()

Creates structured AppError with type, message, originalError, code, recoveryAction, recoveryMessage

### captureError()

Sends error to Sentry with context tags and breadcrumbs. Only enabled in production or when VITE_SENTRY_DSN configured.

### handleNetworkError()

Specialized handler for network errors with retry detection logic

### safeAsync()

Wraps async operations, returns [result, error] tuple instead of throwing

## Error Boundaries

- **Global ErrorBoundary** (`src/components/ErrorBoundary.tsx`) - Wraps entire app
- **MatchingErrorBoundary** - For matching section, recovery: clear cache, reset state, go home
- **SyncErrorBoundary** - For sync section, recovery: retry failed, cancel sync, reset state
- **StatisticsErrorBoundary** - For statistics section, recovery: refresh, clear filters, go home

## Sentry Configuration

**Main Process** (`src/main.ts`):

- Uncaught exception + unhandled rejection integrations
- User context with UUID-based stable installation_id
- 10% trace sampling
- beforeSend hook sanitizes Authorization headers

**Renderer Process** (`src/renderer.ts`):

- Browser tracing integration
- 10% trace sampling
- Console interceptor conditionally installed (production or VITE_CAPTURE_CONSOLE=1)

## Logging Pattern

```typescript
import { logInfo, logDebug, logWarn, logError, MODULE_TAGS } from "@/utils/logging";

logDebug(MODULE_TAGS.SYNC, "Starting sync", { count: 10 }); // 🔍
logInfo(MODULE_TAGS.SYNC, "Sync completed", { result: 10 }); // ℹ️
logWarn(MODULE_TAGS.STORAGE, "Cache miss", { key }); // ⚠️
logError(MODULE_TAGS.ANILIST, "API failed", error); // ❌
logSuccess(MODULE_TAGS.EXPORT, "Export done"); // ✅
```

Module tags: MATCHING, SYNC, STATISTICS, STORAGE, ANILIST, IMPORT, EXPORT, RENDERER, MAIN

## Implementation Examples

### AniList Client Error Handling

- HTTP 429 rate limits: ErrorType.NETWORK + recoveryAction.WAIT_RATE_LIMIT with retryAfter context
- HTTP 401/403: ErrorType.AUTH
- HTTP 5xx: ErrorType.SERVER
- HTTP 4xx: ErrorType.CLIENT
- Network timeouts: ErrorType.NETWORK

### Storage Error Handling

- JSON parse failures: ErrorType.STORAGE with operation context
- electron-store failures: ErrorType.SYSTEM (underlying system error)
- All operations include: key, operation (read/write/delete), valueSize

### Sync Error Handling

- Rate limit on chunk: captureError with isRateLimit flag
- Chunk parse failure: captureError with chunk number and hasData flag
- Sync snapshot persistence: logError + captureError with operation="persist-snapshot"

## Best Practices

1. Always use `ErrorType` enum - never string literals
2. Include context in captureError (operation, key, attempt, duration, etc.)
3. Use `logError` + `captureError` together for errors, `logWarn` for non-critical issues
4. Always include MODULE_TAGS in logging calls
5. Never send sensitive data (tokens, passwords, personal info) to Sentry
6. Use error boundaries to prevent full app crashes - allow partial recovery
7. Provide meaningful recovery actions in UI (RETRY, REFRESH_TOKEN, CHECK_CONNECTION, etc.)
8. Gate console interceptor behind environment flags to avoid log bloat in dev

## Recent Standardization (All 7 Comments Addressed)

1. ✅ AniList client: All error paths use createError/captureError with proper ErrorType mapping
2. ✅ Storage.ts: All operations capture errors with ErrorType.STORAGE or ErrorType.SYSTEM
3. ✅ ErrorType enum: Normalized casing (AUTHENTICATION→AUTH), removed duplicates
4. ✅ Sentry user context: Uses stable UUID-based installation_id instead of path segments
5. ✅ StatisticsPage: Export errors use captureError instead of console.error
6. ✅ Logging adoption: useSynchronization, AniList client, storage.ts use logInfo/logError helpers
7. ✅ Console interceptor: Gated behind VITE_CAPTURE_CONSOLE flag in renderer.ts

## Critical Files

- `src/utils/errorHandling.ts` - Error type definitions, createError, captureError, handleNetworkError, safeAsync
- `src/utils/logging.ts` - logInfo, logDebug, logWarn, logError, logSuccess, MODULE_TAGS, withGroup, installConsoleInterceptor
- `src/main.ts` - Sentry init, UUID generation, user context setup
- `src/renderer.ts` - Sentry init, console interceptor gating
- `src/components/ErrorBoundary.tsx` - Global boundary
- `src/components/matching|sync|statistics/ErrorBoundary.tsx` - Section-specific boundaries
