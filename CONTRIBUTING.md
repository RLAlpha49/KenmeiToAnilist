# Contributing to KenmeiToAnilist

## Table of Contents

- [Getting Started](#getting-started)
- [Project Structure](#project-structure)
- [Making Changes](#making-changes)
- [Pull Request Process](#pull-request-process)
- [License](#license)

## Getting Started

### Prerequisites

- **Node.js**: v18 or higher
- **npm** or **yarn**: For package management
- **Git**: For version control
- **Basic knowledge of**: TypeScript, React, Electron

### Fork and Clone

1. Fork the repository on GitHub
2. Clone your fork locally:

   ```bash
   git clone https://github.com/YOUR_USERNAME/KenmeiToAnilist.git
   cd KenmeiToAnilist
   ```

### Installation

Install dependencies (note: `--force` flag is required due to peer dependency conflicts):

```bash
npm install --force
```

### Environment Setup

Optionally create a `.env` file in the project root for AniList API credentials (for testing):

```env
VITE_ANILIST_CLIENT_ID=your_client_id_here
VITE_ANILIST_CLIENT_SECRET=your_client_secret_here
```

This is optional—the app will prompt for authentication during normal use.

### Running the Application

Start the development server with hot reload:

```bash
npm start
```

### Building for Production

Create production builds:

```bash
npm run make
```

This generates distributable packages in the `out/` directory.

The project uses Husky to automatically run `npm run precommit` (format + lint) before each commit. This ensures code quality and consistency.

## Understanding the Codebase

For a comprehensive understanding of the architecture, read:

- **[Architecture Documentation](./docs/guides/ARCHITECTURE.md)** - Complete system design, storage layers, IPC architecture
- **[Storage Implementation Guide](./docs/guides/STORAGE_IMPLEMENTATION.md)** - Three-layer storage system details
- **[API Reference](./docs/guides/API_REFERENCE.md)** - AniList GraphQL integration

## Project Structure

```text
src/
├── api/              # AniList API client, Kenmei parser, matching algorithms
├── components/       # React components
│   ├── ui/          # shadcn/ui components (Radix UI primitives)
│   └── ...          # Feature-specific components
├── contexts/         # React contexts (auth, storage, etc.)
├── helpers/
│   └── ipc/         # IPC handlers organized by domain
├── hooks/           # Custom React hooks
├── pages/           # Route components
├── routes/          # TanStack Router configuration
├── utils/           # Utilities (storage, error handling, logging)
├── types/           # TypeScript type definitions
└── styles/          # Global styles
```

### Path Aliases

The project uses path aliases for cleaner imports:

- `@/*` maps to `./src/*`
- Example: `import { Button } from "@/components/ui/button"`

## Making Changes

### Creating a Feature Branch

Always work in a feature branch:

```bash
git checkout -b feature/your-feature-name
```

Use descriptive branch names:

- `feature/add-bulk-sync`
- `fix/cache-invalidation-bug`
- `docs/update-user-guide`

### Commit Messages

Write clear, descriptive commit messages:

```text
feat: add bulk manga synchronization

- Implement batch processing for manga updates
- Add progress tracking UI
- Handle rate limiting appropriately
```

Follow conventional commits style:

- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation changes
- `refactor:` - Code refactoring
- `test:` - Test additions/changes
- `chore:` - Maintenance tasks

### Before Committing

Run the pre-commit checks:

```bash
npm run precommit
```

This ensures your code is formatted and passes linting.

For AniList API operations:

1. **Define GraphQL query** in `src/api/anilist/queries.ts`:

   ```typescript
   export const MY_QUERY = `
     query MyQuery($param: String!) {
       Media(search: $param, type: MANGA) {
         id
         title { romaji }
       }
     }
   `;
   ```

2. **Add types** in `src/api/anilist/types.ts`:

   ```typescript
   export interface MyQueryResponse {
     Media: {
       id: number;
       title: { romaji: string };
     };
   }
   ```

3. **Use in client** via `src/api/anilist/anilist-client.ts` or create a new function.

## Commit Message Guidelines

This project follows the [Conventional Commits](https://www.conventionalcommits.org/) specification for commit messages. This enables automatic changelog generation and semantic versioning.

### Commit Message Format

Each commit message consists of a **header**, an optional **body**, and an optional **footer**:

```text
<type>(<scope>): <subject>
<BLANK LINE>
<body>
<BLANK LINE>
<footer>
```

**Header** (required):

- **type**: The type of change (see below)
- **scope**: The area of the codebase affected (see below)
- **subject**: A brief description of the change (lowercase, no period at end, max 100 chars)

**Body** (optional):

- Detailed explanation of the change
- Explain the motivation and contrast with previous behavior
- Use present tense ("add" not "added")

**Footer** (optional):

- Reference issues: `Fixes #123`, `Closes #456`
- Breaking changes: `BREAKING CHANGE: description`

### Commit Types

- **feat**: A new feature for the user
- **fix**: A bug fix
- **docs**: Documentation changes only
- **style**: Code style changes (formatting, missing semicolons, etc.)
- **refactor**: Code changes that neither fix bugs nor add features
- **perf**: Performance improvements
- **test**: Adding or updating tests
- **build**: Changes to build system or dependencies
- **ci**: Changes to CI/CD configuration
- **chore**: Other changes that don't modify src or test files
- **revert**: Revert a previous commit

### Commit Scopes

Use these scopes to indicate which part of the codebase is affected:

**Core Features:**

- `import` - CSV import functionality
- `matching` - Manga matching algorithms
- `sync` - AniList synchronization
- `auth` - Authentication system
- `settings` - Settings page and configuration
- `statistics` - Statistics dashboard

**Technical Areas:**

- `api` - API clients (AniList, Kenmei, manga sources)
- `storage` - Storage layer (cache, localStorage, electron-store)
- `cache` - Caching system
- `ipc` - IPC communication (main/renderer)
- `ui` - UI components
- `hooks` - React hooks
- `utils` - Utility functions

**Infrastructure:**

- `deps` - Dependency updates
- `config` - Configuration files
- `build` - Build system
- `release` - Release process
- `docs` - Documentation
- `readme` - README and top-level documentation files
- `types` - TypeScript types and interfaces
- `build-system` - Build tooling and scripts (CI/build-system changes)

### Examples

**Good commit messages:**

```text
feat(matching): add virtual scrolling for large lists

Implements virtual scrolling using @tanstack/react-virtual to improve
performance when rendering 1000+ manga entries. Reduces initial render
time from 2s to 200ms.

Fixes #123
```

```text
fix(sync): handle offline errors gracefully

Adds offline detection before sync operations and queues failed
operations for automatic retry when connection is restored.

Closes #456
```

```text
docs(readme): update contributing guidelines

Adds section on commit message format and conventional commits.
```

```text
chore(deps): update electron to v38.3.0
```

**Bad commit messages:**

```text
Add feature          ❌ Missing type and scope
Feat: Add Feature    ❌ Subject should be lowercase
fix(unknown): bug    ❌ Invalid scope
feat(matching): add. ❌ Trailing period
```

### Breaking Changes

If your commit introduces a breaking change, add `BREAKING CHANGE:` in the footer:

```text
feat(api)!: change authentication flow

BREAKING CHANGE: The authentication flow now requires OAuth2 instead of
API tokens. Users will need to re-authenticate after this update.

Migration guide: See docs/guides/MIGRATION.md
```

Alternatively, add `!` after the type/scope: `feat(api)!: change authentication flow`

### Commit Message Validation

Commit messages are automatically validated using commitlint. If your message doesn't follow the format:

1. The commit will be rejected
2. You'll see an error message explaining what's wrong
3. Fix your message and try again

**Testing your commit message:**

```bash
# This will fail validation
git commit -m "invalid message"

# This will pass validation
git commit -m "feat(matching): add virtual scrolling"
```

### Tips

- Use `git commit` (without `-m`) to open your editor for multi-line messages
- Keep the subject line under 100 characters
- Use the body to explain _what_ and _why_, not _how_
- Reference issues and PRs in the footer
- Use present tense: "add" not "added", "fix" not "fixed"
- Be specific: "fix(sync): handle rate limit errors" not "fix: bug"

### Changelog Generation

Commit messages following this format are automatically included in the CHANGELOG.md:

- `feat` commits appear under "✨ Features"
- `fix` commits appear under "🐛 Bug Fixes"
- `perf` commits appear under "⚡ Performance Improvements"
- `docs` commits appear under "📚 Documentation"
- Other types may be hidden from the changelog

For more information, see the [Conventional Commits specification](https://www.conventionalcommits.org/).

---

## Pull Request Process

### Before Submitting

1. **Push your branch** to your fork:

   ```bash
   git push origin feature/your-feature-name
   ```

2. **Ensure all checks pass**:
   - Run `npm run precommit` (format + lint)
   - Verify `npm start` works without errors
   - Test your changes thoroughly

### Opening a Pull Request

1. Navigate to the original repository on GitHub
2. Click "New Pull Request"
3. Select your fork and branch
4. **Fill out the PR template completely**:
   - Clear description of changes
   - Link related issues (use `Fixes #123`, `Closes #456`)
   - List specific changes made
   - Describe how you tested
   - Check all applicable boxes

## License

By contributing to KenmeiToAnilist, you agree that your contributions will be licensed under the [MIT License](./LICENSE).

All contributions must be your own work or properly attributed. Do not submit copyrighted code without permission.

---

Thank you for contributing to KenmeiToAnilist! Your help makes this project better for everyone. 🎉
