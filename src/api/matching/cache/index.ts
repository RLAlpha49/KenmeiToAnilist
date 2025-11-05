/**
 * Cache module for manga search results and synchronization.
 * Centralizes caching, persistence, synchronization, initialization, and debugging utilities.
 * @module cache
 * @source
 */

// Types
export type { MangaCache } from "./types";
export { CACHE_EXPIRY, MANGA_CACHE_KEY, SEARCH_CACHE_KEY } from "./types";

// Storage
export {
  mangaCache,
  getListenersRegistered,
  setListenersRegistered,
  getServiceInitialized,
  setServiceInitialized,
} from "./storage";

// Utils
export {
  generateCacheKey,
  isCacheValid,
  clearMangaCache,
  clearCacheForTitles,
} from "./utils";

// Persistence
export { saveCache } from "./persistence";

// Sync
export { syncWithClientCache } from "./sync";

// Initialization
export { initializeMangaService } from "./init";

// Debugger
export { cacheDebugger } from "./debugger";
