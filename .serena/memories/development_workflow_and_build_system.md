# Development Workflow & Build System

## Development Environment Setup

### Prerequisites

- **Node.js** v18+ (recommended)
- **npm** or **yarn** package manager
- **Git** for version control
- **VS Code** with recommended extensions

### Initial Setup

```bash
# Clone repository
git clone https://github.com/RLAlpha49/KenmeiToAnilist.git
cd KenmeiToAnilist

# Install dependencies (use --force for compatibility)
npm install --force
# or
yarn install

# Run in development mode
npm start
# or
yarn start
```

### Environment Configuration

Create `.env` file in root directory for environment variables:

```env
# AniList API Credentials (optional - can be set in app)
VITE_ANILIST_CLIENT_ID=your-client-id
VITE_ANILIST_CLIENT_SECRET=your-client-secret
VITE_ANILIST_ENCRYPTION_KEY=your-encryption-key

# Development settings
NODE_ENV=development
ENABLE_DEVTOOLS=1  # Enable developer tools
```

## Development Scripts

### Core Development Commands

```bash
# Development server with hot reload
npm start
# Development with specific port
npm start -- --port=3000

# Type checking
npm run typecheck

# Linting
npm run lint

# Code formatting
npm run format:write

# Build for production
npm run make

# Generate documentation
npm run docs

# Release management
npm run release        # Patch release
npm run release:minor  # Minor release
npm run release:major  # Major release
npm run release:first  # First release
```

### Build and Distribution

```bash
# Development build
npm run make:dev

# Production build with analysis
npm run analyze:bundle

# Clean build artifacts
rm -rf out/ dist/
```

## Code Quality & Standards

### Code Style

- **ESLint**: Modern ESLint 9 with React Compiler support
- **Prettier**: Automatic code formatting with Tailwind plugin
- **TypeScript**: Strict mode enabled with comprehensive type checking
- **Conventional Commits**: Enforced via commitlint and Husky hooks

### Pre-commit Hooks

```bash
# Runs automatically on commit
npm run precommit
# Which executes:
npm run format:write && npm run lint
```

### Commit Guidelines

- Use conventional commit format: `type(scope): description`
- Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`
- Example: `feat(import): add CSV validation for malformed files`

### Testing Strategy

- **Unit Testing**: Not currently implemented (opportunity for improvement)
- **Integration Testing**: Manual testing via confidence testing utility
- **E2E Testing**: Manual testing through full application workflow

### Confidence Testing Utility

Located in `scripts/test-confidence.mts` for testing matching algorithms:

```bash
# Test exact match
npx tsx scripts/test-confidence.mts "Death Note" "Death Note"

# Test with synonyms
npx tsx scripts/test-confidence.mts "Attack on Titan" "進撃の巨人" --synonyms="AoT"

# JSON output for automation
npx tsx scripts/test-confidence.mts "One Piece" "One Piece" --json
```

## Build Architecture

### Electron Forge Configuration

- **Config**: `config/forge.config.js`
- **Makers**:
  - Windows: Squirrel installer with MSI
  - macOS: DMG and ZIP distribution
  - Linux: Deb package and ZIP archive
- **Plugins**: Vite builder and security fuses
- **Security**: Fuses enabled for code protection and integrity validation

### Vite Configuration

Three separate configurations for different Electron processes:

#### Main Process (`config/vite.main.config.ts`)

- **Target**: Node.js
- **Entry**: `src/main.ts`
- **Features**: Electron-specific APIs, file system, IPC

#### Preload Script (`config/vite.preload.config.ts`)

- **Target**: Electron preload context
- **Entry**: `src/preload.ts`
- **Features**: Context bridge setup, secure IPC exposure

#### Renderer Process (`config/vite.renderer.config.mts`)

- **Target**: Browser
- **Entry**: `src/renderer.ts`
- **Features**: React, routing, UI components

### TypeScript Configuration

- **Strict Mode**: All strict TypeScript options enabled
- **Paths**: `@/*` alias for `src/*` imports
- **Declaration**: Generate declaration files for documentation
- **Composite**: Project references for better build performance

## Documentation Generation

### TypeDoc Setup

- **Config**: `config/typedoc.json`
- **Theme**: Hierarchy theme for better navigation
- **Plugins**: Inline sources, missing exports, extras
- **Output**: `documentation/` directory with searchable API docs

### Documentation Structure

```text
docs/
├── guides/                    # User and developer guides
│   ├── USER_GUIDE.md         # End-user documentation
│   ├── ARCHITECTURE.md       # Technical architecture
│   ├── API_REFERENCE.md      # API documentation
│   ├── IPC_ARCHITECTURE.md   # IPC communication details
│   └── STORAGE_IMPLEMENTATION.md # Storage system details
├── assets/                    # Images and diagrams
└── CHANGELOG.md              # Version history
```

## Release Management

### Version Control

- **Standard Version**: Automated changelog generation
- **Semantic Versioning**: MAJOR.MINOR.PATCH format
- **Release Tags**: Git tags for each release
- **GitHub Releases**: Automated release notes and assets

### Release Process

```bash
# Create new release (auto-generates changelog)
npm run release

# Pre-release for testing
npm run release -- --prerelease beta

# Specific version release
npm run release -- --release-as 1.2.0
```

### Distribution Channels

- **GitHub Releases**: Primary distribution channel
- **Auto-updater**: Built-in Electron updater with GitHub integration
- **Pre-release Channel**: Beta releases for early adopters

## Development Tools & Extensions

### Recommended VS Code Extensions

- **ESLint**: Code linting and error detection
- **Prettier**: Code formatting
- **TypeScript**: TypeScript support
- **Tailwind CSS**: Tailwind CSS IntelliSense
- **React Developer Tools**: React component inspection
- **Electron**: Electron development tools

### Debugging

- **Main Process**: Debug via VS Code launch configuration
- **Renderer Process**: Chrome DevTools integrated
- **Web Workers**: Worker debugging via browser DevTools
- **Logging**: Structured logging with Winston-like patterns

## Performance Monitoring

### Bundle Analysis

```bash
# Analyze bundle size and composition
npm run analyze:bundle
```

### Memory Usage

- **Electron DevTools**: Memory profiler for main process
- **Chrome DevTools**: Memory profiler for renderer process
- **Web Workers**: Worker memory monitoring

### Performance Metrics

- **Build Time**: Monitored via Vite build logs
- **Runtime Performance**: React Profiler for component performance
- **Network Requests**: API call timing and success rates

## Deployment & Distribution

### Build Process

1. **Development Build**: `npm run make:dev` for testing
2. **Production Build**: `npm run make` for distribution
3. **Bundle Analysis**: `npm run analyze:bundle` for optimization
4. **Documentation**: `npm run docs` for API docs

### Distribution Artifacts

- **Windows**: `Kenmei-to-Anilist-Setup.exe` and `Kenmei-to-Anilist-Setup.msi`
- **macOS**: `Kenmei-to-Anilist.dmg` and `Kenmei-to-Anilist.zip`
- **Linux**: `kenmei-to-anilist_1.0.0_amd64.deb` and `Kenmei-to-Anilist.zip`

### Auto-update System

- **GitHub Releases**: Source for update downloads
- **Electron Updater**: Built-in update mechanism
- **Pre-release Support**: Beta channel for early adopters
- **Update Notifications**: In-app notifications for available updates
