# Kenmei to AniList - AI Coding Assistant Instructions

## Project Overview

This is an Electron desktop app (React + TypeScript) that migrates manga libraries from Kenmei to AniList. The app uses a secure main/renderer process architecture with IPC communication, three-layer storage system, and GraphQL API integration.

## Key Files to Reference

- `docs/guides/ARCHITECTURE.md` - Complete architecture overview
- `docs/guides/STORAGE_IMPLEMENTATION.md` - Storage system details
- `docs/guides/API_REFERENCE.md` - AniList API integration

## Architecture Patterns

### Process Communication (Main/Renderer)

- **Context Bridge Pattern**: All IPC exposed through `src/helpers/ipc/context-exposer.ts` which combines auth, store, API, theme, and window contexts
- **Security First**: Context isolation enabled, no direct Node.js in renderer
- **IPC Convention**: Main process handlers in `src/helpers/ipc/*/` organized by domain (auth, store, api)

Example IPC usage:

```typescript
// In renderer: globalThis.electronStore.getItem(key)
// Main handler: src/helpers/ipc/store/store-listeners.ts
```

### Three-Layer Storage Architecture

Critical pattern in `src/utils/storage.ts`:

1. **In-memory cache** (fastest, cleared on restart)
2. **localStorage** (browser storage, web context)
3. **Electron Store** (file-based, **authoritative source**)

Storage reads check cache → localStorage → async Electron Store sync. Electron Store always wins conflicts.

### State Management

- **React Context**: Global state (Auth, Debug, Theme, RateLimit) in `src/contexts/`
- **Custom Hooks**: Domain logic in `src/hooks/`
- **Storage Keys**: Centralized in `STORAGE_KEYS` constant with cache versioning

### API Integration Patterns

- **GraphQL Client**: `src/api/anilist/client.ts` with built-in caching and rate limiting
- **Search Cache**: 30-minute expiration, localStorage persistence, IPC fallback
- **Error Handling**: Comprehensive error types and retry logic

## Development Workflow

### Key Commands

```bash
npm start              # Development with hot reload
npm run make           # Production build (cross-platform)
npm run lint           # ESLint with React Compiler plugin
npm run docs           # Generate TypeDoc documentation
npm run format:write   # Prettier formatting
```

### Configuration Files

- **Build**: `config/forge.config.js` (Electron Forge with Vite plugin)
- **Vite**: Separate configs for main/preload/renderer processes
- **ESLint**: `config/eslint.config.mjs` with React Compiler support
- **TypeDoc**: Auto-generated docs at <https://rlalpha49.github.io/KenmeiToAnilist/>

### Project Structure Conventions

```text
src/
├── api/          # External service clients (anilist, kenmei, matching)
├── components/   # React components (ui/, layout/, feature-specific/)
├── contexts/     # Global React Context providers
├── helpers/ipc/  # Main process IPC handlers by domain
├── pages/        # Top-level route components
├── routes/       # TanStack Router config
├── utils/        # Pure utility functions (storage, versions, similarity)
```

### Component Patterns

- **shadcn/ui**: Pre-built components using Radix UI primitives
- **TailwindCSS 4.1**: Utility-first styling with `@tailwindcss/vite` plugin
- **Animations**: Framer Motion for page transitions, tailwindcss-animate for micro-interactions
- **Type Safety**: Comprehensive TypeScript with strict mode

### Debugging & Error Handling

- **Debug Context**: `src/contexts/DebugContext.tsx` toggles debug mode app-wide
- **Sentry Integration**: Error tracking in main process
- **Export Utilities**: `src/utils/export-utils.ts` for debugging data export

## Critical Implementation Details

### AniList API

- **Rate Limiting**: Built into client with exponential backoff
- **Authentication**: OAuth2 flow handled in main process for security
- **Caching Strategy**: Multi-level search result caching with timestamp invalidation

### Matching Engine

- **String Similarity**: Enhanced algorithms in `src/utils/enhanced-similarity.ts`
- **Smart Matching**: `src/api/matching/match-engine.ts` with configurable thresholds
- **User Review**: Manual override system for mismatches

### Build & Distribution

- **Cross-Platform**: Windows (Squirrel), macOS (DMG), Linux (Deb)
- **Security**: Electron Fuses, context isolation, CSP headers
- **Auto-Update**: GitHub releases integration with version comparison

## Common Patterns to Follow

1. **IPC Operations**: Always use context bridge, never direct ipcRenderer
2. **Storage Access**: Use `src/utils/storage.ts` abstraction, respect three-layer hierarchy
3. **Error Boundaries**: Comprehensive error handling with user-friendly messages
4. **Type Safety**: Leverage TypeScript strictly, especially for API responses
5. **Performance**: Three-layer caching, React Compiler optimization, lazy loading

## Environment & Dependencies

- **Node.js 18+** required
- **Force install** needed: `npm install --force` (dependency conflicts)
- **Environment Variables**: Optional `.env` for default AniList credentials, configure via Settings UI alternatively
