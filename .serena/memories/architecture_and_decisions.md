# Architecture & Technical Decisions

## Core Architecture Layers

### Three-Layer Storage System

**CRITICAL PRECEDENCE** (from `src/utils/storage.ts`):

1. **In-memory cache** (`storageCache`) - Volatile, cleared on restart, fastest
2. **localStorage** - Browser storage, synchronous, renderer-only
3. **Electron Store** - AUTHORITATIVE SOURCE, file-based, encrypted, async IPC

**Read flow**: Check cache → localStorage → electron-store (async)  
**Write flow**: Update all three layers, electron-store is source of truth  
**Conflict resolution**: Electron Store always wins

### Search Cache Architecture

**Purpose**: Reduce AniList API calls (60 req/min rate limit)

**Cache expiration**: 30 minutes (`CACHE_EXPIRATION = 30 * 60 * 1000`)  
**Persistence**: localStorage via `anilist_search_cache` key  
**Initialization**: One-time via `initializeSearchCache()`, check `searchCacheInitialized` flag

**bypassCache behavior**:

- `true` (manual search): Always fetch fresh from API, override old cache
- `false` (automatic): Check cache first, only fetch on miss

### Matching Cache Management

**Data Structure**: `MangaMatchResult` interface has two cache-related properties:

- `anilistMatches?: MangaMatch[]` - Cached search results for AniList
- `selectedMatch?: AniListManga` - Selected/approved match

**When rematching**: Both fields must be cleared to `undefined`/`[]` so fresh matches can be fetched

### IPC Communication Architecture

**Pattern**: Context bridge via `src/helpers/ipc/context-exposer.ts`

Exposes 5 domain contexts:

- `globalThis.electronWindow` - Window management
- `globalThis.electronTheme` - Theme persistence
- `globalThis.electronAuth` - OAuth flows & credentials
- `globalThis.electronStore` - Electron-store file access
- `globalThis.electronApi` - AniList API calls

**Handler organization**: `src/helpers/ipc/{domain}/`

- `api/` - AniList API, sync service
- `auth/` - OAuth, token management
- `store/` - electron-store access
- `theme/` - Theme persistence
- `window/` - Window management

**Registration**: `src/helpers/ipc/listeners-register.ts` - All handlers registered once at app startup

## React Context Architecture

**AuthContext** (`src/contexts/AuthContext.tsx`):

- OAuth flow (Kenmei + AniList)
- Token management & refresh
- Custom client ID storage
- Viewer data caching

**DebugContext** (`src/contexts/DebugContext.tsx`):

- Debug mode toggle
- Console log viewer
- State inspector
- IPC monitor

**ThemeContext** (`src/contexts/ThemeContext.tsx`):

- Dark/light/system theme
- Persistence via electron-store
- CSS class injection

**RateLimitContext** (`src/contexts/RateLimitContext.tsx`):

- AniList rate limit tracking (60 req/min)
- Used to batch operations and prevent rate limit hits

## API Integration Architecture

**Client**: `src/api/anilist/client.ts` (1295 lines)

- Search cache with 30-minute expiration
- localStorage persistence for cache survival across restarts
- Retry logic for 429 responses with `retryAfter` handling
- Rate limit awareness

**Queries**: `src/api/anilist/queries.ts` exports:

- `SEARCH_MANGA` - Basic manga search
- `ADVANCED_SEARCH_MANGA` - Advanced search with filters
- `GET_MANGA_BY_IDS` - Batch fetch by IDs
- `GET_USER_MANGA_LIST` - Fetch user's anime/manga list
- `GET_VIEWER` - Current viewer info

**Mutations**: `src/api/anilist/mutations.ts`:

- `generateUpdateMangaEntryMutation()` - Create mutation for manga updates

**Error Handling**: `src/utils/errorHandling.ts`

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

## Routing Architecture

**Pattern**: TanStack Router with memory history (no URLs for Electron)

**Setup**:

- `src/routes/__root.tsx` - Root layout wrapping all routes with `BaseLayout`
- `src/routes/routes.tsx` - Route definitions (HomePage, MatchingPage, etc.)
- `src/routes/router.tsx` - Router instance with memory history
- Module augmentation for type-safe router

**Navigation**: Use `useRouter()` hook from TanStack Router

## UI Component Architecture

**Pattern**: shadcn/ui (Radix UI + CVA) + TailwindCSS 4.1

**Component structure**:

- All UI primitives in `src/components/ui/`
- Feature components in `src/components/{feature}/`
- shadcn/ui components use Radix UI under the hood

**Styling**:

- TailwindCSS 4.1 with `@tailwindcss/vite` plugin (not PostCSS)
- CVA for type-safe variant props
- Prettier plugin auto-sorts Tailwind classes

**Animations**:

- Framer Motion for page transitions
- tailwindcss-animate for micro-interactions
- React Compiler auto-optimizes

## Build Architecture

**Electron Forge** (`config/forge.config.js`):

- Makers: Squirrel (Windows), DMG (macOS), Deb/Zip (Linux)
- Icon: `src/assets/k2a-icon-512x512.{ico,png,icns}`
- Fuses: Security hardening via `@electron/fuses`
- ASAR: Enabled for code protection

**Vite configs**:

- `config/vite.main.config.ts` - Main process (Node.js)
- `config/vite.preload.config.ts` - Preload script (context bridge)
- `config/vite.renderer.config.mts` - React renderer (@vitejs/plugin-react)

## Matching Algorithm Architecture

**Process**:

1. Import CSV → Extract manga data
2. Search AniList for each title
3. Score candidates using enhanced similarity
4. Rank matches by confidence
5. Display to user for review
6. Sync approved matches to AniList

**Similarity scoring** (`src/utils/enhanced-similarity.ts`):

- Exact matching
- Substring matching
- Word order analysis
- Character-level similarity (Jaro-Winkler)
- Semantic similarity (stemming, Jaccard)
- N-gram analysis
- Caching for performance

**Matching confidence**: 20-point lead between top 2 candidates = auto-match
