# Kenmei to AniList - AI Coding Assistant Instructions

## 🚨 CRITICAL: Tool Usage Priority

**ALWAYS USE THESE TOOLS FIRST** - This is the most important context for working in this codebase:

### Serena Tools (Code Navigation & Editing)

Serena provides **semantic coding tools** that understand the codebase structure. Use these tools BEFORE reading entire files:

1. **Code Exploration** (use these first):
   - `mcp_oraios_serena_get_symbols_overview` - Get high-level overview of a file's symbols/structure
   - `mcp_oraios_serena_find_symbol` - Find classes, methods, functions by name path (e.g., `ClassName/methodName`)
   - `mcp_oraios_serena_find_referencing_symbols` - Find all references to a symbol
   - `mcp_oraios_serena_search_for_pattern` - Search for regex patterns in codebase

2. **Code Editing** (symbol-based precision):
   - `mcp_oraios_serena_replace_symbol_body` - Replace entire symbol body (method, class, function)
   - `mcp_oraios_serena_insert_after_symbol` - Insert code after a symbol
   - `mcp_oraios_serena_insert_before_symbol` - Insert code before a symbol (e.g., imports)

3. **Why Use Serena**:
   - ✅ Token-efficient: Read only what you need, not entire files
   - ✅ Precise edits: Modify specific methods/classes without manual line counting
   - ✅ Context-aware: Understand symbol relationships and references
   - ❌ **Don't read entire files unless necessary or prompted to** - use symbol tools first!

### SonarQube Tools (Code Quality & Security)

Use SonarQube tools to analyze code quality and catch issues early:

1. **Code Analysis**:
   - `sonarqube_analyze_file` - Analyze a file for code quality and security issues
   - `sonarqube_list_potential_security_issues` - Find security hotspots and taint vulnerabilities

2. **When to Use**:
   - ✅ After making changes to analyze impact
   - ✅ Before committing to catch issues early
   - ✅ When debugging to identify code smells
   - ✅ For security-sensitive code (auth, IPC, storage)

### Tool Usage Workflow

```text
1. Explore with Serena (get_symbols_overview, find_symbol)
2. Make targeted changes (replace_symbol_body, insert_*)
3. Verify with SonarQube (analyze_file)
4. Only read full files if symbolic approach insufficient
```

## Project Overview

Electron desktop app (React 19 + TypeScript) for migrating manga libraries from Kenmei to AniList. Built with secure main/renderer process architecture, three-layer storage system, GraphQL API integration, and React Compiler optimization.

**Key Technologies**: Electron 38, React 19, TanStack Router, TailwindCSS 4.1, shadcn/ui (Radix UI), Vite 7, Electron Forge

## Essential Reference Documents

- `docs/guides/ARCHITECTURE.md` - Complete architecture overview (774 lines)
- `docs/guides/STORAGE_IMPLEMENTATION.md` - Storage system details
- `docs/guides/API_REFERENCE.md` - AniList GraphQL API integration
- `documentation/` - Generated TypeDoc API documentation

## Architecture Patterns

### Process Communication (Electron IPC)

**Critical Security Pattern**: All IPC communication uses context bridge pattern via `src/helpers/ipc/context-exposer.ts`

```typescript
// Context exposer combines 5 domain contexts
exposeWindowContext(); // Window management
exposeThemeContext(); // Theme persistence
exposeAuthContext(); // OAuth & credentials
exposeStoreContext(); // electron-store access
exposeApiContext(); // AniList API calls
```

**IPC Organization**: Handlers organized by domain in `src/helpers/ipc/{api,auth,store,theme,window}/`

- Never use `ipcRenderer` directly in renderer process
- All main process handlers registered via `src/helpers/ipc/listeners-register.ts`
- Access via `globalThis.electronStore`, `globalThis.electronAuth`, etc.

### Three-Layer Storage Architecture

**CRITICAL HIERARCHY** (`src/utils/storage.ts`): Storage operations MUST respect this precedence:

1. **In-memory cache** (`storageCache`) - Fastest, volatile, cleared on restart
2. **localStorage** - Browser storage, synchronous, renderer-only
3. **Electron Store** - **AUTHORITATIVE SOURCE**, file-based, encrypted, async IPC

**Read Flow**: Check cache → localStorage → electron-store (async)
**Write Flow**: Update all three layers, electron-store is source of truth
**Conflict Resolution**: Electron Store always wins

**Storage Keys** (from `STORAGE_KEYS` constant):

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

**Cache Versioning**: `CURRENT_CACHE_VERSION = 1` - increment for breaking changes to invalidate old data

### State Management

**React Context Providers** (`src/contexts/`):

- `AuthContext` - OAuth flow, credentials, viewer data, custom client IDs
- `DebugContext` - Debug mode, log viewer, IPC monitor, state inspector
- `ThemeContext` - Dark/light/system theme with persistence
- `RateLimitContext` - AniList rate limit tracking (60 requests/minute)

**Context Pattern**: All contexts use TypeScript interfaces, provide default values, and expose via custom hooks (`useAuth`, `useDebug`, etc.)

### API Integration (AniList GraphQL)

**Client**: `src/api/anilist/client.ts` (1295 lines)

- **Search Cache**: 30-minute expiration (`CACHE_EXPIRATION = 30 * 60 * 1000`)
- **localStorage Persistence**: Cache survives restarts via `anilist_search_cache` key
- **Cache Initialization**: One-time load via `initializeSearchCache()`, check `searchCacheInitialized` flag
- **Rate Limiting**: Built-in retry logic for 429 responses with `retryAfter` handling

**GraphQL Queries**: `src/api/anilist/queries.ts` exports `SEARCH_MANGA`, `ADVANCED_SEARCH_MANGA`, `GET_MANGA_BY_IDS`, `GET_USER_MANGA_LIST`, `GET_VIEWER`

**Error Types** (`src/utils/errorHandling.ts`):

```typescript
enum ErrorType {
  UNKNOWN,
  VALIDATION,
  NETWORK,
  AUTH,
  SERVER,
  CLIENT,
  STORAGE,
  AUTHENTICATION,
  SYSTEM,
}
```

## Development Workflow

### Build & Run Commands

```bash
npm start              # Dev with hot reload (Vite + Electron)
npm run make           # Production build for all platforms
npm run build          # Alias for electron-forge make
npm run lint           # ESLint 9 with React Compiler plugin
npm run format:write   # Prettier (auto-format all files)
npm run docs           # Generate TypeDoc to documentation/
npm run precommit      # Format + lint (Husky pre-commit)
npm run update         # Update dependencies (ncu -u)
```

### Project Structure

```text
src/
├── api/              # AniList, Kenmei, matching algorithms
├── components/       # Feature-specific + ui/ (shadcn/ui)
│   ├── debug/       # Debug panels (log viewer, state inspector)
│   ├── import/      # CSV import flow
│   ├── layout/      # BaseLayout, navigation
│   ├── matching/    # Match review, confidence display
│   ├── settings/    # Sync config, credentials
│   ├── sync/        # Batch sync, progress tracking
│   └── ui/          # shadcn/ui components (button, dialog, etc.)
├── contexts/         # AuthContext, DebugContext, ThemeContext, RateLimitContext
├── helpers/ipc/      # Main process IPC handlers (organized by domain)
├── hooks/            # useAuth, useSyncProgress, useRateLimit, etc.
├── pages/            # Route components (HomePage, ImportPage, etc.)
├── routes/           # TanStack Router config (__root.tsx, routes.tsx, router.tsx)
├── types/            # TypeScript interfaces (auth, debug, sync, etc.)
└── utils/            # storage.ts, errorHandling.ts, logging.ts, similarity.ts
```

### Routing Pattern (TanStack Router)

- **Memory History**: `createMemoryHistory()` for Electron (no URLs)
- **Root Layout**: `__root.tsx` wraps all routes with `BaseLayout`
- **Type Safety**: Module augmentation for router type inference

### Component & Styling Patterns

**shadcn/ui**: All UI components in `src/components/ui/` use Radix UI + CVA (class-variance-authority)

- Import pattern: `from "@/components/ui/button"`
- Variants defined with `cva()` for type-safe prop-based styling

**TailwindCSS 4.1**: Uses `@tailwindcss/vite` plugin (NOT PostCSS)

- Path alias: `@/*` maps to `./src/*` (tsconfig.json + vite config)
- Prettier plugin: `prettier-plugin-tailwindcss` for auto-sorting classes

**Animations**:

- Page transitions: Framer Motion
- Micro-interactions: tailwindcss-animate
- Performance: React Compiler auto-optimization (babel-plugin-react-compiler)

### Build Configuration

**Electron Forge** (`config/forge.config.js`):

- **Makers**: Squirrel (Windows), DMG (macOS), Deb/Zip (Linux)
- **Icon**: `src/assets/k2a-icon-512x512.{ico,png,icns}`
- **Fuses**: Security hardening (@electron/fuses)
- **ASAR**: Enabled for code protection

**Vite**: Three separate configs for main/preload/renderer processes

- `config/vite.main.config.ts` - Main process (Node.js)
- `config/vite.preload.config.ts` - Preload script (context bridge)
- `config/vite.renderer.config.mts` - React renderer (@vitejs/plugin-react)

## Critical Patterns to Follow

### 0. Tool Usage (MOST IMPORTANT)

**Before making ANY changes**, follow this workflow:

1. **Explore Code with Serena Tools**:
   - Use `mcp_oraios_serena_get_symbols_overview` to understand file structure
   - Use `mcp_oraios_serena_find_symbol` to locate specific functions/classes
   - Use `mcp_oraios_serena_find_referencing_symbols` to understand dependencies
   - ❌ DON'T read entire files without exploring symbols first or prompted to

2. **Make Precise Edits**:
   - Use `mcp_oraios_serena_replace_symbol_body` for method/class changes
   - Use `mcp_oraios_serena_insert_after_symbol` / `insert_before_symbol` for additions
   - ❌ DON'T use line-based editing unless symbolic approach fails

3. **Verify Quality**:
   - Use `sonarqube_analyze_file` after changes
   - Check for security issues in code
   - Fix any code smells or vulnerabilities before committing

### 1. Storage Operations

**NEVER** access localStorage or electron-store directly. Always use `src/utils/storage.ts` abstraction:

```typescript
import { storage, STORAGE_KEYS } from "@/utils/storage";
storage.setItem(STORAGE_KEYS.KENMEI_DATA, JSON.stringify(data));
const data = storage.getItem(STORAGE_KEYS.KENMEI_DATA);
```

### 2. IPC Communication

**Security violation** to use `ipcRenderer` in renderer. Use exposed context APIs:

```typescript
// ✅ Correct
await globalThis.electronStore.setItem(key, value);
const token = await globalThis.electronAuth.getAccessToken(code);

// ❌ Wrong - security violation
ipcRenderer.invoke("store:set", key, value);
```

### 3. Error Handling

Use `createError()` from `src/utils/errorHandling.ts` for consistent error objects:

```typescript
import { createError, ErrorType } from "@/utils/errorHandling";
throw createError(ErrorType.NETWORK, "Failed to fetch", error, "NETWORK_UNAVAILABLE");
```

### 4. Type Safety

- **Strict mode enabled**: `noImplicitAny: true`, `strict: true`
- API responses: Define interfaces in `src/types/` or inline with GraphQL queries
- React Compiler enforces rules of hooks (eslint-plugin-react-compiler)

### 5. Performance Considerations

- **React Compiler**: Automatic memoization, avoid manual `useMemo`/`useCallback` unless profiling shows benefit
- **Search Cache**: Respect 30-minute expiration, don't bypass cache logic
- **Rate Limiting**: Check `RateLimitContext` before bulk API operations

## Testing & Debugging

**Debug Mode** (`DebugContext`):

- Enable via settings menu
- Log viewer with console interception (`src/utils/logging.ts`)
- State inspector for Auth/Debug/Theme contexts
- IPC monitor (TODO: see DebugContext.tsx line 10)

**No formal test suite currently** - manual testing workflow

**TypeDoc**: Auto-generated from JSDoc comments (`@packageDocumentation`, `@source`, `@internal`)

## Common Pitfalls

1. **Storage Layer Confusion**: Don't mix direct localStorage with storage abstraction
2. **IPC Security**: Never expose Node.js APIs to renderer without context bridge
3. **Cache Invalidation**: Increment `CURRENT_CACHE_VERSION` when data structures change
4. **Rate Limiting**: AniList enforces 60 req/min - batch operations must respect this
5. **React Compiler**: Breaking rules of hooks will cause ESLint errors (can't disable)

## When Making Changes

1. **New IPC Operations**: Add handler in `src/helpers/ipc/{domain}/`, expose in context, register in listeners
2. **New Storage Keys**: Add to `STORAGE_KEYS` constant, update cache version if structure changes
3. **New UI Components**: Use shadcn/ui pattern, place in `src/components/ui/`, import via `@/components/ui/*`
4. **New API Queries**: Define in `src/api/anilist/queries.ts`, add types to `src/api/anilist/types.ts`
5. **New Routes**: Create in `src/routes/`, export from `routes.tsx`, add to route tree
