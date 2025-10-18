# Critical Patterns & Anti-Patterns

## ⚠️ MUST FOLLOW PATTERNS

### Storage Operations

**ALWAYS use `src/utils/storage.ts` abstraction - NEVER access localStorage or electron-store directly**

```typescript
import { storage, STORAGE_KEYS } from "@/utils/storage";

// ✅ Correct
storage.setItem(STORAGE_KEYS.KENMEI_DATA, JSON.stringify(data));
const data = storage.getItem(STORAGE_KEYS.KENMEI_DATA);

// Force write to override redundancy check:
storage.setItem(STORAGE_KEYS.MATCH_RESULTS, JSON.stringify(results), true);

// ❌ WRONG - security violation
localStorage.getItem(key);
ipcRenderer.invoke("store:set", key, value);
```

**Cache Hierarchy** (read/write order):

1. In-memory cache (volatile, fastest)
2. localStorage (browser storage, synchronous)
3. Electron Store (authoritative source, file-based, encrypted, async)

Storage must respect this precedence. When writing, update all three layers.

### IPC Communication

**NEVER use `ipcRenderer` directly in renderer process - ALWAYS use exposed context bridge APIs**

```typescript
// ✅ Correct - exposed via context bridge
await globalThis.electronStore.setItem(key, value);
const token = await globalThis.electronAuth.getAccessToken(code);
await globalThis.electronApi.updateManga(updates);

// ❌ WRONG - security violation
ipcRenderer.invoke("store:set", key, value);
ipcRenderer.send("auth:login");
```

Context bridge pattern in `src/helpers/ipc/context-exposer.ts` combines 5 domain contexts:

- `exposeWindowContext()` - Window management
- `exposeThemeContext()` - Theme persistence
- `exposeAuthContext()` - OAuth & credentials
- `exposeStoreContext()` - electron-store access
- `exposeApiContext()` - AniList API calls

### Cache Management

**Search cache behavior with `bypassCache` flag**:

- `bypassCache=true`: Always fetch fresh from API, override old cache with new results, skip cache load
- `bypassCache=false`: Check cache first, only fetch on miss, cache all results

**When clearing cache**:

- Must clear `anilistMatches` and `selectedMatch` properties in `MangaMatchResult` objects
- Both the search cache AND match result cache need clearing for complete rematch

### Error Handling

**Always use `createError()` from `src/utils/errorHandling.ts`**

```typescript
import { createError, ErrorType } from "@/utils/errorHandling";

// ✅ Correct
throw createError(ErrorType.NETWORK, "Failed to fetch", error, "NETWORK_UNAVAILABLE");
throw createError(ErrorType.AUTH, "Invalid token", null, "INVALID_TOKEN");

// ❌ WRONG
throw new Error("Network error");
throw error; // raw error without context
```

## 🔴 CODE SMELLS TO AVOID

### Complexity Issues

1. **Nested loops in conditionals** - Extract helper functions
2. **Multiple algorithms in one function** - Break into focused helpers
3. **Complex regex patterns** - Use multi-step validation instead
4. **Functions doing multiple tasks** - Single responsibility principle

### Performance Issues

1. **Not respecting AniList rate limits** (60 req/min) - batch operations must check `RateLimitContext`
2. **Bypassing search cache for no reason** - cache reduces API calls significantly
3. **Redundant storage writes** - use `forceWrite` parameter only when actually overriding
4. **Not memoizing expensive calculations** - React Compiler auto-memoizes, but profile before manual `useMemo`

### Type Safety Issues

1. **Using `any` type** - strict mode enabled, no implicit any allowed
2. **Untyped React components** - always define props interface
3. **Missing return type annotations** - functions should have explicit return types
4. **Inconsistent error types** - always use ErrorType enum

## Code Quality Requirements

**Before committing**:

1. Run `npm run precommit` (format + lint)
2. Run `npm run lint` to fix violations
3. Use `sonarqube_analyze_file` on modified files
4. Check for security issues in sensitive code paths

**React Compiler Rules**:

- Cannot disable ESLint rules for React Compiler - rules enforce hooks stability
- Manual memoization usually unnecessary - compiler handles optimization
- Only manually optimize after profiling shows benefit

## Storage Keys (STORAGE_KEYS constant)

```typescript
(KENMEI_DATA,
  IMPORT_STATS,
  MATCH_RESULTS,
  PENDING_MANGA,
  CACHE_VERSION,
  SYNC_CONFIG,
  SYNC_STATS,
  MATCH_CONFIG,
  IGNORED_DUPLICATES,
  ACTIVE_SYNC_SNAPSHOT);
```

**Cache Versioning**: `CURRENT_CACHE_VERSION = 1` - increment when changing data structure to invalidate old data
