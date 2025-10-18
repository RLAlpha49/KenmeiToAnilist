# Feature Development Checklist

## Adding a New UI Page

### Step 1: Create Route & Page Component

- [ ] Create `src/pages/NewFeaturePage.tsx` component
- [ ] Define props interface for page
- [ ] Use `BaseLayout` wrapper for consistent structure
- [ ] Add to `src/routes/routes.tsx` as route definition
- [ ] Add to route tree in `src/routes/router.tsx`

### Step 2: Add Navigation

- [ ] Add link in navigation (`src/components/layout/Navigation.tsx`)
- [ ] Import route path from router
- [ ] Test navigation works

### Step 3: Implement UI Components

- [ ] Use shadcn/ui components from `src/components/ui/`
- [ ] Create feature-specific components in `src/components/feature-name/`
- [ ] Define prop interfaces for all components
- [ ] Use TailwindCSS for styling (auto-sorted by Prettier)
- [ ] Add CVA variants for component styling

### Step 4: Add Context/State if Needed

- [ ] Create context provider in `src/contexts/` if complex state
- [ ] OR use built-in contexts (AuthContext, DebugContext, etc.)
- [ ] Export custom hook `useFeatureName()` for easy access

### Step 5: Handle Data Access

- [ ] Use `storage` utility for localStorage/electron-store access
- [ ] Use exposed IPC contexts (`globalThis.electron*`) for Node.js operations
- [ ] Add error handling with `createError()`

### Step 6: Add Logging

- [ ] Use `console.debug("[FeatureName] message")` for module-tagged logs
- [ ] Include operation start, progress, and completion
- [ ] Include error details for debugging

### Step 7: Testing & Polish

- [ ] Run `npm run precommit` (format + lint)
- [ ] Test in dev mode: `npm start`
- [ ] Test on different screen sizes
- [ ] Test error states
- [ ] Verify accessibility (keyboard navigation, etc.)

---

## Adding New IPC Handler for Main Process Operation

### Step 1: Create Handler File

- [ ] Create `src/helpers/ipc/{domain}/{handler-name}.ts`
- [ ] Define channel name constant
- [ ] Export handler setup function

### Step 2: Implement Handler

```typescript
export function setupMyFeatureHandlers() {
  ipcMain.handle("myfeature:operation", async (_, params) => {
    try {
      console.debug("[MyFeature] Starting operation");
      const result = await performOperation(params);
      return { success: true, data: result };
    } catch (error) {
      console.error("[MyFeature] Operation failed:", error);
      return { success: false, error: String(error) };
    }
  });
}
```

### Step 3: Expose in Context Bridge

- [ ] Add to `src/helpers/ipc/context-exposer.ts`
- [ ] Expose in appropriate context object
- [ ] Test type inference works

### Step 4: Register Handler

- [ ] Import setup function in `src/helpers/ipc/listeners-register.ts`
- [ ] Call in main handler registration

### Step 5: Use in Renderer

```typescript
// In React component
const result = await globalThis.electronApi.operation(params);
if (!result.success) {
  // Handle error
}
```

---

## Adding New Storage Key

### Step 1: Define Storage Key

- [ ] Add to `STORAGE_KEYS` constant in `src/utils/storage.ts`
- [ ] Use UPPER_SNAKE_CASE naming
- [ ] Add JSDoc comment explaining purpose

### Step 2: Define Type

- [ ] Create interface for stored data in appropriate `src/types/*.ts`
- [ ] Add to barrel exports if in new file

### Step 3: Handle Migration

- [ ] If changing existing structure: increment `CURRENT_CACHE_VERSION`
- [ ] Old cache cleared on app restart after version bump
- [ ] No data loss - just cache invalidation

### Step 4: Use in Code

```typescript
import { storage, STORAGE_KEYS } from "@/utils/storage";

// Save
storage.setItem(STORAGE_KEYS.NEW_KEY, JSON.stringify(data));

// Read
const data = storage.getItem(STORAGE_KEYS.NEW_KEY);
if (data) {
  const parsed = JSON.parse(data);
}

// Delete
storage.removeItem(STORAGE_KEYS.NEW_KEY);
```

---

## Adding New API Query

### Step 1: Define GraphQL Query

- [ ] Add to `src/api/anilist/queries.ts`
- [ ] Use query builder pattern
- [ ] Export as constant (e.g., `SEARCH_MANGA`)

### Step 2: Define Response Types

- [ ] Create interfaces in `src/api/anilist/types.ts`
- [ ] Include all response fields as typed properties
- [ ] Add JSDoc for complex fields

### Step 3: Create Client Function

- [ ] Add function in `src/api/anilist/client.ts`
- [ ] Implement caching if appropriate (30-min expiration for search)
- [ ] Add rate limit checking via `RateLimitContext`
- [ ] Handle errors with `createError()`

### Step 4: Handle Rate Limits

- [ ] Check remaining quota before making API call
- [ ] Implement retry logic for 429 responses
- [ ] Wait `retryAfter` seconds before retry
- [ ] Log rate limit status

### Step 5: Use in Services

- [ ] Call from matching service or sync service
- [ ] Handle errors gracefully
- [ ] Update progress context if batch operation

---

## Adding New Custom Hook

### Step 1: Create Hook File

- [ ] Create `src/hooks/use{FeatureName}.ts`
- [ ] Export default hook with `use` prefix
- [ ] Add JSDoc comment explaining purpose and usage

### Step 2: Implement Hook

```typescript
export default function useMyFeature() {
  const [state, setState] = useState(initialState);

  useEffect(() => {
    // Initialize or subscribe
    const unsubscribe = subscribeToSomething((value) => {
      setState(value);
    });

    // Cleanup
    return () => unsubscribe?.();
  }, []);

  return { state /* methods */ };
}
```

### Step 3: Handle Dependencies

- [ ] Import from contexts via `useAuth()`, `useDebug()`, etc.
- [ ] Use other custom hooks for composition
- [ ] Maintain proper dependency arrays

### Step 4: Error Handling

- [ ] Wrap async operations in try-catch
- [ ] Use `createError()` for consistency
- [ ] Propagate errors to caller or state

### Step 5: Test Usage

- [ ] Document expected props/context
- [ ] Add JSDoc @example if behavior is non-obvious
- [ ] Test hook in development

---

## Adding Type Definitions

### Step 1: Identify Scope

- [ ] API types → `src/types/api.ts`
- [ ] Auth types → `src/types/auth.ts`
- [ ] Matching types → `src/types/matching.ts`
- [ ] New domain → create new file

### Step 2: Define Interfaces

- [ ] Create interface with clear property names
- [ ] Add JSDoc for interface and each property
- [ ] Import related types as needed

### Step 3: Export & Document

- [ ] Export from file
- [ ] Add @source tag for TypeDoc generation
- [ ] Document usage location if non-obvious

### Step 4: Update Barrel Exports

- [ ] Add to `src/types/index.ts` if creating new file
- [ ] Import in type definition files that need it

---

## Common Patterns to Follow

### Error Handling Pattern

```typescript
try {
  const result = await operation();
  console.debug("[Module] Operation completed");
  return result;
} catch (error) {
  const err = createError(ErrorType.NETWORK, "Operation failed", error, "OPERATION_FAILED");
  console.error("[Module] Operation error:", err);
  throw err;
}
```

### Async State Pattern

```typescript
const [isLoading, setIsLoading] = useState(false);
const [error, setError] = useState<string | null>(null);

const execute = useCallback(async () => {
  setIsLoading(true);
  setError(null);
  try {
    // operation
  } catch (err) {
    setError(String(err));
  } finally {
    setIsLoading(false);
  }
}, []);
```

### Context Hook Pattern

```typescript
export default function useMyContext() {
  const context = useContext(MyContext);
  if (!context) {
    throw new Error("useMyContext must be used within MyProvider");
  }
  return context;
}
```

---

## Testing & Verification

Before committing:

1. [ ] Run `npm run precommit` - Format and lint
2. [ ] Run `npm start` - Start dev server
3. [ ] Test feature manually in app
4. [ ] Test error cases
5. [ ] Check console for any warnings/errors
6. [ ] Verify performance is acceptable
7. [ ] Use SonarQube if making complex changes
