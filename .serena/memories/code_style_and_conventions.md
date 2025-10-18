# Code Style and Conventions

## TypeScript Configuration

- Strict mode enabled
- JSX: React
- Target: ESNext
- Module: ESNext
- Path aliases: `@/*` maps to `./src/*`
- No implicit any
- Experimental decorators enabled

## Naming Conventions

- Components: PascalCase (e.g., `SyncPage.tsx`, `DataTable.tsx`)
- Files: kebab-case for utilities (e.g., `manga-import-utils.ts`)
- Functions: camelCase
- Types/Interfaces: PascalCase
- Constants: UPPER_SNAKE_CASE

## Code Organization

- One component per file
- Group related functionality in dedicated directories
- Use barrel exports (index.ts) where appropriate
- Keep business logic in utils and helpers
- API logic in `src/api/`
- UI components in `src/components/`

## React Patterns

- Functional components with hooks
- Context API for global state
- Custom hooks for reusable logic
- Props typing with TypeScript interfaces

## Formatting

- Prettier for code formatting
- Prettier plugin for Tailwind CSS class sorting
- ESLint for linting with React and TypeScript rules

## Documentation

- TypeDoc for API documentation
- JSDoc comments for functions and types
- User guides in markdown format
