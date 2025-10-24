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
npm run release        # Generate changelog, bump version, create tag
npm run release:major  # Force major version bump (3.0.0 → 4.0.0)
npm run release:minor  # Force minor version bump (3.0.0 → 3.1.0)
npm run release:patch  # Force patch version bump (3.0.0 → 3.0.1)
npm run release:first  # First release (no version bump)
npm run commitlint     # Lint commit message (used by husky hook)
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

4. **Commit with Conventional Commits**
   - Follow format: `type(scope): subject`
   - Commitlint validates message automatically
   - See commit message guidelines below

5. **Update Documentation (if needed)**
   - Run `npm run docs` for API changes
   - Update `docs/guides/` for user-facing changes
   - Add/update JSDoc comments

## Commit Message Format

### Conventional Commits

This project uses [Conventional Commits](https://www.conventionalcommits.org/) for all commit messages. This enables:

- Automatic changelog generation
- Semantic versioning based on commit types
- Better commit history readability
- Easier navigation of project history

### Format

```text
<type>(<scope>): <subject>
```

**Types**: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`

**Scopes**: `import`, `matching`, `sync`, `auth`, `settings`, `statistics`, `api`, `storage`, `cache`, `ipc`, `ui`, `hooks`, `utils`, `deps`, `config`, `build`, `release`, `docs`

**Examples**:

- `feat(matching): add virtual scrolling`
- `fix(sync): handle offline errors`
- `docs(readme): update installation steps`
- `chore(deps): update electron to v38.3.0`

### Validation

Commit messages are automatically validated by commitlint via husky's commit-msg hook:

1. Write your commit message
2. Commitlint validates the format
3. If invalid, commit is rejected with error message
4. Fix the message and try again

**Validation Logs**: Check `.husky/commit-msg.log` for validation history

### Breaking Changes

For breaking changes, add `BREAKING CHANGE:` in the footer or `!` after type/scope:

```text
feat(api)!: change authentication flow

BREAKING CHANGE: OAuth2 now required instead of API tokens.
```

## Versioning and Changelog

### Automated Versioning

This project uses `standard-version` for automated versioning and changelog generation.

**Version Bumping Rules**:

- `feat` commits → minor version bump (3.0.0 → 3.1.0)
- `fix` commits → patch version bump (3.0.0 → 3.0.1)
- `BREAKING CHANGE` → major version bump (3.0.0 → 4.0.0)

### Release Process

**Standard Release** (automatic version detection):

```bash
npm run release
```

This will:

1. Analyze commits since last release
2. Determine version bump (major/minor/patch)
3. Update package.json version
4. Generate/update CHANGELOG.md
5. Create git commit: `chore(release): vX.Y.Z`
6. Create git tag: `vX.Y.Z`

**Manual Version Bump**:

```bash
npm run release:major  # 3.0.0 → 4.0.0
npm run release:minor  # 3.0.0 → 3.1.0
npm run release:patch  # 3.0.0 → 3.0.1
```

**First Release** (no version bump):

```bash
npm run release:first
```

### Changelog Generation

CHANGELOG.md is automatically generated from conventional commits:

**Included in Changelog**:

- ✨ Features (`feat`)
- 🐛 Bug Fixes (`fix`)
- ⚡ Performance Improvements (`perf`)
- ♻️ Code Refactoring (`refactor`)
- 📚 Documentation (`docs`)
- 🏗️ Build System (`build`)
- 👷 CI/CD (`ci`)
- ✅ Tests (`test`)
- ⏪ Reverts (`revert`)

**Hidden from Changelog**:

- `style` commits (formatting only)
- `chore` commits (maintenance tasks)

**Changelog Format**:

```markdown
## [3.1.0](compare-url) (2025-01-15)

### ✨ Features

- **matching**: add virtual scrolling ([abc123](commit-url))
- **sync**: add offline detection ([def456](commit-url))

### 🐛 Bug Fixes

- **auth**: handle token expiration ([ghi789](commit-url))
```

### Publishing Releases

After running `npm run release`:

1. **Review Changes**:

   ```bash
   git log -1  # Review release commit
   cat CHANGELOG.md  # Review changelog
   ```

2. **Push to GitHub**:

   ```bash
   git push --follow-tags origin main
   ```

3. **GitHub Actions** (if configured):
   - Automatically builds and publishes release
   - Attaches binaries to GitHub release

4. **Manual Release** (current process):
   - Build with Electron Forge: `npm run make`
   - Create GitHub release manually
   - Upload binaries from `out/make/`
   - Copy changelog entry to release notes

### Best Practices

**Commit Messages**:

- Write clear, descriptive subjects
- Use present tense: "add" not "added"
- Keep subject under 100 characters
- Use body for detailed explanations
- Reference issues: `Fixes #123`

**Versioning**:

- Run `npm run release` before creating GitHub releases
- Always push tags: `git push --follow-tags`
- Don't manually edit CHANGELOG.md (except for clarifications)
- Review generated changelog before pushing

**Changelog**:

- Commits are automatically categorized by type
- Focus on user-facing changes in commit messages
- Use scopes to indicate affected areas
- Link to issues/PRs in commit footers

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
