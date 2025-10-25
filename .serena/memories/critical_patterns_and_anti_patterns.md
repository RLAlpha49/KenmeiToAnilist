# Critical Patterns & Anti-Patterns

## ⚠️ MUST FOLLOW PATTERNS

### Storage Operations

**ALWAYS use `src/utils/storage.ts` abstraction - NEVER access localStorage or electron-store directly**

```typescript
import { storage, STORAGE_KEYS } from "@/utils/storage";

// ✅ Correct
storage.setItem(STORAGE_KEYS.KENMEI_DATA, JSON.stringify(data));
const data = storage.getItem(STORAGE_KEYS.KENMEI_DATA);

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
3. **Redundant storage writes** - storage layer automatically skips writes if value hasn't changed via cache check
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

## Storage Keys (Canonical Source: `src/utils/storage.ts` STORAGE_KEYS)

The `STORAGE_KEYS` constant in `src/utils/storage.ts` is the **single source of truth**. Always reference it there for the authoritative list:

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
  ACTIVE_SYNC_SNAPSHOT,
  ANILIST_SEARCH_CACHE,
  UPDATE_DISMISSED_VERSIONS,
  ONBOARDING_COMPLETED,
  BACKUP_HISTORY,
  AUTO_BACKUP_ENABLED,
  SYNC_HISTORY);
```

**Cache Versioning**: `CURRENT_CACHE_VERSION = 1` - increment when changing data structure to invalidate old data

**Storage Write Behavior**: `storage.setItem()` skips redundant writes if the in-memory cache already holds the same value. This avoids thrashing localStorage and electron-store, but can cause drift if the layers get out of sync. For cases requiring forced convergence, use `storage.setItemAsync()` directly or clear the cache before writing.

### Custom Matching Rules Pattern

**Purpose**: Allow users to define regex-based rules for automatically skipping or accepting manga during matching.

**Architecture**:

- **Storage**: Rules stored in `MatchConfig.customRules` with skip and accept arrays
- **Evaluation**: `custom-rules.ts` module evaluates patterns against all title variants
- **Integration**: Hooks into existing filtering pipeline (skip-rules.ts, inclusion-rules.ts, ranking.ts)

**Rule Structure**:

```typescript
interface CustomRule {
  id: string; // Unique identifier
  pattern: string; // Regex pattern
  description: string; // User-friendly label
  enabled: boolean; // Active state
  caseSensitive: boolean; // Case matching
  createdAt: string; // ISO timestamp
}
```

**Evaluation Flow**:

1. System skip rules (light novels, hardcoded blacklist)
2. Custom skip rules (user-defined exclusions)
3. Scoring and ranking
4. Custom accept rules (boost confidence)
5. Inclusion threshold checks

**Integration Points**:

- `skip-rules.ts`: shouldSkipManga() checks custom skip rules after system rules
- `inclusion-rules.ts`: shouldIncludeManga\*() checks custom accept rules before thresholds
- `ranking.ts`: Passes KenmeiManga to filtering functions for title matching
- `batching/results.ts`: Applies custom rules during batch compilation

**Title Matching Scope**:

- AniList titles: romaji, english, native, synonyms
- Kenmei titles: title, alternative_titles
- All titles tested against each rule pattern
- First match wins (short-circuit evaluation)

**Best Practices**:

- ✅ Test patterns before saving (use validation)
- ✅ Use specific patterns to avoid over-filtering
- ✅ Provide clear descriptions for maintainability
- ✅ Disable rules instead of deleting for experimentation
- ✅ Use case-insensitive by default (more forgiving)
- ❌ Avoid overly broad patterns (e.g., `.*` matches everything)
- ❌ Don't use complex lookaheads/lookbehinds (performance)
- ❌ Avoid patterns that match common words (e.g., `the`, `a`)

**Common Patterns**:

- Skip anthologies: `anthology`
- Skip one-shots: `^one.?shot$`
- Skip volumes: `vol(ume)?\s*\d+`
- Accept official: `official`
- Accept publisher: `viz\s*media|shueisha`

**Error Handling**:

- Invalid regex caught during validation (try-catch on new RegExp)
- Malformed rules logged but don't crash matching
- Graceful degradation if customRules is undefined

**Performance Considerations**:

- Regex compilation cached per rule evaluation
- Short-circuit on first match
- Only enabled rules evaluated
- Minimal overhead (~1ms per manga with 10 rules)

**Anti-Patterns**:

- ❌ Creating duplicate rules (use edit instead)
- ❌ Using patterns without testing
- ❌ Overly complex regex (use multiple simple rules)
- ❌ Forgetting to enable rules after creation
- ❌ Not providing descriptions (hard to maintain)
