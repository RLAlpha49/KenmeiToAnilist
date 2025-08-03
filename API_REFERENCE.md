# API Reference - AniList Integration

This document provides detailed information about how Kenmei to AniList integrates with the AniList GraphQL API.

## 📋 Overview

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
function getOAuthUrl(): string {
  const params = new URLSearchParams({
    client_id: OAUTH_CONFIG.clientId,
    redirect_uri: OAUTH_CONFIG.redirectUri,
    response_type: "code",
    scope: OAUTH_CONFIG.scope,
  });

  return `https://anilist.co/api/v2/oauth/authorize?${params}`;
}
```

#### Token Exchange

```typescript
async function getAccessToken(authCode: string): Promise<string> {
  const response = await fetch("https://anilist.co/api/v2/oauth/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      grant_type: "authorization_code",
      client_id: OAUTH_CONFIG.clientId,
      client_secret: OAUTH_CONFIG.clientSecret,
      redirect_uri: OAUTH_CONFIG.redirectUri,
      code: authCode,
    }),
  });

  const data = await response.json();
  return data.access_token;
}
```

## 🔍 Search Operations

### Basic Manga Search

```graphql
query SearchManga($search: String!, $page: Int, $perPage: Int) {
  Page(page: $page, perPage: $perPage) {
    pageInfo {
      total
      currentPage
      lastPage
      hasNextPage
      perPage
    }
    media(search: $search, type: MANGA, sort: SEARCH_MATCH) {
      id
      title {
        romaji
        english
        native
      }
      format
      status
      description
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
      chapters
      volumes
      coverImage {
        large
        medium
      }
      genres
      tags {
        name
        isAdult
      }
      averageScore
      meanScore
      isAdult
    }
  }
}
```

### Advanced Search with Filters

```graphql
query AdvancedSearchManga(
  $search: String
  $year: Int
  $status: MediaStatus
  $format: MediaFormat
  $genres: [String]
  $page: Int
  $perPage: Int
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
      search: $search
      type: MANGA
      startDate_greater: $year
      status: $status
      format: $format
      genre_in: $genres
      sort: SEARCH_MATCH
    ) {
      id
      title {
        romaji
        english
        native
      }
      format
      status
      startDate {
        year
      }
      chapters
      volumes
      coverImage {
        medium
      }
      genres
      averageScore
      isAdult
    }
  }
}
```

## 📚 User Library Operations

### Get User's Manga List

```graphql
query GetUserMangaList($userId: Int!, $page: Int, $perPage: Int) {
  Page(page: $page, perPage: $perPage) {
    pageInfo {
      total
      currentPage
      lastPage
      hasNextPage
      perPage
    }
    mediaList(userId: $userId, type: MANGA) {
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
      createdAt
      media {
        id
        title {
          romaji
          english
          native
        }
        chapters
        volumes
        status
        format
        coverImage {
          medium
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
    const delay = resetTime ? parseInt(resetTime) * 1000 - Date.now() : 60000;

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
async function request<T>(
  query: string,
  variables?: Record<string, any>,
  accessToken?: string,
): Promise<T> {
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
    body: JSON.stringify({
      query,
      variables,
    }),
  });

  // Handle rate limiting
  await handleRateLimit(response);

  const result: GraphQLResponse<T> = await response.json();

  if (result.errors) {
    throw new Error(`GraphQL Error: ${result.errors[0].message}`);
  }

  if (!result.data) {
    throw new Error("No data returned from GraphQL query");
  }

  return result.data;
}
```

## 🔗 External Resources

- [AniList API Documentation](https://docs.anilist.co/)
- [GraphQL Specification](https://graphql.org/learn/)
- [OAuth 2.0 Specification](https://oauth.net/2/)
