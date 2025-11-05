# Manga Sources & Fallback System

## Overview

The application supports searching multiple manga sources (AniList, ComicK, MangaDex) and uses them as fallbacks when primary AniList searches yield poor matches. This system enhances matching accuracy for manga without strong AniList entries.

## Architecture

### MangaSourceRegistry Pattern

**Location**: `src/api/manga-sources/registry.ts`

A singleton registry that manages multiple manga source clients with lazy initialization:

```typescript
class MangaSourceRegistry {
  // Lazy-initialized parallel loading of clients
  // Failures in one source don't prevent others from loading
  // Each source loads on-demand when first accessed
}
```

**Key Design Decisions**:

1. **Lazy Initialization**: Clients load only when first requested (reduces startup time)
2. **Parallel Loading**: All clients load concurrently using `Promise.all()`
3. **Graceful Degradation**: Individual client failures don't crash the app
4. **Per-loader Imports**: Separate import functions for each source allow Vite static analysis

### Available Sources

**Supported Manga Sources**:

1. **ComicK** - `src/api/manga-sources/comick/`
   - Modern manga source with good coverage
   - Used as primary fallback after AniList
   - Client: `comickClient`

2. **MangaDex** - `src/api/manga-sources/mangadex/`
   - Largest manga database
   - Used as secondary fallback
   - Client: `mangaDexClient`

3. **AniList** - Primary source
   - Most authoritative for anime/manga data
   - Used first for all searches

### Registry Methods

**Public API**:

- `getClient(source)` - Get a client by source (lazy initializes)
- `getAvailableSources()` - Get all registered sources
- `isSourceAvailable(source)` - Check if source is available
- `searchManga<T>(source, query, limit?)` - Search a specific source
- `getMangaDetail<T>(source, slug)` - Get detailed info from source
- `searchAndGetAniListManga(source, query, accessToken, limit?)` - Search and enrich with AniList data
- `clearCache(source, queries)` - Clear search cache for source

## Fallback & Enhancement Architecture

### Search Hierarchy

**Matching Process**:

1. **Primary**: AniList search via GraphQL
2. **Fallback**: If AniList match score is low, search ComicK
3. **Secondary Fallback**: If ComicK insufficient, search MangaDex
4. **Merge**: Combine results from all sources, rank by quality

### Source-Specific Conversion

Each source has conversion logic to normalize results:

- **`src/api/matching/sources/comick-processing.ts`** - Convert ComicK results to AniList format
- **`src/api/matching/sources/mangadex-processing.ts`** - Convert MangaDex results to AniList format
- **`src/api/matching/sources/conversion.ts`** - Cross-source conversion utilities

**Pattern**: All sources convert to common `AniListManga` type for unified scoring

### Result Merging

**`src/api/matching/sources/merge-utils.ts`** handles:

- Deduplication across sources
- Quality ranking
- Metadata enrichment
- Handling multiple results per source

**Deduplication Strategy**:

- By title similarity
- By ID when cross-referenced
- By author/year/format combination

## Integration Points

### Search Service Integration

**Flow in `src/api/matching/search-service.ts`**:

1. Execute AniList search (primary)
2. Check confidence of results
3. If low confidence → fetch from ComicK (fallback 1)
4. If still low → fetch from MangaDex (fallback 2)
5. Merge and rank all results
6. Return unified results to matching engine

### Configuration

**Search sources can be configured**:

```typescript
// In SearchServiceConfig
enableComicKFallback?: boolean;      // Default: true
enableMangaDexFallback?: boolean;    // Default: true
fallbackConfidenceThreshold?: number; // Trigger fallback below this
```

## Caching

**Each source maintains its own cache**:

- Separate in-memory caches for ComicK and MangaDex
- Cache expires based on source-specific TTL
- Can be cleared independently
- Cache status available via `getCacheStatus(source)`

## Performance Considerations

**Rate Limiting**:

- Each source has its own rate limit
- ComicK: ~60 requests/minute
- MangaDex: ~60 requests/minute
- AniList: 60 requests/minute

**Batching**:

- Searches are batched to respect rate limits
- Multiple source searches use sequential scheduling
- Results from all sources gathered before scoring

## Error Handling

**Source-Specific Errors**:

- Network timeouts → Try next fallback
- API rate limits → Queue for retry
- Invalid responses → Log and skip
- Source unavailable → Continue with other sources

**Resilience**:

- App continues functioning with remaining sources
- All results aggregated even if one source fails
- User notified if all sources fail

## Adding a New Source

**To add a new manga source**:

1. Create source client in `src/api/manga-sources/{source}/`
   - `client.ts` - Source API client
   - `types.ts` - Source-specific types

2. Implement `BaseMangaSourceClient` interface
   - `searchManga(query, limit)`
   - `getMangaDetail(slug)`
   - `searchAndGetAniListManga(query, token, limit)`
   - `clearCache(queries)`
   - `getCacheStatus()`

3. Register in `MangaSourceRegistry.initialize()`
   - Add loader for new source
   - Export client from source module

4. Add conversion logic in `src/api/matching/sources/`
   - Create `{source}-processing.ts`
   - Implement conversion to `AniListManga` format

5. Update configuration if needed
   - Add enable/disable flag
   - Add fallback threshold

## Current Limitations

- ComicK and MangaDex searches are sequential (not parallel) to respect rate limits
- Limited to 3 sources (AniList primary, ComicK/MangaDex fallbacks)
- Cross-source deduplication has edge cases with similar titles
- No user control over source precedence currently

## Future Enhancements

- Add more sources (MangaPlus, Webtoon, etc.)
- Allow user to select preferred sources in settings
- Parallel source searches with rate limit sharing
- Source-specific confidence adjustments
- Local source database for offline searches
