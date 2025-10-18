# IPC & Context Bridge Patterns

## Context Bridge Architecture

**Location**: `src/helpers/ipc/context-exposer.ts`

All IPC communication uses context bridge pattern for security. The renderer process does NOT access IPC directly.

### Five Exposed Contexts

1. **electronWindow** - Window management
   - `minimize()` - Minimize window
   - `maximize()` - Toggle maximize
   - `close()` - Close window

2. **electronTheme** - Theme persistence
   - `getCurrentMode()` - Get current theme
   - `toggleTheme()` - Cycle through themes
   - `setDarkMode()` - Force dark theme
   - `setLightMode()` - Force light theme
   - `setSystemMode()` - Use system theme
   - `onThemeChange(callback)` - Listen for theme changes

3. **electronAuth** - OAuth & credentials
   - `openOAuthWindow(url, redirectUri)` - Start OAuth flow
   - `storeCredentials(credentials)` - Save OAuth credentials
   - `getCredentials(source)` - Get stored credentials
   - `exchangeToken(params)` - Exchange auth code for token
   - `onCodeReceived(callback)` - Listen for auth code
   - `onCancelled(callback)` - Listen for cancellation
   - `onStatus(callback)` - Listen for status updates

4. **electronStore** - Electron-store file access
   - `setItem(key, value)` - Save to store
   - `getItem(key)` - Get from store
   - `removeItem(key)` - Delete from store
   - `clear()` - Clear all store data

5. **electronApi** - AniList API calls
   - `searchManga(query, config)` - Search for manga
   - `advancedSearchManga(options)` - Advanced search
   - `getMangaByIds(ids)` - Fetch by IDs
   - `getUserMangaList(userId, options)` - Get user's list
   - `syncMangaBatch(entries)` - Batch update user list
   - `updateMangaEntry(id, data)` - Update single entry

### Usage Pattern

```typescript
// ✅ CORRECT - Use exposed context
const token = await globalThis.electronAuth.getAccessToken(code);
await globalThis.electronStore.setItem("key", value);

// ❌ WRONG - Direct IPC usage
ipcRenderer.invoke("auth:login");
ipcRenderer.send("store:set");
```

## IPC Channel Organization

**Location**: `src/helpers/ipc/`

All IPC handlers organized by domain in separate files:

```text
helpers/ipc/
├── context-exposer.ts (exposes 5 contexts)
├── listeners-register.ts (registers all handlers)
├── api/
│   ├── api-context.ts (expose electronApi)
│   └── api-listeners.ts (handle API calls)
├── auth/
│   ├── auth-context.ts (expose electronAuth)
│   └── auth-listeners.ts (handle OAuth)
├── store/
│   ├── store-context.ts (expose electronStore)
│   └── store-setup.ts (handle store operations)
├── theme/
│   ├── theme-channels.ts (channel constants)
│   ├── theme-context.ts (expose electronTheme)
│   └── theme-listeners.ts (handle theme changes)
├── window/
│   ├── window-channels.ts (channel constants)
│   ├── window-context.ts (expose electronWindow)
│   └── window-listeners.ts (handle window operations)
└── debug/
    └── ipc-debugger.ts (IPC logging)
```

## Handler Registration Pattern

**Main process** (`src/main.ts`):

```typescript
// All handlers registered once at startup
registerListeners(mainWindow);
exposeContexts(); // in preload
```

**Handler files** have consistent structure:

1. Channel constants (channel names)
2. Export handler setup function
3. `ipcMain.handle()` for invoke calls
4. `ipcMain.on()` for send events

### Example: Adding Auth Handler

1. **Define handler** in `src/helpers/ipc/auth/auth-listeners.ts`:

   ```typescript
   ipcMain.handle("auth:exchangeToken", async (_, params) => {
     // Handle token exchange
     return { success: true, token };
   });
   ```

2. **Expose in context** in `src/helpers/ipc/auth/auth-context.ts`:

   ```typescript
   contextBridge.exposeInMainWorld("electronAuth", {
     exchangeToken: (params) => ipcRenderer.invoke("auth:exchangeToken", params),
   });
   ```

3. **Register handler** in `src/helpers/ipc/listeners-register.ts`:

   ```typescript
   addAuthEventListeners(mainWindow);
   ```

4. **Use in renderer**:

   ```typescript
   const result = await globalThis.electronAuth.exchangeToken(params);
   ```

## OAuth Flow (Auth IPC Pattern)

**Complex async flow** spanning main ↔ renderer:

1. Renderer calls `electronAuth.openOAuthWindow(url, redirectUri)`
2. Main process starts temporary HTTP server on localhost
3. Main opens browser with OAuth URL
4. User logs in, browser redirects to localhost
5. HTTP server captures auth code
6. Main sends `auth:codeReceived` event to renderer
7. Renderer exchanges code for token via `electronAuth.exchangeToken()`
8. Main performs token exchange (avoids network issues in renderer)
9. Token returned to renderer
10. HTTP server cleaned up

**Key patterns**:

- Server starts BEFORE returning IPC response (avoid "reply never sent" errors)
- Event-based callbacks for async status updates (`onStatus`, `onCodeReceived`, `onCancelled`)
- HTTP server cleanup after code is processed
- 2-minute timeout for entire OAuth process

## Rate Limiting & Batching

AniList API has **60 requests/minute** limit.

**Batching pattern** in API handlers:

- Batch size: 15 manga per batch
- Delay between batches: 1 second
- Check `RateLimitContext` before bulk operations
- Use `AniListRateLimiter` for tracking

## IPC Debugging

**Location**: `src/helpers/ipc/debug/ipc-debugger.ts`

When debug mode is enabled:

- All IPC calls logged to `collector`
- Tracks: channel, direction, transport, status, duration, payload
- Max 500 log entries (oldest auto-removed)
- Available in Debug panel as "IPC Monitor"

**Setup**:

```typescript
setupIpcDebugging(); // Called in preload
setIpcDebuggingEnabled(value); // Toggle logging
```

**Logged info**:

- Request/response pairs correlated by ID
- Operation duration in milliseconds
- Payload preview (truncated for large objects)
- Error messages if operation fails

## Performance Considerations

- IPC calls are async (even invoke calls await results)
- Batch large operations to respect rate limits
- Use events for status updates instead of many invoke calls
- Cache results to avoid redundant IPC round-trips
- Cleanup resources (HTTP server, listeners) to prevent memory leaks

## Security Model

**Three security layers**:

1. **Context Bridge** - Only whitelisted methods exposed
2. **IPC Handler Validation** - Input validation on all handlers
3. **Preload Script** - Runs in secure context, bridges gap

**Never expose**:

- File system operations (except electron-store)
- Child process spawn
- Native modules
- Unvalidated user input to Node.js APIs
