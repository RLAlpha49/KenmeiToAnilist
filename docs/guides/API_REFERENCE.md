# API Reference - AniList Integration

This document provides detailed information about how Kenmei to AniList integrates with the AniList GraphQL API.

## 📋 Table of Contents

- [Overview](#-overview)
- [Authentication](#-authentication)
- [Search Operations](#-search-operations)
- [User Library Operations](#-user-library-operations)
- [Update Operations](#-update-operations)
- [Data Types](#-data-types)
- [Error Handling](#-error-handling)
- [Request Implementation](#-request-implementation)
- [External Resources](#-external-resources)

## 🔎 Overview

The app uses AniList's GraphQL API v2 for all data operations. This includes authentication, searching for manga, retrieving user lists, and updating manga entries.

**Base URL**: `https://graphql.anilist.co`

## 🔐 Authentication

### OAuth 2.0 Flow

The app uses OAuth 2.0 authorization code flow for secure authentication.

#### Configuration

```typescript
// Default OAuth settings
const OAUTH_CONFIG = {
  clientId: "your-client-id",
  clientSecret: "your-client-secret",
  redirectUri: "http://localhost:3000/auth/callback",
  scope: "read write",
};
```

#### Authorization URL

```typescript
// OAuth URL is constructed dynamically based on stored credentials
function getOAuthUrl(clientId: string, redirectUri: string): string {
  const encodedClientId = encodeURIComponent(clientId);
  const encodedRedirectUri = encodeURIComponent(redirectUri);
  
  return `https://anilist.co/api/v2/oauth/authorize?client_id=${encodedClientId}&redirect_uri=${encodedRedirectUri}&response_type=code`;
}
```

#### Token Exchange

```typescript
// Token exchange is handled in main process via IPC
interface TokenExchangeParams {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  code: string;
}

interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
}

async function exchangeToken(params: TokenExchangeParams): Promise<{
  success: boolean;
  token?: TokenResponse;
  error?: string;
}> {
  try {
    const response = await fetch("https://anilist.co/api/v2/oauth/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        grant_type: "authorization_code",
        ...params,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const tokenResponse: TokenResponse = await response.json();
    return { success: true, token: tokenResponse };
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "Token exchange failed" 
    };
  }
}
```

## 🔍 Search Operations

### Basic Manga Search

```graphql
query SearchManga($search: String, $page: Int, $perPage: Int) {
  Page(page: $page, perPage: $perPage) {
    pageInfo {
      total
      currentPage
      lastPage
      hasNextPage
      perPage
    }
    media(type: MANGA, search: $search) {
      id
      title {
        romaji
        english
        native
      }
      synonyms
      description
      format
      status
      chapters
      volumes
      countryOfOrigin
      source
      coverImage {
        large
        medium
      }
      genres
      tags {
        id
        name
        category
      }
      startDate {
        year
        month
        day
      }
      mediaListEntry {
        id
        status
        progress
        score
        private
      }
      isAdult
    }
  }
}
```

### Advanced Search with Filters

```graphql
query AdvancedSearchManga(
  $search: String
  $page: Int
  $perPage: Int
  $genre_in: [String]
  $tag_in: [String]
  $format_in: [MediaFormat]
) {
  Page(page: $page, perPage: $perPage) {
    pageInfo {
      total
      currentPage
      lastPage
      hasNextPage
      perPage
    }
    media(
      type: MANGA, 
      search: $search, 
      genre_in: $genre_in, 
      tag_in: $tag_in, 
      format_in: $format_in
    ) {
      id
      title {
        romaji
        english
        native
      }
      synonyms
      description
      format
      status
      chapters
      volumes
      countryOfOrigin
      coverImage {
        large
        medium
      }
      genres
      tags {
        id
        name
        category
      }
      startDate {
        year
        month
        day
      }
      mediaListEntry {
        id
        status
        progress
        score
        private
      }
      isAdult
    }
  }
}
```

## 📚 User Library Operations

### Get User's Manga List

```graphql
query GetUserMangaList($userId: Int, $chunk: Int, $perChunk: Int) {
  MediaListCollection(userId: $userId, type: MANGA, chunk: $chunk, perChunk: $perChunk) {
    lists {
      name
      entries {
        id
        mediaId
        status
        progress
        score
        private
        media {
          id
          title {
            romaji
            english
            native
          }
          format
          status
          chapters
        }
      }
    }
  }
}
```

### Get Manga by IDs

```graphql
query GetMangaByIds($ids: [Int!]!) {
  Page(page: 1, perPage: 50) {
    media(id_in: $ids, type: MANGA) {
      id
      title {
        romaji
        english
        native
      }
      format
      status
      chapters
      volumes
      coverImage {
        medium
      }
      startDate {
        year
        month
        day
      }
      endDate {
        year
        month
        day
      }
      genres
      averageScore
      meanScore
      isAdult
    }
  }
}
```

## ✏️ Update Operations

### Update Manga Entry

```graphql
mutation UpdateMangaEntry(
  $mediaId: Int!
  $status: MediaListStatus
  $score: Float
  $progress: Int
  $progressVolumes: Int
  $repeat: Int
  $priority: Int
  $private: Boolean
  $notes: String
  $hiddenFromStatusLists: Boolean
  $customLists: [String]
  $advancedScores: [Float]
  $startedAt: FuzzyDateInput
  $completedAt: FuzzyDateInput
) {
  SaveMediaListEntry(
    mediaId: $mediaId
    status: $status
    score: $score
    progress: $progress
    progressVolumes: $progressVolumes
    repeat: $repeat
    priority: $priority
    private: $private
    notes: $notes
    hiddenFromStatusLists: $hiddenFromStatusLists
    customLists: $customLists
    advancedScores: $advancedScores
    startedAt: $startedAt
    completedAt: $completedAt
  ) {
    id
    mediaId
    status
    score
    progress
    progressVolumes
    repeat
    priority
    private
    notes
    hiddenFromStatusLists
    customLists
    advancedScores
    startedAt {
      year
      month
      day
    }
    completedAt {
      year
      month
      day
    }
    updatedAt
    media {
      id
      title {
        romaji
        english
        native
      }
    }
  }
}
```

### Delete Manga Entry

```graphql
mutation DeleteMangaEntry($id: Int!) {
  DeleteMediaListEntry(id: $id) {
    deleted
  }
}
```

## 📊 Data Types

### Media List Status

```typescript
enum MediaListStatus {
  CURRENT = "CURRENT",
  PLANNING = "PLANNING",
  COMPLETED = "COMPLETED",
  DROPPED = "DROPPED",
  PAUSED = "PAUSED",
  REPEATING = "REPEATING",
}
```

### Media Format

```typescript
enum MediaFormat {
  MANGA = "MANGA",
  NOVEL = "NOVEL",
  ONE_SHOT = "ONE_SHOT",
}
```

### Media Status

```typescript
enum MediaStatus {
  FINISHED = "FINISHED",
  RELEASING = "RELEASING",
  NOT_YET_RELEASED = "NOT_YET_RELEASED",
  CANCELLED = "CANCELLED",
  HIATUS = "HIATUS",
}
```

### Date Input

```typescript
interface FuzzyDateInput {
  year?: number;
  month?: number;
  day?: number;
}
```

## 🚨 Error Handling

### Rate Limiting

#### Rate Limit Headers

```typescript
interface RateLimitHeaders {
  "x-ratelimit-limit": string; // Total requests allowed
  "x-ratelimit-remaining": string; // Requests remaining
  "x-ratelimit-reset": string; // Reset timestamp
}
```

#### Handling Rate Limits

```typescript
async function handleRateLimit(response: Response): Promise<void> {
  if (response.status === 429) {
    const resetTime = response.headers.get("x-ratelimit-reset");
    const delay = resetTime ? Number.parseInt(resetTime) * 1000 - Date.now() : 60000;

    console.log(`Rate limited. Waiting ${delay}ms before retry...`);
    await new Promise((resolve) => setTimeout(resolve, delay));
  }
}
```

### GraphQL Errors

```typescript
interface GraphQLError {
  message: string;
  locations?: Array<{
    line: number;
    column: number;
  }>;
  path?: string[];
  extensions?: {
    code?: string;
    exception?: any;
  };
}

interface GraphQLResponse<T> {
  data?: T;
  errors?: GraphQLError[];
}
```

### Common Error Codes

| Code                | Description              | Action           |
| ------------------- | ------------------------ | ---------------- |
| `UNAUTHENTICATED`   | Invalid or expired token | Re-authenticate  |
| `FORBIDDEN`         | Insufficient permissions | Check scopes     |
| `NOT_FOUND`         | Resource doesn't exist   | Verify ID        |
| `VALIDATION_FAILED` | Invalid input data       | Check parameters |
| `RATE_LIMITED`      | Too many requests        | Wait and retry   |

## 🔧 Request Implementation

### Base Request Function

```typescript
interface AniListResponse<T> {
  data?: T;
  errors?: Array<{
    message: string;
    locations?: Array<{ line: number; column: number }>;
    path?: string[];
  }>;
}

async function request<T>(
  query: string,
  variables?: Record<string, any>,
  accessToken?: string,
  abortSignal?: AbortSignal,
  bypassCache?: boolean,
): Promise<AniListResponse<T>> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };

  if (accessToken) {
    headers["Authorization"] = `Bearer ${accessToken}`;
  }

  const response = await fetch("https://graphql.anilist.co", {
    method: "POST",
    headers,
    signal: abortSignal,
    body: JSON.stringify({
      query,
      variables,
    }),
  });

  if (!response.ok) {
    if (response.status === 429) {
      // Handle rate limiting
      const resetTime = response.headers.get("x-ratelimit-reset");
      const retryAfter = resetTime ? Number.parseInt(resetTime, 10) - Math.floor(Date.now() / 1000) : 60;
      
      throw {
        message: "Rate limit exceeded",
        status: 429,
        isRateLimited: true,
        retryAfter: retryAfter,
      };
    }
    
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const result: AniListResponse<T> = await response.json();

  if (result.errors && result.errors.length > 0) {
    // Check for rate limit errors in GraphQL errors
    const rateLimitError = result.errors.find(error => 
      error.message.toLowerCase().includes("rate limit") ||
      error.message.toLowerCase().includes("too many requests")
    );

    if (rateLimitError) {
      throw {
        message: rateLimitError.message,
        status: 429,
        isRateLimited: true,
        retryAfter: 60,
      };
    }

    throw new Error(`GraphQL Error: ${result.errors[0].message}`);
  }

  return result;
}
```

## ⚡ Caching Strategy

### Cache Architecture

The application implements an intelligent caching system for API responses:

```text
┌──────────────┐
│   In-Memory  │  Cache TTL: 30 minutes
│   Cache      │  Size: Unlimited
└──────────────┘
       ↓
┌──────────────┐
│ localStorage │  Fallback cache
│              │  Persists between sessions
└──────────────┘
       ↓
┌──────────────┐
│   AniList    │  Live API data
│   GraphQL    │
└──────────────┘
```

### Cache Keys

```typescript
interface CacheKey {
  operation: string;        // "searchManga", "getUserList", etc.
  variables: Record<string, any>;  // Query parameters
  userId?: string;          // For user-specific queries
}

// Cache key generation
function generateCacheKey(operation: string, variables: any): string {
  return `cache:${operation}:${JSON.stringify(variables)}`;
}
```

### Cache Invalidation Strategies

```typescript
// Strategy 1: Time-based (automatic expiration)
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

// Strategy 2: Manual invalidation
clearSearchCache();  // Clear all search results
clearUserListCache(userId);  // Clear specific user data

// Strategy 3: Event-based invalidation
// When user syncs data, invalidate related caches
onSyncComplete(() => {
  clearUserListCache(currentUserId);
  clearSearchCache();
});
```

### Best Practices for Caching

```typescript
// ✅ Good: Cache search results with reasonable TTL
const cached = getFromCache(CACHE_KEYS.SEARCH);
if (cached && !isCacheExpired(cached)) {
  return cached.data;
}

// ✅ Good: Force refresh when user explicitly requests
const fresh = await searchManga(query, { bypassCache: true });

// ❌ Bad: Caching user list without expiration
const userList = await getUserMangaList();  // Stale after changes

// ✅ Good: Invalidate user list after sync operations
await syncMangaBatch(updates);
invalidateUserListCache();
```

## 🎯 Query Optimization

### Batching Operations

Combine multiple operations into single requests to reduce API calls:

```typescript
// ❌ Bad: 50 separate requests
for (const id of mangaIds) {
  const manga = await searchMangaById(id);
}

// ✅ Good: Single batched request
const allManga = await getMangaByIds(mangaIds);  // Single GraphQL query
```

### Query Complexity

AniList limits query complexity. Monitor query depth:

```typescript
// ❌ High complexity query (may exceed limits)
query GetUserMangaWithDetails($userId: Int) {
  User(id: $userId) {
    mediaListCollection(type: MANGA) {
      lists {
        entries {
          media {
            id
            title
            coverImage
            characters { edges { nodes { id name } } }
            staff { edges { nodes { id name } } }
            studios { edges { nodes { id name } } }
          }
        }
      }
    }
  }
}

// ✅ Optimized: Only request needed fields
query GetUserMangaList($userId: Int) {
  User(id: $userId) {
    mediaListCollection(type: MANGA) {
      lists {
        entries {
          id
          mediaId
          status
          progress
          score
        }
      }
    }
  }
}
```

### Pagination

Always implement proper pagination for large datasets:

```typescript
// Pagination parameters
interface PaginationParams {
  page: number;      // Current page (1-based)
  perPage: number;   // Items per page (1-50)
}

// ✅ Good: Paginate large user lists
const response = await getUserMangaList({
  chunk: 1,
  perChunk: 50,  // AniList recommends 50 per chunk
});

// Handle next page
if (response.pageInfo.hasNextPage) {
  const nextPage = await getUserMangaList({
    chunk: response.pageInfo.currentPage + 1,
    perChunk: 50,
  });
}
```

## 💪 Rate Limiting Best Practices

### Understanding Rate Limits

AniList enforces rate limiting: **60 requests per minute** per API authentication.

```typescript
interface RateLimitStatus {
  limit: number;        // Total requests allowed (60)
  remaining: number;    // Requests remaining this minute
  resetAt: number;      // Unix timestamp when limit resets
  retryAfter?: number;  // Seconds to wait before retry
}
```

### Handling Rate Limits Gracefully

```typescript
// Option 1: Automatic backoff
async function requestWithBackoff<T>(
  query: string,
  variables: any,
  maxRetries = 3,
): Promise<T> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await request<T>(query, variables);
    } catch (error) {
      if (error.status === 429 && attempt < maxRetries) {
        const delay = Math.pow(2, attempt) * 1000;  // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        throw error;
      }
    }
  }
}

// Option 2: Queue requests
class RequestQueue {
  private queue: Array<() => Promise<any>> = [];
  private isProcessing = false;
  private minDelay = 1000;  // 1 second between requests

  async enqueue<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const result = await fn();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });

      if (!this.isProcessing) this.process();
    });
  }

  private async process() {
    this.isProcessing = true;

    while (this.queue.length > 0) {
      const fn = this.queue.shift();
      if (fn) {
        await fn();
        await new Promise(resolve => setTimeout(resolve, this.minDelay));
      }
    }

    this.isProcessing = false;
  }
}
```

### Monitoring Rate Limits

```typescript
// Track rate limit status in context
interface RateLimitContext {
  remaining: number;
  resetAt: Date;
  isNearLimit: boolean;  // true if remaining < 10
}

// Provider implementation
export function RateLimitProvider({ children }: { children: React.ReactNode }) {
  const [rateLimitStatus, setRateLimitStatus] = useState<RateLimitContext>({
    remaining: 60,
    resetAt: new Date(),
    isNearLimit: false,
  });

  // Update on each API call
  const updateRateLimit = (headers: Headers) => {
    const remaining = Number.parseInt(
      headers.get("x-ratelimit-remaining") || "60",
      10,
    );
    const reset = Number.parseInt(
      headers.get("x-ratelimit-reset") || String(Date.now() / 1000),
      10,
    );

    setRateLimitStatus({
      remaining,
      resetAt: new Date(reset * 1000),
      isNearLimit: remaining < 10,
    });
  };

  return (
    <RateLimitContext.Provider value={rateLimitStatus}>
      {children}
    </RateLimitContext.Provider>
  );
}
```

### Request Batching for Rate Limit Compliance

```typescript
// Batch manga lookups to respect rate limits
async function batchSyncManga(mangaList: MangaEntry[]): Promise<void> {
  const batchSize = 50;
  const batches = chunk(mangaList, batchSize);

  for (const batch of batches) {
    // Single mutation for entire batch
    await updateMangaEntryMutation(batch);

    // Wait between batches to avoid rate limit
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}
```

## 🔗 External Resources

- [AniList API Documentation](https://docs.anilist.co/)
- [GraphQL Specification](https://graphql.org/learn/)
- [OAuth 2.0 Specification](https://oauth.net/2/)
