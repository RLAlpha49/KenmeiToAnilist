# React Hooks & Custom Hooks Reference

## Built-in Custom Hooks (in `src/hooks/`)

### useAuth()

**Purpose**: Access authentication state and methods
**From**: `src/hooks/useAuth.ts`
**Returns**:

```typescript
{
  authState: AuthState; // Current user state
  isLoading: boolean;
  error: string | null;
  statusMessage: string | null;
  customCredentials: APICredentials | null;
  login: (credentials) => Promise<void>;
  refreshToken: () => Promise<void>;
  logout: () => void;
  cancelAuth: () => Promise<void>;
  setCredentialSource: (source) => void;
  updateCustomCredentials: (clientId, clientSecret, redirectUri) => void;
}
```

**Usage**:

```typescript
const auth = useAuth();
if (!auth.authState.isAuthenticated) {
  return <LoginForm />;
}
```

### useSynchronization()

**Purpose**: Manage manga synchronization to AniList
**From**: `src/hooks/useSynchronization.ts`
**Returns**:

```typescript
{
  isSyncing: boolean;
  syncProgress: {
    completed: number;
    total: number;
    failed: number;
  };
  syncError: string | null;
  syncStats: {
    startTime: number;
    endTime?: number;
    duration?: number;
  };
  startSync: (entries) => Promise<void>;
  cancelSync: () => void;
}
```

**Usage**:

```typescript
const { isSyncing, syncProgress, startSync } = useSynchronization();
useEffect(() => {
  startSync(entries);
}, []);
```

### useTimeEstimate()

**Purpose**: Calculate ETA for long-running operations
**From**: `src/hooks/useTimeEstimate.ts`
**Returns**:

```typescript
{
  estimatedRemainingSeconds: number;
  formattedEstimate: string; // "5 minutes 30 seconds"
  averageTimePerItem: number;
}
```

**Usage**:

```typescript
const estimate = useTimeEstimate(totalItems, itemsProcessed);
<p>Time remaining: {estimate.formattedEstimate}</p>
```

### useMatchingProcess()

**Purpose**: Orchestrate manga matching workflow
**From**: `src/hooks/useMatchingProcess.ts`
**Returns**:

```typescript
{
  startMatching: (config) => Promise<void>;
  cancelMatching: () => void;
  pauseMatching: () => void;
  resumeMatching: () => void;
  updateResults: (results) => void;
  matchingState: {
    isRunning: boolean;
    isPaused: boolean;
    progress: MatchingProgress;
    statusMessage: string;
  };
}
```

**Usage**:

```typescript
const matching = useMatchingProcess();
useEffect(() => {
  matching.startMatching({
    manga: mangaArray,
    bypassCache: false,
  });
  return () => matching.cancelMatching();
}, [mangaArray]);
```

### useMatchHandlers()

**Purpose**: Handle all match actions (accept, reject, rematch)
**From**: `src/hooks/useMatchHandlers.ts`
**Returns**: `MatchHandlersProps` object with handlers:

- `onManualSearch(manga)` - User manual search
- `onAcceptMatch(result)` - Accept suggested match
- `onRejectMatch(result)` - Reject match
- `onSelectAlternative(result, index)` - Pick from alternatives
- `onResetToPending(result)` - Reset to pending status

### usePendingManga()

**Purpose**: Filter and access pending/unmatched manga
**From**: `src/hooks/usePendingManga.ts`
**Returns**:

```typescript
{
  pending: MangaMatchResult[];
  totalCount: number;
  updatePending: (results) => void;
}
```

---

## React Hooks Tips

### Dependency Array Rules

**Critical for React Compiler**:

- Include every external value used inside effect
- Include functions/objects if they're dependencies
- Empty `[]` = run once on mount

```typescript
// ✅ Correct - userId included
useEffect(() => {
  fetchData(userId);
}, [userId]);

// ❌ Wrong - missing dependency
useEffect(() => {
  fetchData(userId); // userId used but not in deps
}, []);
```

### Cleanup in useEffect

**Always clean up** subscriptions, timers, event listeners:

```typescript
useEffect(() => {
  const unsubscribe = subscribe((data) => {
    setState(data);
  });

  return () => unsubscribe(); // Cleanup
}, []);
```

### useCallback for Event Handlers

**Use when function is passed as prop** to prevent unnecessary re-renders:

```typescript
const handleClick = useCallback((id) => {
  onSelect(id);
}, [onSelect]); // onSelect as dependency

return <Child onClick={handleClick} />;
```

### useState with Objects

**Create new object on state update** to trigger re-renders:

```typescript
const [state, setState] = useState({ count: 0 });

// ✅ Correct - new object
setState({ ...state, count: state.count + 1 });

// ❌ Wrong - mutates existing object
state.count += 1;
setState(state);
```

---

## Context Hooks

### useDebug()

Access debug context (debug mode, feature toggles)

### useTheme()

Access theme context (current theme, toggle methods)

### useRateLimit()

Access AniList rate limit info

---

## Implementing Custom Hooks

### Structure

```typescript
/**
 * @packageDocumentation
 * @description Hook for [feature]
 * @source
 */

export default function useMyFeature() {
  // State
  const [state, setState] = useState(initial);

  // Context usage
  const context = useContext(SomeContext);

  // Effects
  useEffect(() => {
    // setup
    return () => {
      // cleanup
    };
  }, [dependencies]);

  // Callbacks
  const handler = useCallback(() => {
    // handle
  }, [deps]);

  // Return
  return { state, handler };
}
```

### Testing Custom Hooks

- Use React Testing Library `renderHook()`
- Test initial state
- Test state updates
- Test effect cleanup
- Test error scenarios

### Performance

- React Compiler auto-memoizes outputs
- Use `useCallback` only for props passed to memoized children
- Use `useMemo` only after profiling shows benefit

---

## Anti-Patterns to Avoid

### Don't

- Create hooks inside components (they won't work)
- Call hooks conditionally (if, loops, try-catch)
- Use hooks outside React components
- Create infinite loops in useEffect (missing deps)
- Store functions in useState (use useCallback instead)
- Mutate state directly (create new objects)
- Ignore hook dependency warnings
