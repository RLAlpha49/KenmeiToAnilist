# IPC & Context Bridge Patterns

## Context Bridge Architecture

**Location**: `src/helpers/ipc/context-exposer.ts`

All IPC communication uses context bridge pattern for security. The renderer process does NOT access IPC directly.

### Exposed Contexts (8)

1. electronWindow — Window management
   - minimize(), maximize(), close()

2. electronTheme — Theme persistence
   - getCurrentMode(), toggleTheme(), setDarkMode(), setLightMode(), setSystemMode(), onThemeChange(cb)

3. electronAuth — OAuth & credentials
   - openOAuthWindow(url, redirectUri)
   - storeCredentials(credentials), getCredentials(source)
   - exchangeToken(params)
   - onCodeReceived(cb), onCancelled(cb), onStatus(cb)

4. electronStore — Electron-store access
   - setItem(key, value), getItem(key), removeItem(key), clear()

5. electronApi — AniList API calls
   - searchManga(query, config), advancedSearchManga(options)
   - getMangaByIds(ids), getUserMangaList(userId, options)
   - syncMangaBatch(entries), updateMangaEntry(id, data)

6. electronUpdater — Auto-update control
   - checkForUpdates(options?: { allowPrerelease?: boolean })
   - downloadUpdate(), installUpdate()
   - onUpdateAvailable(cb), onDownloadProgress(cb), onUpdateDownloaded(cb), onUpdateError(cb)

7. electronBackup — Backup scheduler and file ops
   - getScheduleConfig(), setScheduleConfig(config)
   - getBackupLocation(), setBackupLocation(path), openBackupLocation()
   - listLocalBackups(), readLocalBackupFile(filename), deleteBackup(filename)
   - triggerBackup(), createNow()
   - getBackupStatus(), getBackupHistory(), clearHistory()
   - restoreFromLocal(filename, options?)
   - onBackupComplete(cb), onBackupError(cb), onHistoryUpdated(cb), onStatusChanged(cb)

8. electronClipboard — Clipboard helpers
   - writeText(text)

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

Location: `src/helpers/ipc/`

All IPC handlers organized by domain in separate files:

```
helpers/ipc/
├── context-exposer.ts        # Exposes 8 contexts (window, theme, auth, store, api, update, backup, clipboard)
├── listeners-register.ts     # Registers all handlers with sender validation
├── api/
│   ├── api-context.ts        # expose electronApi
│   └── api-listeners.ts      # AniList/search/sync handlers
├── auth/
│   ├── auth-context.ts       # expose electronAuth
│   └── auth-listeners.ts     # OAuth flows, token exchange
├── store/
│   ├── store-context.ts      # expose electronStore
│   └── store-setup.ts        # electron-store operations
├── theme/
│   ├── theme-channels.ts
│   ├── theme-context.ts      # expose electronTheme
│   └── theme-listeners.ts
├── window/
│   ├── window-channels.ts
│   ├── window-context.ts     # expose electronWindow
│   └── window-listeners.ts
├── update/
│   ├── update-channels.ts    # channel/event constants
│   ├── update-context.ts     # expose electronUpdater
│   └── update-listeners.ts   # autoUpdater wiring
├── backup/
│   ├── backup-channels.ts    # channel/event constants
│   ├── backup-context.ts     # expose electronBackup
│   └── backup-listeners.ts   # scheduler, file ops, history
└── clipboard/
    ├── clipboard-channels.ts
    └── clipboard-context.ts  # expose electronClipboard
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

Three layers of protection:

1. Context Bridge — Only whitelisted, strongly-typed methods are exposed to `window`.
2. Sender Validation — All `ipcMain.handle` registrations go through `secureHandle()` in `listeners-register.ts`, which validates the `webContents.id` of the sender against the main window via `isValidSender()`. Unauthorized calls are rejected and logged.
3. Input Validation — Handler-level validation of payloads (e.g., file paths, schedule config) occurs before accessing Node APIs.

Never expose:

- Arbitrary filesystem access (backup uses validated, sandboxed directories)
- Child process spawning
- Native modules to renderer
- Unvalidated input to privileged APIs
