# Kenmei to AniList - AI Coding Assistant Instructions

## 🚨 CRITICAL: Workflow

**ALWAYS follow this sequence**:

1. `mcp_oraios_serena_activate_project "KenmeiToAnilist"` - Activate project first
2. Explore with Serena tools (`get_symbols_overview`, `find_symbol`, `search_for_pattern`, `list_dir`)
3. Use `think_about_collected_information` after gathering context
4. Make precise edits
5. Use `think_about_task_adherence` before committing changes
6. Use `think_about_whether_you_are_done` to verify completion

**KEY**: Use Serena tools for discovery, not `read_file`. Memories are for context only—NOT documentation summaries.

## Essential Resources

- `docs/guides/ARCHITECTURE.md` - Architecture overview
- `docs/guides/STORAGE_IMPLEMENTATION.md` - Storage details
- `docs/guides/API_REFERENCE.md` - AniList API integration

## Serena Tools

### Thinking Tools (Reflection & Verification)

- **`think_about_collected_information`**: Verify gathered context is sufficient and relevant
- **`think_about_task_adherence`**: Ensure you're still on track before making edits
- **`think_about_whether_you_are_done`**: Verify all requirements are met after completing

### Exploration Tools (Code Discovery)

- **`get_symbols_overview`**: High-level view of top-level symbols in a file
- **`find_symbol`**: Locate specific symbol by name path with optional depth
- **`search_for_pattern`**: Regex search when you don't know exact symbol names
- **`list_dir`**: Understand project structure
- **`find_file`**: Search files by glob pattern

**Best Practice**: Always explore with these tools BEFORE using `read_file`. Saves tokens and time.

## Critical Patterns to Follow

### 1. Storage Operations

**NEVER** access localStorage or electron-store directly. Use `src/utils/storage.ts` abstraction:

```typescript
import { storage, STORAGE_KEYS } from "@/utils/storage";
storage.setItem(STORAGE_KEYS.KENMEI_DATA, JSON.stringify(data));
const data = storage.getItem(STORAGE_KEYS.KENMEI_DATA);
```

### 2. IPC Communication

**Security violation** to use `ipcRenderer` in renderer. Use exposed context APIs instead:

```typescript
// ✅ Correct
await globalThis.electronStore.setItem(key, value);
const token = await globalThis.electronAuth.getAccessToken(code);
```

### 3. Error Handling

Use `createError()` from `src/utils/errorHandling.ts`:

```typescript
import { createError, ErrorType } from "@/utils/errorHandling";
throw createError(ErrorType.NETWORK, "Failed to fetch", error, "NETWORK_UNAVAILABLE");
```

## Memory Strategy

Use memories for context only:

- **Project patterns**: Recurring code patterns, conventions, architectural rules
- **Critical decisions**: Why certain choices were made, constraints to maintain
- **Essential workflows**: Complex multi-step processes that are hard to discover

**Do NOT write memories for**: Documentation summaries, code overviews, or API reference (use Serena tools instead).

**Critical Success Factors:**

- ✅ Always activate project before using Serena tools
- ✅ Use Serena tools for code exploration before reading files
- ✅ Write memories only for essential context, not documentation summaries
- ✅ Always use storage abstraction (never direct localStorage)
- ✅ Never use ipcRenderer directly (use exposed contexts)
- ✅ Check rate limits before bulk API operations
- ✅ Follow rules of hooks (React Compiler enforces)
