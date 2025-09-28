# Storage Implementation Documentation

## Overview

The application uses a three-layer storage architecture that combines in-memory caching, browser localStorage, and Electron's persistent file-based storage.

## Architecture

### Three-Layer Storage System

```text
┌─────────────────┐
│  In-Memory      │  ← Fastest access, cleared on app restart
│  Cache          │
│  (storageCache) │
└─────────────────┘
         ↕
┌─────────────────┐
│  localStorage   │  ← Browser storage, persists in web context
│  (Browser API)  │
└─────────────────┘
         ↕
┌─────────────────┐
│  Electron Store │  ← File-based storage, persists across app restarts
│ (electron-store)│  ← **AUTHORITATIVE SOURCE**
└─────────────────┘
```

### Storage Precedence Hierarchy

**Electron Store takes precedence** over all other storage layers:

1. **Electron Store** - Authoritative source of truth
2. **localStorage** - Fast cache that gets overwritten by Electron Store
3. **In-Memory Cache** - Fastest access, synchronized with other layers

## Implementation Details

### Core Storage Module (`src/utils/storage.ts`)

#### Key Components

```typescript
// In-memory cache for fast access
export const storageCache: Record<string, string> = {};

// Main storage interface
export const storage = {
  getItem: (key: string) => string | null,
  setItem: (key: string, value: string) => void,
  removeItem: (key: string) => void,
  clear: () => void,
  getItemAsync: (key: string) => Promise<string | null>
};
```

#### Storage Keys

```typescript
export const STORAGE_KEYS = {
  KENMEI_DATA: "kenmei_data",           // Imported manga data from CSV
  IMPORT_STATS: "import_stats",         // Import statistics and metadata
  MATCH_RESULTS: "match_results",       // Manga matching results and user selections
  PENDING_MANGA: "pending_manga",       // Manga pending matching processing
  CACHE_VERSION: "cache_version",       // Cache version for compatibility checking
  SYNC_CONFIG: "sync_config",           // Synchronization configuration settings
  SYNC_STATS: "sync_stats",            // Synchronization statistics and history
  MATCH_CONFIG: "match_config",         // Matching algorithm configuration
};

// Current cache version for compatibility
export const CURRENT_CACHE_VERSION = 1;
```

### Read Operations

#### Synchronous Read (`storage.getItem()`)

```typescript
getItem: (key: string): string | null => {
  // 1. Check in-memory cache first
  if (key in storageCache) {
    return storageCache[key];
  }

  // 2. Read from localStorage for immediate return
  const value = localStorage.getItem(key);
  if (value !== null) {
    storageCache[key] = value;
  }

  // 3. Asynchronously check Electron Store in background
  if (globalThis.electronStore) {
    globalThis.electronStore
      .getItem(key)
      .then((electronValue) => {
        if (electronValue !== null && electronValue !== value) {
          // Electron Store wins conflicts
          localStorage.setItem(key, electronValue);
          storageCache[key] = electronValue;
        }
      })
      .catch((error) => console.error(`Error retrieving ${key}:`, error));
  }

  return value;
};
```

#### Asynchronous Read (`storage.getItemAsync()`)

```typescript
getItemAsync: async (key: string): Promise<string | null> => {
  if (globalThis.electronStore) {
    try {
      const value = await globalThis.electronStore.getItem(key);
      if (value !== null) {
        // Keep localStorage in sync
        localStorage.setItem(key, value);
        storageCache[key] = value;
      }
      return value;
    } catch (error) {
      // Fallback to localStorage
      return localStorage.getItem(key);
    }
  }
  return localStorage.getItem(key);
};
```

### Write Operations

#### Standard Write (`storage.setItem()`)

```typescript
setItem: (key: string, value: string): void => {
  // Avoid redundant operations
  if (storageCache[key] === value) {
    return;
  }

  // 1. Update cache immediately
  storageCache[key] = value;

  // 2. Update localStorage synchronously
  localStorage.setItem(key, value);

  // 3. Update Electron Store asynchronously
  if (globalThis.electronStore) {
    globalThis.electronStore
      .setItem(key, value)
      .catch((error) => console.error(`Error storing ${key}:`, error));
  }
};
```

### Delete Operations

```typescript
removeItem: (key: string): void => {
  // 1. Remove from cache
  delete storageCache[key];

  // 2. Remove from localStorage
  localStorage.removeItem(key);

  // 3. Remove from Electron Store
  if (globalThis.electronStore) {
    globalThis.electronStore
      .removeItem(key)
      .catch((error) => console.error(`Error removing ${key}:`, error));
  }
};
```

## Electron Store Integration

### IPC Bridge Setup

#### Context Bridge (`src/helpers/ipc/store/store-context.ts`)

```typescript
export function exposeStoreContext() {
  contextBridge.exposeInMainWorld("electronStore", {
    getItem: (key: string) => ipcRenderer.invoke("store:getItem", key),
    setItem: (key: string, value: string) =>
      ipcRenderer.invoke("store:setItem", key, value),
    removeItem: (key: string) => ipcRenderer.invoke("store:removeItem", key),
    clear: () => ipcRenderer.invoke("store:clear"),
  });
}
```

#### Main Process Handler (`src/helpers/ipc/store/store-setup.ts`)

```typescript
const store = new Store<StoreSchema>();

export function setupStoreIPC() {
  ipcMain.handle("store:getItem", (_, key: string) => {
    try {
      return store.get(key, null);
    } catch (error) {
      console.error(`Error getting item from store: ${key}`, error);
      return null;
    }
  });

  ipcMain.handle("store:setItem", (_, key: string, value: string) => {
    try {
      store.set(key, value);
      return true;
    } catch (error) {
      console.error(`Error setting item in store: ${key}`, error);
      return false;
    }
  });

  // ... similar handlers for removeItem and clear
}
```

## Conflict Resolution

### Precedence Rules

1. **On Read Conflicts**: Electron Store value overwrites localStorage and cache
2. **On Write**: All layers updated simultaneously
3. **On App Restart**: Electron Store is authoritative source

### Conflict Resolution Flow

```text
App Start → Read from localStorage (fast) → Background check Electron Store
            ↓
If different → Electron Store overwrites localStorage → Cache updated
            ↓
Result: Electron Store value is used
```

## Debug Menu Integration

The Debug Menu (`src/components/debug/DebugMenu.tsx`) provides visibility into the storage system and implements automatic synchronization.

### Automatic Synchronization

When editing Electron Store items through the Debug Menu:

```typescript
// Electron Store operations automatically sync to other layers
if (editingItem.isElectron) {
  await globalThis.electronStore.setItem(key, value);

  // Automatic synchronization
  localStorage.setItem(key, value);
  storageCache[key] = value;

  toast.success("Electron store updated. localStorage and cache synced.");
}
```

## Usage Patterns

### Recommended Usage

```typescript
// For immediate access (synchronous)
const data = storage.getItem(STORAGE_KEYS.KENMEI_DATA);

// For guaranteed latest data (asynchronous)
const data = await storage.getItemAsync(STORAGE_KEYS.KENMEI_DATA);

// For writing data
storage.setItem(STORAGE_KEYS.KENMEI_DATA, JSON.stringify(mangaData));
```

### Common Use Cases

1. **App Initialization**: Use `getItemAsync()` to ensure latest data
2. **Frequent Reads**: Use `getItem()` for cached performance
3. **Data Updates**: Use `setItem()` for automatic multi-layer sync
4. **Debug/Admin**: Use Debug Menu for direct storage inspection

## Migration and Versioning

The storage system includes cache versioning for handling data structure changes:

```typescript
export const CURRENT_CACHE_VERSION = 1;

// Version checking ensures compatibility
const version = parseInt(storage.getItem(STORAGE_KEYS.CACHE_VERSION) || "0");
if (version < CURRENT_CACHE_VERSION) {
  // Handle migration
}
```
