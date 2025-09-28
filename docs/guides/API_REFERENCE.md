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

## 🔗 External Resources

- [AniList API Documentation](https://docs.anilist.co/)
- [GraphQL Specification](https://graphql.org/learn/)
- [OAuth 2.0 Specification](https://oauth.net/2/)
