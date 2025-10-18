# Development Workflow & Commands

## Build & Run Commands

```bash
npm start              # Dev with hot reload (Vite + Electron)
npm run make           # Production build for all platforms
npm run build          # Alias for electron-forge make
npm run lint           # ESLint 9 with React Compiler plugin
npm run format:write   # Prettier (auto-format all files)
npm run precommit      # Format + lint combined (Husky pre-commit)
npm run docs           # Generate TypeDoc to documentation/
npm run update         # Update dependencies (ncu -u)
```

## Development Setup

### Project Structure

```text
src/
├── api/              # AniList API, Kenmei, matching algorithms
├── components/       # Feature-specific + ui/ (shadcn/ui)
│   ├── debug/       # Debug panels
│   ├── import/      # CSV import flow
│   ├── layout/      # BaseLayout, navigation
│   ├── matching/    # Match review, confidence
│   ├── settings/    # Sync config, credentials
│   ├── sync/        # Batch sync, progress
│   └── ui/          # shadcn/ui components
├── contexts/         # React context providers
├── helpers/ipc/      # IPC handlers (organized by domain)
├── hooks/            # Custom React hooks
├── pages/            # Route components
├── routes/           # TanStack Router config
├── types/            # TypeScript interfaces
└── utils/            # storage.ts, errorHandling.ts, logging.ts
```

## Task Workflow (Before Every Commit)

1. **Explore with Serena Tools FIRST** (don't read full files)
   - `mcp_oraios_serena_get_symbols_overview` - Understand file structure
   - `mcp_oraios_serena_find_symbol` - Locate specific functions/classes
   - `mcp_oraios_serena_find_referencing_symbols` - Understand dependencies

2. **Make Precise Changes**
   - Use `mcp_oraios_serena_replace_symbol_body` for method/class changes
   - Use `mcp_oraios_serena_insert_*` for additions
   - Avoid line-based edits unless symbolic approach fails

3. **Verify & Test**
   - Run `npm run precommit` (format + lint)
   - Run `npm start` for manual testing
   - Use `sonarqube_analyze_file` on changed files

4. **Update Documentation (if needed)**
   - Run `npm run docs` for API changes
   - Update `docs/guides/` for user-facing changes
   - Add/update JSDoc comments

## Debugging

### Debug Mode Features

- Enable via settings menu
- Log viewer with console interception (`src/utils/logging.ts`)
- State inspector for Auth/Debug/Theme contexts
- IPC monitor (logs all IPC calls)

### Console Logs by Module

```text
[MangaSearchService] - Search cache operations
[MatchingProcess] - Matching orchestration
[Storage] - Storage layer operations
[CacheDebugger] - Cache state changes
[MatchingPage] - UI-level operations
```

## Configuration Files

- `tsconfig.json` - TypeScript strict mode, path aliases (@/\*)
- `config/vite.main.config.ts` - Main process bundling
- `config/vite.preload.config.ts` - Preload script bundling
- `config/vite.renderer.config.mts` - React renderer bundling
- `config/forge.config.js` - Electron Forge makers & security
- `config/eslint.config.mjs` - ESLint 9 with React Compiler plugin
- `config/tailwind.config.js` - Tailwind CSS 4.1 configuration

## Common Tasks

### Adding New IPC Handler

1. Create handler in `src/helpers/ipc/{domain}/handler.ts`
2. Expose in context exposer: `src/helpers/ipc/context-exposer.ts`
3. Register in listeners: `src/helpers/ipc/listeners-register.ts`
4. Use in renderer via `globalThis.electron{Domain}.methodName()`

### Adding New Storage Key

1. Add to `STORAGE_KEYS` constant in `src/utils/storage.ts`
2. Increment `CURRENT_CACHE_VERSION` if data structure changes
3. Use `storage.setItem(STORAGE_KEYS.NEW_KEY, value)` everywhere

### Adding New UI Component

1. Use shadcn/ui pattern: `src/components/ui/component-name.tsx`
2. Import via `@/components/ui/component-name`
3. Use CVA for type-safe variants
4. TailwindCSS classes auto-sorted by Prettier

### Adding New Route

1. Create route component in `src/routes/`
2. Export from `src/routes/routes.tsx`
3. Add to route tree in `src/routes/router.tsx`
4. Use TanStack Router's `useRouter()` hook for navigation

## Performance Considerations

- **React Compiler**: Auto-memoization - avoid manual `useMemo`/`useCallback`
- **Search Cache**: 30-minute expiration, persists to localStorage
- **Rate Limiting**: AniList 60 req/min limit - check `RateLimitContext`
- **Batch Operations**: Use rate limit info to stagger API calls
