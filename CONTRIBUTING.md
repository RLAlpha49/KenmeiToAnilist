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
