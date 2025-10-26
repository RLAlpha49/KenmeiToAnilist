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

**Purpose**: Allow users to define regex-based rules for automatically skipping or accepting manga during matching. Rules can target specific metadata fields (titles, author, genres, tags, format, country, source, description, status).

**Type Definitions** (`src/utils/storage.ts`):

```typescript
// Metadata field options for custom rules
type CustomRuleTarget =
  | "titles" // All title variants (romaji, english, native, synonyms)
  | "author" // Author names and staff credits
  | "genres" // Genre tags
  | "tags" // Detailed tags with categories
  | "format" // Publication format
  | "country" // Country of origin
  | "source" // Original source material
  | "description" // Manga description
  | "status"; // Publishing status

interface CustomRule {
  id: string; // Unique identifier
  pattern: string; // Regex pattern
  description: string; // User-friendly label
  enabled: boolean; // Active state
  caseSensitive: boolean; // Case matching
  targetFields: CustomRuleTarget[]; // Fields to check (required, default: ['titles'])
  createdAt: string; // ISO timestamp
}
```

**Validation** - `validateCustomRule()` checks:

1. **Basic Validation**: Empty pattern detection
2. **Field Validation**: All targetFields are valid CustomRuleTarget values (using Set)
3. **Regex Syntax**: Valid JavaScript RegExp (try-catch on constructor)
4. **ReDoS Detection**: Nested quantifiers `(a+)+`, overlapping alternations `(a|aa)+`, catastrophic patterns `^(.*a)*$`
5. **Broad Pattern Detection**: Unbounded `.*`, anchored wildcards `^.*$`, empty alternations
6. **Complexity Warning**: Patterns >200 characters flagged

**Backward Compatibility**:

```typescript
// migrateCustomRule() ensures old rules work with new targetFields property
function migrateCustomRule(rule: Partial<CustomRule>): CustomRule {
  return {
    ...rule,
    targetFields: rule.targetFields || ["titles"], // Default to title-only for existing rules
  };
}
```

Applied during component initialization:

```typescript
customRules.skipRules.map((rule) => migrateCustomRule(rule));
```

**Architecture** (`src/api/matching/filtering/custom-rules.ts`):

- **Metadata Extraction**: `extractMetadataValues(targetField, manga, kenmeiManga)` dispatcher
  - Helper functions: `extractTitles()`, `extractAuthors()`, `extractTags()`, `extractDescriptions()`
  - Each field type knows how to extract from AniList and Kenmei data
  - Handles null/undefined fields gracefully

- **Pattern Testing**: `testRuleAgainstMetadata(rule, manga, kenmeiManga)` evaluates regex
  - Extracts values from all targetFields
  - Tests pattern against each value
  - Returns true if ANY field matches (boolean OR)
  - Includes field logging for debugging

- **Integration Points**:
  - `shouldSkipByCustomRules()` - applies skip rules with metadata
  - `shouldAcceptByCustomRules()` - applies accept rules with metadata
  - `getCustomRuleMatchInfo()` - returns which rule matched for logging

**UI Components**:

1. **MetadataFieldSelector** (`src/components/settings/MetadataFieldSelector.tsx`):
   - Displays 9 metadata fields organized in 3 categories
   - Bulk actions: Select All, Clear All, Reset to Default
   - Validation: Requires at least one field selected
   - Accessibility: aria-live, proper fieldset/legend, tooltip descriptions
   - Display: Grid layout with field count badge

2. **RegexDocumentation** (`src/components/settings/RegexDocumentation.tsx`):
   - Always visible: Security Warning (ReDoS with OWASP link), Safe Examples, Dangerous Patterns
   - Collapsible: Basic Syntax, Quantifiers, Character Classes, Grouping/Alternation
   - External resources: MDN, regex101, regexr
   - ReDoS vulnerability detection patterns with explanations

3. **CustomRulesManager Updates**:
   - Wrapped in Collapsible with advanced user warning
   - ShieldAlert icon, "Advanced" badge, warning Alert
   - MetadataFieldSelector in dialog form
   - RegexDocumentation collapsible in dialog
   - Target Fields column in rules table (first 3 as badges, "+X more")

**Evaluation Flow**:

1. System skip rules (light novels, hardcoded blacklist)
2. Custom skip rules (user-defined exclusions) - checks selected targetFields
3. Scoring and ranking
4. Custom accept rules (boost confidence) - checks selected targetFields
5. Inclusion threshold checks

**Field-Specific Logic**:

- **Titles**: Checks all variants (romaji, english, native, synonyms, alternative titles)
- **Author**: Checks primary author + staff list (story, art, original creator)
- **Genres**: Checks genre tags array
- **Tags**: Checks detailed tags with categories
- **Format**: Checks publication format (Manga, Light Novel, etc.)
- **Country**: Checks country of origin (JP, KR, CN, etc.)
- **Source**: Checks original source material
- **Description**: Checks manga description and notes
- **Status**: Checks publishing status (Finished, Publishing, etc.)

**Best Practices**:

- ✅ Test patterns thoroughly before saving
- ✅ Select only necessary targetFields (improves performance)
- ✅ Use case-insensitive by default (more forgiving)
- ✅ Prefer simple patterns over complex regex
- ✅ Use multiple simple rules instead of one complex rule
- ✅ Provide clear descriptions for maintainability
- ✅ Disable rules to experiment instead of deleting
- ❌ Avoid unbounded quantifiers `*` and `+` without bounds
- ❌ Never nest quantifiers `(a+)+`
- ❌ Don't use overlapping alternations `(a|aa)+`
- ❌ Avoid patterns matching common single words
- ❌ Don't ignore ReDoS warnings

**Common Patterns by Field**:

| Use Case         | Target Field | Pattern                    |
| ---------------- | ------------ | -------------------------- |
| Skip anthologies | titles       | `anthology`                |
| Skip one-shots   | titles       | `^one.?shot$`              |
| Skip volumes     | titles       | `vol(ume)?\s*\d+`          |
| Skip format      | format       | `LIGHT_NOVEL\|LIGHT NOVEL` |
| Accept publisher | description  | `shueisha\|viz`            |
| Accept author    | author       | `^kishimoto`               |
| Accept status    | status       | `PUBLISHING`               |

**ReDoS Security**:

- **Nested Quantifiers**: `(a+)+` on input "aaaaaaaab" causes exponential backtracking
- **Overlapping Alternations**: `(a\|aa)+` tries multiple matching paths
- **Catastrophic Patterns**: `^(.*a)*$` with no match triggers worst-case complexity
- **Detection**: App validates during rule creation, warns but allows user choice
- **Reference**: [OWASP ReDoS Guide](https://owasp.org/www-community/attacks/Regular_expression_Denial_of_Service_-_ReDoS)

**Error Handling**:

- Invalid regex caught during validation (try-catch on new RegExp)
- Malformed rules logged but don't crash matching
- Graceful degradation if customRules undefined
- Validation errors prevent rule save, shown in UI

**Performance Considerations**:

- Pattern evaluation only on enabled rules
- Short-circuit on first match per field
- Metadata extraction cached per evaluation
- Minimal overhead (~1ms per manga with 10 rules)
- Multiple fields increase evaluation time (O(n\*m) where n=rules, m=fields)

**Anti-Patterns**:

- ❌ Creating duplicate rules (use edit instead)
- ❌ Using patterns without testing thoroughly
- ❌ Overly complex regex (use multiple simple rules)
- ❌ Forgetting to enable rules after creation
- ❌ Not providing descriptions (hard to maintain later)
- ❌ Selecting all targetFields unnecessarily (performance hit)
- ❌ Using broad patterns like `.*` (matches everything)
- ❌ Testing with typo patterns and saving anyway
