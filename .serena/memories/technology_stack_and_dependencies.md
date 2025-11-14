# Technology Stack & Dependencies

## Core Framework

- **Electron 38.4.0** - Desktop app framework with Chromium and Node.js
- **React 19.2.0** - UI library with React Compiler optimization
- **TypeScript 5.9.3** - Type safety and development experience
- **Vite 7.1.12** - Fast build tool and development server

## UI & Styling

- **TailwindCSS 4.1.16** - Utility-first CSS framework with @tailwindcss/vite plugin
- **Radix UI** - Accessible, unstyled UI primitives (@radix-ui/react-\*)
- **Lucide React 0.548.0** - Consistent icon library with 1000+ icons
- **Framer Motion 12.23.24** - Declarative animation library for smooth page transitions
- **shadcn/ui** - Pre-built, customizable components using Radix UI primitives
- **Tailwind Merge 3.3.1** - Utility for merging Tailwind CSS classes
- **Tailwind Animate 1.0.7** - Animation utilities for Tailwind

## State Management & Routing

- **TanStack Router 1.133.27** - Type-safe, file-based client-side routing with nested layouts
- **React Context** - Global state management for authentication, themes, rate limiting, and debug mode
- **Custom Hooks** - Encapsulated logic for authentication, synchronization, and rate limiting

## Storage & Data

- **electron-store 11.0.2** - Persistent file-based storage for preferences and app data
- **localStorage** - Browser-based storage for fast access and compatibility
- **In-memory cache** - Runtime performance optimization with automatic invalidation
- **Automatic Synchronization** - Seamless data consistency across all storage layers

## Development & Build Tools

- **Electron Forge 7.10.2** - Complete toolchain for building, packaging, and distributing
- **ESLint 9.38.0** - Modern linting with React Compiler plugin support
- **Prettier 3.6.2** - Consistent code formatting with automatic integration
- **TypeDoc 0.27.0** - Comprehensive API documentation generation from TypeScript comments
- **React Compiler 1.0.0** - Experimental automatic optimization plugin (Babel)
- **Husky 9.1.7** - Git hooks for pre-commit actions
- **Standard Version 9.5.0** - Conventional changelog management

## External APIs & Services

- **AniList GraphQL API** - Manga database and user list management
- **ComicK API** - Manga source for fallback matching
- **MangaDex API** - Manga source for secondary fallback matching
- **GitHub API** - For auto-updater functionality
- **Sentry 7.2.0** - Error tracking and monitoring

## Utility Libraries

- **Fastest Levenshtein 1.0.16** - High-performance string similarity calculation
- **String Similarity 4.0.4** - Advanced string matching algorithms
- **Fuse.js 7.0.0** - Fuzzy search for improved matching
- **Lru Cache 11.2.2** - Least recently used cache implementation
- **Papa Parse 5.5.3** - CSV parsing for Kenmei imports
- **Node Fetch 3.3.2** - HTTP client for API requests
- **Dotenv 17.2.3** - Environment variable management

## Animation & UI Enhancements

- **Embla Carousel 8.6.0** - Carousel component for image galleries
- **Framer Motion 12.23.24** - Advanced animations and transitions
- **Recharts 3.3.0** - Data visualization for statistics
- **Sonner 2.0.7** - Toast notifications for user feedback

## Security & Performance

- **@sentry/electron 7.2.0** - Error tracking with security considerations
- **Electron Updater 6.7.0** - Secure auto-updater with integrity validation
- **@electron/fuses** - Security hardening for packaged applications
- **Content Security Policy** - Strict CSP headers for production security

## Platform Support

- **Windows**: Squirrel installer with MSI support
- **macOS**: DMG and ZIP distribution
- **Linux**: Deb package and ZIP archive

## Development Workflow

- **Scripts**: npm scripts for development, building, testing, and releasing
- **Git Conventional Commits**: Enforced via commitlint
- **Code Quality**: ESLint + Prettier + TypeScript strict mode
- **Documentation**: TypeDoc with hierarchy theme
- **Testing**: Confidence testing utility for matching algorithms
