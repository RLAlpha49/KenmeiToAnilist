# Common Gotchas & Troubleshooting

## IPC & Communication Issues

### "reply was never sent" Error

**Cause**: IPC handler resolves before `ipcRenderer.send()` completes, or handler throws before sending response.

**Solution**:

- For async operations, set up promise handlers AFTER returning IPC response
- Use `setTimeout(..., 100)` to defer async logic
- Ensure all code paths return a value
- Example from auth flow:

```typescript
return { success: true }; // Return immediately
setTimeout(() => {
  authCodePromise.then((code) => {
    mainWindow.webContents.send("auth:codeReceived", { code }); // Async event
  });
}, 100);
```

### IPC Timeout / No Response

**Cause**: Handler crashes silently, or promise never resolves.

**Solution**:

- Check main process console for errors
- Enable IPC debugging to see if handler is called
- Add `console.debug()` at handler start
- Ensure error cases always return value: `{ success: false, error: "message" }`

### Memory Leaks from Event Listeners

**Cause**: `ipcRenderer.on()` listeners not cleaned up, or listeners registered multiple times.

**Solution**:

- Always return cleanup function from hooks:

```typescript
useEffect(() => {
  const unsubscribe = globalThis.electronAuth.onCodeReceived(handleCode);
  return () => unsubscribe();
}, []);
```

- Clear listeners before adding new ones: `ipcRenderer.removeAllListeners(channel)`

---

## React Compiler & Hooks Issues

### "React Compiler: Invalid Hook Dependency"

**Cause**: ESLint rule violation - hook dependency order matters for React Compiler.

**Solution**:

- DON'T try to disable the rule (React Compiler enforces it)
- Add missing dependency or restructure logic
- Wrap callback with `useCallback` if function needs stability
- Example - Use `useCallback` for event handlers:

```typescript
const handleSearch = useCallback((query: string) => {
  // Query is dependency, not function body
  performSearch(query);
}, []); // Empty deps if no external dependencies
```

### "useX hook must be called unconditionally"

**Cause**: Calling hooks inside conditionals or loops.

**Solution**:

- ALWAYS call hooks at top level of component
- NEVER in `if`/`for`/`try-catch`
- Move conditional logic to hook return/effect

```typescript
// ✅ CORRECT
const enabled = useFeatureFlag();
const data = useData(); // Always called

if (enabled) {
  return <Feature data={data} />;
}

// ❌ WRONG
if (useFeatureFlag()) { // Hook in conditional
  const data = useData();
}
```

---

## Cache & Storage Issues

### Stale Cache After Clear

**Cause**: Cache cleared from mangaCache but `syncWithClientCache()` reloaded from localStorage.

**Solution**:

- Use `forceSearch=true` when doing fresh search (skips cache sync)
- Use `bypassCache=true` in search config (skips localStorage load)
- Use `forceWrite=true` when saving fresh results (bypasses redundancy check)

### Cache Invalidation on Data Structure Change

**Cause**: Old cached data breaks due to new fields in interface.

**Solution**:

- Increment `CURRENT_CACHE_VERSION` in `src/api/matching/cache/types.ts`
- This invalidates ALL old cache entries on app restart
- Never skip this step when changing `MangaMatchResult` or `MangaCache` structure

### Storage Redundancy Check Blocks Write

**Cause**: `storage.setItem()` compares new value with cached value, skips if equal.

**Solution**:

- Use `storage.setItem(key, value, true)` (third parameter forces write)
- Only use `forceWrite=true` when actually overriding existing data
- Example: persisting fresh search results

---

## Performance Issues

### Matching Process Runs Slowly

**Cause**:

- Too many API calls (not respecting rate limit)
- Cache not being used
- Expensive similarity calculations running serially

**Solution**:

- Check `RateLimitContext` before API calls
- Use batching (batch size 15, 1-second delays)
- Profile with Chrome DevTools Performance tab
- Check if cache is being loaded via debug logs

### UI Updates Lag During Batch

**Cause**: Long-running matching on main thread, no progress updates.

**Solution**:

- Matching happens in useEffect (no blocking)
- Progress updates via context subscription
- Use `AbortController` to cancel if user navigates away
- Increase batch size or delay if CPU usage is low

### Memory Grows During Sync

**Cause**: Match results array growing too large in memory, or event listeners accumulating.

**Solution**:

- Listener cleanup on unmount (see hooks)
- Don't store entire results array in React state if avoidable
- Use pagination or windowing for large lists
- Profile with Chrome DevTools Memory tab

---

## API & Authentication Issues

### Rate Limit Hit (429 Response)

**Cause**: More than 60 API requests in a minute.

**Solution**:

- Check `RateLimitContext.remaining` before bulk operations
- Use batching with 1-second delays (naturally throttles to 60/min)
- Implement backoff retry: wait `retryAfter` seconds before retry
- Don't bypass rate limiting - queue operations instead

### OAuth Timeout (2 minute limit)

**Cause**: User takes too long to log in, or network issue during auth code exchange.

**Solution**:

- User has 2 minutes from clicking auth link to complete login
- If timeout occurs, try logging in again
- Check internet connection if retry doesn't work
- Enable debug mode to see status messages in auth flow

### CORS / Network Error During Token Exchange

**Cause**: Browser/renderer making network request (CORS issues), or network connectivity.

**Solution**:

- Token exchange now happens in main process (not renderer)
- This avoids CORS issues entirely
- If still failing, check:
  - Internet connectivity
  - Proxy/firewall blocking AniList API
  - Custom client ID/secret validity

### "No credentials found" Error

**Cause**: Credentials weren't stored, or wrong source requested.

**Solution**:

- Credentials stored by source: "default" or "custom"
- Check Auth settings which source is being used
- Try storing credentials again in settings
- If custom credentials failed, switch back to default

---

## Type Safety Issues

### "Cannot find name" TypeScript Error

**Cause**: Type not imported or not exported from module.

**Solution**:

- Import from correct location: `import type { TypeName } from "@/types/..."`
- Check if type is exported from module (check barrel exports)
- Use `grep_search` to find type definition
- Add to export if needed

### "Object is of type 'unknown'" Error

**Cause**: Strict mode requires type narrowing for unknown types.

**Solution**:

- Use type guard function: `if (typeof obj === 'object' && obj !== null)`
- Use `instanceof` for class instances
- Use type assertion only when 100% sure: `obj as TypeName`
- Better: fix function to return properly typed value

---

## Debug Mode Issues

### Debug Mode Doesn't Enable

**Cause**: Debug panel not toggling, or settings not saving.

**Solution**:

- Settings stored via electron-store (file-based)
- Check if settings file exists: `~/.kenmeitoanilist/` on Windows
- Try resetting: delete config file and restart app
- Check console for storage errors

### Log Viewer Shows No Logs

**Cause**: Console interception not set up, or logs already printed before viewer opened.

**Solution**:

- Logs captured from moment app starts
- If viewer opened after logs printed, they're already captured
- Enable IPC Monitor to see all IPC calls
- Use `console.debug("[Module]", message)` for custom logs with module tag

### IPC Monitor Empty

**Cause**: IPC debugging not enabled.

**Solution**:

- In debug settings, toggle "IPC Monitor" ON
- Performs action that uses IPC (e.g., theme change)
- IPC events should now appear in monitor
- Max 500 entries - oldest removed when full
