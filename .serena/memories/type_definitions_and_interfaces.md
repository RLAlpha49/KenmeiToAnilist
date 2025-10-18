# Type Definitions & Interfaces Reference

## Auth Types (`src/types/auth.ts`)

**AuthState** - Current user authentication status

- `isAuthenticated: boolean` - Whether user is logged in
- `username?: string` - AniList username
- `avatarUrl?: string` - User avatar URL
- `userId?: number` - AniList user ID
- `accessToken?: string` - OAuth access token
- `expiresAt?: number` - Token expiration timestamp
- `credentialSource: "default" | "custom"` - Which credentials were used

**APICredentials** - OAuth credentials for authentication

- `source: "default" | "custom"` - Credential source
- `clientId: string` - OAuth client ID
- `clientSecret: string` - OAuth client secret
- `redirectUri: string` - OAuth redirect URI

**TokenExchangeResponse** - Result of token exchange

- `success: boolean` - Whether exchange succeeded
- `token?: { access_token, token_type, expires_in }` - Token info if successful
- `error?: string` - Error message if failed

## Matching Types (`src/types/matching.ts`)

**MatchingProgress** - Progress tracking during batch matching

- `current: number` - Items processed so far
- `total: number` - Total items to process
- `currentTitle: string | undefined` - Currently processing item

**TimeEstimate** - ETA calculation

- `startTime: number` - Process start timestamp
- `averageTimePerManga: number` - Average seconds per item
- `estimatedRemainingSeconds: number` - Estimated seconds left

**StatusFilterOptions** - Filtering match results by status

- `pending: boolean` - Show unmatched items
- `skipped: boolean` - Show skipped items
- `matched: boolean` - Show auto-matched items
- `manual: boolean` - Show manually matched items
- `unmatched: boolean` - Show unmatched items

**MatchHandlersProps** - Component handlers for match actions

- `onManualSearch(manga: KenmeiManga)` - User manually searches for match
- `onAcceptMatch(match: MangaMatchResult)` - User accepts match
- `onRejectMatch(match: MangaMatchResult)` - User rejects match
- `onSelectAlternative(match, index)` - User selects alternative match
- `onResetToPending(match)` - User resets match to pending status

**ApiError** - API error details

- `name?: string` - Error name
- `message?: string` - Human-readable message
- `status?: number` - HTTP status code (429 for rate limit)
- `statusText?: string` - HTTP status text
- `errors?: Array<{ message }>` - GraphQL errors array

## Debug Types (`src/types/debug.ts`)

**IpcLogEntry** - Single IPC communication log

- `id: string` - Unique identifier
- `correlationId?: string` - Links request-response pairs
- `channel: string` - IPC channel name
- `direction: "sent" | "received"` - Communication direction
- `transport: "invoke" | "send" | "event" | "message" | "invoke-response"`
- `status?: "pending" | "fulfilled" | "rejected"` - Operation status
- `timestamp: string` - ISO timestamp
- `durationMs?: number` - How long operation took
- `payload: { raw: unknown, preview: string }` - Message data + preview
- `error?: string` - Error message if operation failed

**DebugEventRecord** - Debug event with type/message

- `type: string` - Event category
- `message: string` - Event description
- `level: "info" | "warn" | "error" | "success" | "debug"` - Severity

## Kenmei Types (`src/types/kenmei.ts`)

**KenmeiMangaItem** - Single manga from Kenmei CSV

- `title: string` - Manga title
- `status: string` - Reading status (READING, COMPLETED, etc.)
- `chapters: number` - Chapters read
- `volumes: number` - Volumes read
- `score: number` - User score
- `notes?: string` - User notes

**KenmeiData** - Entire imported CSV data

- `version?: string` - Format version
- `exported_at?: string` - Export timestamp
- Array of manga items

## API Types (`src/api/anilist/types.ts`)

**MangaMatchResult** - Match between Kenmei and AniList manga

- `kenmeiManga: KenmeiManga` - Original Kenmei manga
- `anilistMatches?: MangaMatch[]` - Search results from AniList ← CLEARED on rematch
- `selectedMatch?: AniListManga` - User's selected match ← CLEARED on rematch
- `status: MatchStatus` - Current match status (pending, matched, manual, etc.)
- `matchDate?: Date` - When match was made

**AniListManga** - Manga entry from AniList

- `id: number` - AniList ID
- `title: { romaji, english, native }` - Multiple title formats
- `coverImage: { large, medium }` - Cover image URLs
- `format: string` - Format (MANGA, NOVEL, ONE_SHOT, etc.)
- `chapters?: number` - Total chapters
- `volumes?: number` - Total volumes
- `status: string` - Publication status (ONGOING, COMPLETED, etc.)
- `description?: string` - Synopsis

**MediaListEntry** - Entry in user's AniList media list

- `mediaId: number` - AniList media ID
- `status: string` - User's status (READING, COMPLETED, etc.)
- `progress: number` - Chapters/episodes watched
- `score: number` - User's score
- `notes?: string` - User's notes

## Window Extensions (`src/types/matching.ts`)

Global window object extended with matching state:

```typescript
declare global {
  interface Window {
    activeAbortController?: AbortController;
    matchingProcessState?: {
      isRunning: boolean;
      progress: MatchingProgress;
      statusMessage: string;
      detailMessage: string | null;
      timeEstimate: TimeEstimate;
      lastUpdated: number;
    };
  }
}
```

## Theme Types (`src/types/theme-mode.ts`)

**ThemeMode** - Application theme

- `"dark"` - Dark theme
- `"light"` - Light theme
- `"system"` - Follow OS theme preference

## Where Types Are Used

- `AuthState` - AuthContext, useAuth hook
- `MangaMatchResult` - Matching pages, handlers
- `MatchingProgress` - useMatchingProcess hook
- `IpcLogEntry` - Debug context, IPC viewer
- `ApiError` - Error handling throughout app
- `ThemeMode` - ThemeContext, settings

## Extending Types

When adding new data structures:

1. Define interface in appropriate `src/types/*.ts` file
2. Add @param/@returns JSDoc comments
3. Export from file for re-export in barrel exports
4. Update STORAGE_KEYS if storing in electron-store
5. Increment CURRENT_CACHE_VERSION if breaking cache format
