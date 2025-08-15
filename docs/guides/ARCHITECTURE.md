# Architecture Documentation

This document provides a comprehensive overview of the Kenmei to AniList application architecture, covering the technology stack, application structure, data flow, and key design patterns.

## 📋 Table of Contents

- [Overview](#-overview)
- [Technology Stack](#️-technology-stack)
- [Application Architecture](#️-application-architecture)
- [Process Architecture](#️-process-architecture)
- [Component Architecture](#-component-architecture)
- [Data Flow & State Management](#-data-flow--state-management)
- [Storage Architecture](#-storage-architecture)
- [API Integration](#-api-integration)
- [Build & Deployment](#-build--deployment)
- [Security Considerations](#-security-considerations)
- [Performance Optimizations](#-performance-optimizations)

## 🔎 Overview

Kenmei to AniList is a cross-platform desktop application built with Electron that enables users to migrate and synchronize their manga library from Kenmei to AniList.

### Key Architectural Principles

- **Security First**: Context isolation and controlled IPC communication
- **Performance**: Three-layer caching strategy and optimized React rendering
- **Maintainability**: Modular component structure and clear separation of concerns
- **User Experience**: Responsive design with smooth animations and error handling
- **Cross-Platform**: Consistent behavior across Windows, macOS, and Linux

## 🛠️ Technology Stack

### Core Framework

- **Electron** - Desktop app framework with Chromium and Node.js
- **React** - UI library with React Compiler optimization
- **TypeScript** - Type safety and development experience
- **Vite** - Fast build tool and development server

### UI & Styling

- **TailwindCSS 4.1.11** - Utility-first CSS framework
- **Radix UI** - Accessible, unstyled UI primitives
- **Lucide React** - Icon library
- **Framer Motion** - Animation library for smooth transitions
- **shadcn/ui** - Pre-built components using Radix UI

### State Management & Routing

- **TanStack Router** - Type-safe client-side routing
- **React Context** - Global state management for auth, themes, and debug
- **Custom Caching** - Three-layer storage system with in-memory, localStorage, and Electron Store

### Storage & Data

- **electron-store** - Persistent file-based storage
- **localStorage** - Browser-based storage for fast access
- **In-memory cache** - Runtime performance optimization

### Development & Build Tools

- **Electron Forge** - Build, package, and distribute Electron apps
- **ESLint & Prettier** - Code quality and formatting
- **TypeDoc** - API documentation generation

### External APIs

- **AniList GraphQL API** - Manga database and user list management

## 🏗️ Application Architecture

### High-Level Architecture

```text
┌─────────────────────────────────────────────────────────────┐
│                    Electron Application                     │
├─────────────────────────────────────────────────────────────┤
│  Main Process              │       Renderer Process         │
│  ├─ Window Management      │       ├─ React Application     │
│  ├─ IPC Handlers           │       ├─ UI Components         │
│  ├─ File System            │       ├─ State Management      │
│  ├─ Network Requests       │       └─ User Interactions     │
│  ├─ Storage (Store)        │                                │
│  └─ Authentication         │                                │
├─────────────────────────────────────────────────────────────┤
│                      Context Bridge                         │
│                (Secure IPC Communication)                   │
├─────────────────────────────────────────────────────────────┤
│                   External Services                         │
│                   └─ AniList GraphQL API                    │
└─────────────────────────────────────────────────────────────┘
```

### Directory Structure

```text
src/
├── main.ts                 # Main process entry point
├── preload.ts             # Preload script (context bridge setup)
├── renderer.ts            # Renderer process entry point
├── App.tsx                # React application root
├── types.d.ts             # Global type declarations
│
├── api/                   # API integration modules
│   ├── anilist/          # AniList API client and utilities
│   ├── kenmei/           # Kenmei data processing
│   └── matching/         # Manga matching algorithms
│
├── components/           # React components
│   ├── ui/              # Reusable UI components (shadcn/ui)
│   ├── layout/          # Layout components
│   ├── import/          # Import-specific components
│   ├── matching/        # Matching-specific components
│   ├── sync/            # Sync-specific components
│   └── debug/           # Debug and development tools
│
├── contexts/            # React Context providers
│   ├── AuthContext.tsx  # Authentication state
│   ├── ThemeContext.tsx # Theme management
│   ├── RateLimitContext.tsx # API rate limiting
│   └── DebugContext.tsx # Debug mode state
│
├── helpers/             # Utility functions and IPC setup
│   ├── ipc/            # Inter-process communication
│   └── *.ts            # General helper functions
│
├── hooks/              # Custom React hooks
├── pages/              # Application pages/routes
├── routes/             # Routing configuration
├── styles/             # Global styles and themes
├── types/              # TypeScript type definitions
└── utils/              # Utility functions
```

## ⚙️ Process Architecture

### Main Process (`src/main.ts`)

The main process is responsible for:

- **Application Lifecycle**: Window creation, app initialization, and cleanup
- **IPC Management**: Registering event listeners for renderer communication
- **Security**: Handling sensitive operations (file system, network, authentication)
- **System Integration**: Native OS features and notifications

```typescript
// Main process responsibilities
app.whenReady().then(createWindow).then(installExtensions);

function createWindow() {
  const mainWindow = new BrowserWindow({
    webPreferences: {
      contextIsolation: true, // Security isolation
      nodeIntegration: true, // Node.js access in main
      nodeIntegrationInSubFrames: false,
      preload: preload, // Preload script path
    },
  });

  registerListeners(mainWindow); // Setup IPC handlers
}
```

### Preload Script (`src/preload.ts`)

The preload script bridges main and renderer processes securely:

- **Context Bridge**: Exposes limited, safe APIs to renderer
- **IPC Abstraction**: Wraps complex IPC patterns in simple interfaces
- **Security Layer**: Prevents direct Node.js access from renderer

```typescript
// Preload exposes secure APIs
exposeContexts(); // Sets up all context bridges

// Example context bridge
contextBridge.exposeInMainWorld("electronStore", {
  getItem: (key: string) => ipcRenderer.invoke("store:getItem", key),
  setItem: (key: string, value: string) =>
    ipcRenderer.invoke("store:setItem", key, value),
});
```

### Renderer Process (`src/renderer.ts` → `src/App.tsx`)

The renderer process handles all UI and user interactions:

- **React Application**: Component tree and state management
- **User Interface**: All visual elements and user interactions
- **Client-Side Logic**: Data processing and validation
- **API Consumption**: Using exposed IPC APIs

```typescript
// Renderer process setup
export default function App() {
  return (
    <ThemeProvider>
      <DebugProvider>
        <AuthProvider>
          <RateLimitProvider>
            <RouterProvider router={router} />
            <SonnerProvider />
          </RateLimitProvider>
        </AuthProvider>
      </DebugProvider>
    </ThemeProvider>
  );
}
```

## 🧩 Component Architecture

### Component Hierarchy

```text
App (Root)
├── ThemeProvider
├── DebugProvider
├── AuthProvider
├── RateLimitProvider
└── RouterProvider
    └── BaseLayout
        ├── Header (Navigation)
        ├── Main Content (Route Outlet)
        │   ├── HomePage
        │   ├── ImportPage
        │   ├── MatchingPage
        │   ├── SyncPage
        │   └── SettingsPage
        └── Footer
```

### Context Providers

#### AuthProvider (`src/contexts/AuthContext.tsx`)

- Manages authentication state and user sessions
- Handles OAuth flow with AniList
- Provides authentication status across the app
- Exposes login/logout functions

#### ThemeProvider (`src/contexts/ThemeContext.tsx`)

- Manages dark/light/system theme preferences
- Synchronizes with OS theme changes
- Persists theme selection in storage
- Provides theme toggle functionality

#### RateLimitProvider (`src/contexts/RateLimitContext.tsx`)

- Tracks AniList API rate limit status
- Implements backoff strategies
- Provides rate limit information to components
- Handles rate limit recovery

#### DebugProvider (`src/contexts/DebugContext.tsx`)

- Manages debug mode state
- Controls development tool visibility
- Provides debug information to developers

### Routing Architecture

The application uses TanStack Router for type-safe, file-based routing:

```typescript
// Route structure
export const rootTree = RootRoute.addChildren([
  HomeRoute, // '/'
  ImportRoute, // '/import'
  ReviewRoute, // '/review'
  SyncRoute, // '/sync'
  SettingsRoute, // '/settings'
]);

// Memory-based routing for desktop app
export const router = createRouter({
  routeTree: rootTree,
  history: createMemoryHistory({ initialEntries: ["/"] }),
});
```

## 📊 Data Flow & State Management

### State Management Strategy

The application uses a hybrid approach combining multiple state management patterns:

```text
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   React Context │    │  Custom Caching │    │  Local Storage  │
│                 │    │                 │    │                 │
│ • Authentication│    │ • API Response  │    │ • Preferences   │
│ • Theme State   │    │   Caching       │    │ • User Data     │
│ • Debug Mode    │    │ • Three-Layer   │    │ • Cache Layer   │
│ • Rate Limits   │    │   Storage       │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
        │                       │                       │
        └───────────────────────┼───────────────────────┘
                                │
                       ┌─────────────────┐
                       │  Component Tree │
                       │                 │
                       │ • UI State      │
                       │ • Form Data     │
                       │ • Interactions  │
                       └─────────────────┘
```

#### Global State (React Context)

- **Authentication**: User login status, tokens, credentials
- **Theme**: Current theme preference (dark/light/system)
- **Debug**: Development mode, debug panel visibility
- **Rate Limiting**: API quota status, retry timers

#### Custom Caching System

- **API Response Caching**: Manual cache management for AniList API responses
- **Storage Synchronization**: Three-layer cache system (in-memory → localStorage → Electron Store)
- **Background Operations**: Asynchronous API calls with manual cache invalidation

#### Persistent State (Storage)

- **User Preferences**: Settings, configuration options
- **Import Data**: CSV data, matching results, sync history
- **Authentication**: Stored credentials and tokens (encrypted)

### Data Flow Patterns

#### Import Flow

```text
1. User selects CSV file
2. File validation (renderer)
3. Parse CSV data (renderer)
4. Store import data (storage)
5. Auto-match with AniList (API)
6. Update match results (storage)
7. Display review interface (UI)
```

#### Sync Flow

```text
1. User initiates sync
2. Batch preparation (renderer)
3. Rate limit check (context)
4. API requests (main process)
5. Progress tracking (context)
6. Error handling (context)
7. Results storage (storage)
8. UI updates (component state)
```

## 💾 Storage Architecture

The application implements a sophisticated three-layer storage system for optimal performance and data consistency. For complete details, see [Storage Implementation Guide](./STORAGE_IMPLEMENTATION.md).

### Storage Layers

```text
┌─────────────────┐
│  In-Memory      │  ← Runtime cache, fastest access
│  Cache          │    Cleared on app restart
│  (storageCache) │
└─────────────────┘
         ↕ Sync
┌─────────────────┐
│  localStorage   │  ← Browser storage, fast access
│  (Browser API)  │    Persists during session
└─────────────────┘
         ↕ Sync
┌─────────────────┐
│  Electron Store │  ← File-based, authoritative
│ (electron-store)│    Persists across app restarts
└─────────────────┘    **PRIMARY SOURCE OF TRUTH**
```

### Storage Precedence

1. **Electron Store** - Authoritative source, file-based persistence
2. **localStorage** - Fast cache, overwritten by Electron Store on conflicts
3. **In-Memory Cache** - Fastest access, synchronized with other layers

### IPC Bridge for Storage

```typescript
// Context bridge exposes storage APIs
contextBridge.exposeInMainWorld("electronStore", {
  getItem: (key: string) => ipcRenderer.invoke("store:getItem", key),
  setItem: (key: string, value: string) =>
    ipcRenderer.invoke("store:setItem", key, value),
  removeItem: (key: string) => ipcRenderer.invoke("store:removeItem", key),
  clear: () => ipcRenderer.invoke("store:clear"),
});

// Main process handlers
ipcMain.handle("store:getItem", (_, key) => store.get(key, null));
ipcMain.handle("store:setItem", (_, key, value) => store.set(key, value));
```

## 🌐 API Integration

### AniList GraphQL Integration

The application integrates with AniList's GraphQL API v2 for all manga-related operations:

```text
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Renderer      │    │   Main Process  │    │   AniList API   │
│   Process       │    │                 │    │                 │
│                 │    │                 │    │                 │
│ ┌─────────────┐ │    │ ┌─────────────┐ │    │ ┌─────────────┐ │
│ │ Components  │─┼────┼→│ IPC Handler │─┼────┼→│ GraphQL     │ │
│ │             │ │    │ │             │ │    │ │ Endpoint    │ │
│ └─────────────┘ │    │ └─────────────┘ │    │ └─────────────┘ │
│                 │    │                 │    │                 │
│ ┌─────────────┐ │    │ ┌─────────────┐ │    │ ┌─────────────┐ │
│ │ TanStack    │←┼────┼─│ Response    │←┼────┼─│ Response    │ │
│ │ Query       │ │    │ │ Handler     │ │    │ │ Data        │ │
│ └─────────────┘ │    │ └─────────────┘ │    │ └─────────────┘ │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### Authentication Flow

The application uses OAuth 2.0 for secure AniList authentication:

```text
1. User clicks "Login with AniList"
2. App opens OAuth window (main process)
3. User authorizes on AniList website
4. Redirect with authorization code
5. App exchanges code for access token
6. Token stored securely (Electron Store)
7. Token used for API requests
```

### Rate Limiting Strategy

```typescript
// Rate limit management
interface RateLimitStatus {
  isRateLimited: boolean;
  retryAfter: number | null;
  timeRemaining: number;
}

// Exponential backoff for rate limits
const delay = Math.min(1000 * Math.pow(2, attempt), 30000);
await new Promise((resolve) => setTimeout(resolve, delay));
```

### Caching Strategy

The application implements a sophisticated multi-layer caching system:

#### API Response Caching

- **Search Results**: 30-minute expiration in localStorage and in-memory cache
- **Manga Search**: 24-hour expiration for manga-specific queries
- **Main Process Cache**: 30-minute expiration for IPC-cached responses
- **Manual Cache Management**: Available via debug menu and API calls

#### Cache Implementation Layers

```typescript
// 1. In-memory cache (fastest access)
const searchCache: Cache<SearchResult<AniListManga>> = {};

// 2. localStorage persistence (survives page reloads)
localStorage.setItem("anilist_search_cache", JSON.stringify(cache));

// 3. Main process cache (IPC-level caching)
const searchCache: Cache<Record<string, unknown>> = {};
```

#### Cache Synchronization

- **Cross-layer sync**: In-memory ↔ localStorage ↔ Main process
- **Event-driven updates**: Cache changes trigger synchronization events
- **Intelligent invalidation**: Manual clearing with title-specific targeting

## 🚀 Build & Deployment

### Development Build

```bash
npm start  # Runs both main and renderer processes in development
```

Development environment features:

- **Hot Reload**: Vite dev server for fast iteration
- **DevTools**: React Developer Tools and Electron DevTools
- **Debug Mode**: Additional logging and development features

### Production Build

```bash
npm run make  # Builds and packages for current platform
```

### Build Configuration

#### Electron Forge Configuration (`forge.config.js`)

- **Packaging**: App bundling and asset optimization
- **Code Signing**: Security certificates for distribution
- **Installers**: Platform-specific installer generation
- **Auto-Update**: Update mechanism configuration

#### Vite Configuration

- **Main Process** (`vite.main.config.ts`): Node.js environment
- **Preload** (`vite.preload.config.ts`): Preload script bundling
- **Renderer** (`vite.renderer.config.mts`): React application

```typescript
// Renderer process config
export default defineConfig({
  plugins: [
    tailwindcss(),
    react({
      babel: {
        plugins: [["babel-plugin-react-compiler"]], // Performance optimization
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"), // Path aliasing
    },
  },
});
```

### Platform Support

- **Windows**: `.exe` installer with Squirrel
- **macOS**: `.dmg` disk image with code signing
- **Linux**: `.deb` and `.rpm` packages

## 🔒 Security Considerations

### Electron Security Best Practices

```typescript
// Main window security configuration
new BrowserWindow({
  webPreferences: {
    contextIsolation: true, // Isolate renderer context
    nodeIntegration: true, // Node.js in main only
    nodeIntegrationInSubFrames: false, // No Node.js in subframes
    preload: preload, // Controlled API exposure
  },
});
```

### Context Isolation

The application maintains strict separation between main and renderer processes:

- **No Direct Node.js Access**: Renderer cannot access Node.js APIs directly
- **Controlled IPC**: All communication via secured context bridge
- **Limited API Surface**: Only necessary functions exposed to renderer

### Data Security

- **Credential Storage**: OAuth tokens encrypted in Electron Store
- **API Keys**: Default credentials can be overridden securely
- **Local Data**: CSV imports and sync data stored locally only
- **No Data Transmission**: Personal data never leaves user's device except for AniList API

### Network Security

- **HTTPS Only**: All external API calls use HTTPS
- **Certificate Validation**: Standard certificate validation enforced
- **OAuth 2.0**: Industry-standard authentication protocol
- **Token Management**: Automatic token refresh and secure storage

## ⚡ Performance Optimizations

### React Optimizations

- **React Compiler**: Automatic optimization of component renders
- **Lazy Loading**: Route-based code splitting
- **Memoization**: Strategic use of `useMemo` and `useCallback`
- **Virtual Scrolling**: For large manga lists

### Electron Optimizations

- **Process Isolation**: Main and renderer processes separated
- **Memory Management**: Garbage collection and memory monitoring
- **Asset Optimization**: Image compression and lazy loading
- **Background Processing**: Heavy operations in main process

### Storage Optimizations

- **Three-Layer Caching**: In-memory → localStorage → Electron Store
- **Batch Operations**: Grouping storage operations for efficiency
- **Selective Sync**: Only sync changed data between storage layers
- **Compression**: Large JSON objects compressed before storage

### API Optimizations

- **Request Batching**: Multiple operations in single GraphQL request
- **Response Caching**: Custom cache management with manual invalidation
- **Rate Limit Respect**: Automatic backoff and retry strategies
- **Background Updates**: Non-blocking API calls where possible

### Bundle Optimizations

- **Code Splitting**: Separate bundles for main, preload, and renderer
- **Tree Shaking**: Remove unused code from final bundle
- **Asset Optimization**: Compress images and minimize bundle size
- **Dynamic Imports**: Load components only when needed
