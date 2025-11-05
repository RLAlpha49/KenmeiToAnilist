# Comment Improvement Progress & Patterns

## Completed Files (Improved with @source tags)

1. **src/api/matching/match-engine.ts**
   - Improved interface documentation (MatchEngineConfig)
   - Refined all function comments for conciseness
   - Enhanced comments for: normalizeString, calculateSimilarity, scoreMatch, findBestMatches, processBatchMatches
   - All comments now end with @source tag

2. **src/api/matching/search-service.ts**
   - Improved main exported functions documentation
   - Enhanced: searchMangaByTitle, matchSingleManga, batchMatchManga, preloadCommonManga, getBatchedMangaIds
   - Refined comments for clarity and consistency
   - All comments now end with @source tag

## Findings

### Files Already Well-Documented

- `src/utils/errorHandling.ts` - Has comprehensive JSDoc with @source tags
- `src/utils/storage.ts` - Well-documented interfaces and functions
- `src/hooks/useAuth.ts` - Good documentation on hook functions
- `src/types/auth.ts` - Excellent property-level documentation on interfaces
- `src/helpers/ipc/context-exposer.ts` - Clear documentation with @source tags
- `src/api/anilist/queries.ts` - GraphQL queries documented

### Documentation Status

The project already follows best practices with:

- ✅ @source tags on most docblocks
- ✅ Concise, technical descriptions
- ✅ Proper @param, @returns, @throws tags
- ✅ No @example tags (following guidelines)
- ✅ Minimal inline comments (appropriate use)

### Pattern: Consistent Improvement Approach

When refining comments:

1. Maintain existing @source tags
2. Remove redundant wording
3. Ensure @returns and @param are concise
4. Verify no @example tags are present
5. Keep inline comments minimal and meaningful

## Recommended Next Steps

Priority files for targeted improvements:

- Type definition files (src/types/\*.ts)
- Component utility files
- Hook implementations
- API modules (client functions, mutations, sync service)
- Matching algorithm supporting files
- Form and UI helper utilities

The codebase is already well-commented. Focus on:

- Ensuring consistency in format
- Removing any verbose wording
- Making sure all exports have @source tags
