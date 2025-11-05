# React Hooks & Essential Patterns Reference

## Built-in Custom Hooks (in `src/hooks/`)

### useAuth()

- Access authentication state and OAuth methods
- Returns: `authState`, `isLoading`, `error`, `statusMessage`, `login()`, `logout()`, etc.
- Purpose: Global auth state management

### useSynchronization()

- Manage manga synchronization to AniList
- Returns: `isSyncing`, `syncProgress`, `syncError`, `startSync()`, `cancelSync()`
- Purpose: Track batch sync operations with progress

### useTimeEstimate()

- Calculate ETA for long-running operations
- Returns: `estimatedRemainingSeconds`, `formattedEstimate`, `averageTimePerItem`
- Purpose: User feedback on operation duration

### useMatchingProcess()

- Orchestrate manga matching workflow
- Returns: `startMatching()`, `cancelMatching()`, `matchingState` with progress/status
- Purpose: Control matching operations with pause/resume

### useMatchHandlers()

- Handle all match actions (accept, reject, rematch) with batch support
- Handlers: `onAcceptMatch()`, `onRejectMatch()`, `onSelectAlternative()`, `onManualSearch()`
- Supports: Single match or batch operations with undo/redo
- Purpose: Central match action handler with transaction support

### usePendingManga()

- Filter and access pending/unmatched manga
- Returns: `pending` array, `totalCount`, `updatePending()`
- Purpose: Work with unmatched items only

## Common Patterns

### Batch Selection Pattern

**Purpose**: Enable users to select multiple items and perform batch operations.

**Implementation**:

- State: `useState<Set<number>>(new Set())` for O(1) lookup
- Create new Set on update: `setSelected(new Set(prev).add(id))` to trigger re-renders
- Use unique IDs (not array indices) for stability across scroll/filter

**Integration with useMatchHandlers**:

```typescript
const selectedMatches = matchResults.filter((m) => selectedIds.has(m.kenmeiManga.id));
handleAcceptMatch({ isBatchOperation: true, matches: selectedMatches });
```

**Performance**: Selection persists during scroll/filter/sort (independent of rendering)

### Dependency Array Rules (React Compiler Critical)

**Include every external value used inside effect**:

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

**Always clean up subscriptions, timers, event listeners**:

```typescript
useEffect(() => {
  const unsubscribe = subscribe((data) => setState(data));
  return () => unsubscribe(); // Cleanup function
}, []);
```

### useCallback for Props

**Use when function is passed as prop** to prevent unnecessary re-renders:

```typescript
const handleClick = useCallback((id) => {
  onSelect(id);
}, [onSelect]); // Include external dependencies

return <Child onClick={handleClick} />;
```

### useState with Objects

**Create new object on state update** to trigger re-renders:

```typescript
// ✅ Correct - new object
setState({ ...state, count: state.count + 1 });

// ❌ Wrong - mutates existing object
state.count += 1;
setState(state);
```

## Context Hooks

- `useAuth()` - Authentication state and methods
- `useDebug()` - Debug mode and logging context
- `useTheme()` - Theme management
- `useRateLimit()` - AniList rate limit tracking

## Anti-Patterns to Avoid

- ❌ Create hooks inside components (won't work)
- ❌ Call hooks conditionally (if, loops, try-catch)
- ❌ Use hooks outside React components
- ❌ Create infinite loops in useEffect (missing deps)
- ❌ Store functions in useState (use useCallback instead)
- ❌ Mutate state directly (create new objects)
- ❌ Ignore hook dependency warnings (React Compiler enforces rules)

## React Compiler Notes

- **Auto-memoization**: No need for manual `useMemo`/`useCallback` in most cases
- **Dependency rules are non-negotiable**: ESLint enforces, cannot be disabled
- **Profile before manual optimization**: Compiler handles most cases efficiently
