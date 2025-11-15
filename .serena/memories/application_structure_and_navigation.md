# Application Structure & Navigation

## High-Level Architecture

```text
KenmeiToAnilist/
├── src/                          # Source code
│   ├── main.ts                   # Electron main process
│   ├── preload.ts                # Preload script for context bridge
│   ├── renderer.ts               # Renderer process entry
│   ├── App.tsx                   # Main React application component
│   ├── types.d.ts                # Global type definitions
│   ├── api/                      # API integration layer
│   ├── assets/                   # Static assets (images, etc.)
│   ├── components/               # React components
│   ├── config/                   # Configuration files
│   ├── contexts/                 # React contexts for global state
│   ├── helpers/                  # Utility functions and helpers
│   ├── hooks/                    # Custom React hooks
│   ├── pages/                    # Page components
│   ├── routes/                   # TanStack Router configuration
│   ├── styles/                   # Global styles and CSS
│   ├── types/                    # TypeScript type definitions
│   ├── utils/                    # Utility functions
│   └── workers/                  # Web workers for background processing
├── config/                       # Build and configuration files
├── docs/                         # Documentation
├── scripts/                      # Development and utility scripts
└── package.json                  # Dependencies and scripts
```

## Application Flow

```text
Electron Main Process
├── Window Management
├── IPC Handlers (Context Bridge)
├── File System Operations
├── Network Requests
└── Storage (electron-store)

Context Bridge (Secure IPC)
└── Renderer Process
    ├── React Application
    ├── UI Components
    ├── State Management
    └── User Interactions
```

## Navigation Architecture

### Router Configuration

- **Framework**: TanStack Router with memory history (no URLs for Electron)
- **Root Route**: `src/routes/__root.tsx` - Base layout with providers
- **Route Definitions**: `src/routes/routes.ts` - All page routes
- **Router Instance**: `src/routes/router.ts` - Router initialization

### Page Structure

```text
/
├── /                           # Home Page - Dashboard and quick actions
├── /import                     # Import Page - Kenmei CSV upload and processing
├── /review                     # Review Page - Match review and approval
├── /sync                       # Sync Page - Synchronization with AniList
├── /statistics                 # Statistics Page - Reading analytics and charts
└── /settings                   # Settings Page - Configuration and preferences
```

### Component Hierarchy

```text
App.tsx
├── BaseLayout (src/components/layout/BaseLayout.tsx)
│   ├── Header (src/components/layout/Header.tsx)
│   ├── Main Content Area
│   ├── BackgroundMatchingIndicator
│   └── Footer (src/components/layout/Footer.tsx)
└── Route-specific components
```

## Key Components

### Layout Components

- **BaseLayout**: Main application wrapper with header, footer, and content area
- **Header**: Navigation bar with app title and user actions
- **Footer**: Status bar and information display
- **BackgroundMatchingIndicator**: Visual indicator for background matching operations

### Page Components

- **HomePage**: Dashboard with import status, quick actions, and recent activity
- **ImportPage**: CSV file upload, validation, and data extraction
- **ReviewPage**: Match review interface with confidence scoring
- **SyncPage**: Synchronization controls and progress tracking
- **StatisticsPage**: Analytics dashboard with charts and insights
- **SettingsPage**: Configuration for app behavior, API settings, and preferences

### UI Components

- **shadcn/ui**: Radix UI-based components with Tailwind styling
- **Custom Components**: Feature-specific components in `src/components/`
- **Form Components**: Input, select, and validation components
- **Data Display**: Table, grid, and list components for manga data

## State Management Architecture

### React Contexts

- **AuthProvider**: OAuth authentication and token management
- **ThemeContext**: Dark/light theme persistence
- **RateLimitContext**: AniList API rate limit tracking
- **DebugContext**: Debug mode and development tools
- **OnboardingContext**: User onboarding flow management

### Local State

- **Page-specific state**: Managed within page components using useState/useReducer
- **Form state**: Controlled components with validation
- **UI state**: Loading states, error handling, and user feedback

## Data Flow Architecture

### Import Flow

```text
CSV Upload → Validation → Data Extraction → Storage → Matching → Review → Sync
```

### Matching Flow

```text
Kenmei Data → AniList Search → Fallback Sources → Scoring → Ranking → User Review
```

### Sync Flow

```text
Approved Matches → Batch Processing → API Calls → Status Updates → Confirmation
```

## Error Handling Architecture

- **Global Error Boundaries**: Catch and display errors gracefully
- **Type-safe Error Handling**: Custom error types with recovery actions
- **User Notifications**: Toast notifications for errors and success messages
- **Logging**: Comprehensive logging for debugging and monitoring

## Performance Optimizations

- **Code Splitting**: Route-based and component-based splitting
- **Caching**: Multi-layer caching strategy (in-memory → localStorage → electron-store)
- **Web Workers**: CPU-intensive operations offloaded to worker threads
- **Virtualization**: Large datasets virtualized for performance
- **Memoization**: React.memo and useMemo for expensive computations

## Security Considerations

- **Context Isolation**: Main and renderer processes separated
- **IPC Validation**: Secure context bridge with sender validation
- **Content Security Policy**: Strict CSP headers for production
- **Input Validation**: All user inputs validated and sanitized
- **Secure Storage**: Encrypted storage for sensitive data
