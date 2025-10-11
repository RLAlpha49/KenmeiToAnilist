/**
 * @packageDocumentation
 * @module SyncPage/library-handlers
 * @description Library management handlers for fetching and refreshing AniList user library
 */

import { getUserMangaList } from "../../api/anilist/client";
import { UserMediaList } from "../../api/anilist/types";

/**
 * Parameters for library refresh handlers
 */
export interface LibraryRefreshParams {
  token: string;
  setLibraryLoading: (loading: boolean) => void;
  setLibraryError: (error: string | null) => void;
  setRetryCount: (count: number) => void;
  setRateLimit: (
    isLimited: boolean,
    retryAfter?: number,
    message?: string,
  ) => void;
  setUserLibrary: (library: UserMediaList) => void;
}

/**
 * Handler for refreshing user library (shared between Try Again and Refresh buttons)
 */
export function handleLibraryRefresh(params: LibraryRefreshParams): void {
  const {
    token,
    setLibraryLoading,
    setLibraryError,
    setRetryCount,
    setRateLimit,
    setUserLibrary,
  } = params;

  setLibraryLoading(true);
  setLibraryError(null);
  setRetryCount(0);
  setRateLimit(false, undefined, undefined);

  const controller = new AbortController();

  getUserMangaList(token, controller.signal)
    .then((library) => {
      console.info(
        `[LibrarySync] Loaded ${Object.keys(library).length} entries from user's AniList library`,
      );
      setUserLibrary(library);
      setLibraryLoading(false);
    })
    .catch((error) => {
      if (error.name !== "AbortError") {
        console.error(
          "[LibrarySync] Failed to load user library again:",
          error,
        );

        // Check for rate limiting - with our new client updates, this should be more reliable
        if (error.isRateLimited || error.status === 429) {
          console.warn("[LibrarySync] 📛 DETECTED RATE LIMIT in SyncPage:", {
            isRateLimited: error.isRateLimited,
            status: error.status,
            retryAfter: error.retryAfter,
          });

          const retryDelay = error.retryAfter ? error.retryAfter : 60;
          const retryTimestamp = Date.now() + retryDelay;

          console.debug(
            `[LibrarySync] Setting rate limited state with retry after: ${retryTimestamp} (in ${retryDelay / 1000}s)`,
          );

          setRateLimit(
            true,
            retryDelay,
            "AniList API rate limit reached. Waiting to retry...",
          );
        } else {
          setLibraryError(
            error.message ||
              "Failed to load your AniList library. Synchronization can still proceed without comparison data.",
          );
        }

        setUserLibrary({});
        setLibraryLoading(false);
      }
    });
}

/**
 * Helper to refresh AniList library (simplified version without detailed logging)
 */
export function refreshUserLibrary(params: LibraryRefreshParams): void {
  const {
    token,
    setLibraryLoading,
    setLibraryError,
    setRetryCount,
    setRateLimit,
    setUserLibrary,
  } = params;

  setLibraryLoading(true);
  setLibraryError(null);
  setRetryCount(0);
  setRateLimit(false, undefined, undefined);

  const controller = new AbortController();

  getUserMangaList(token, controller.signal)
    .then((library) => {
      setUserLibrary(library);
      setLibraryLoading(false);
    })
    .catch((error) => {
      if (error.name !== "AbortError") {
        if (error.isRateLimited || error.status === 429) {
          const retryDelay = error.retryAfter ? error.retryAfter : 60;
          setRateLimit(
            true,
            retryDelay,
            "AniList API rate limit reached. Waiting to retry...",
          );
        } else {
          setLibraryError(
            error.message ||
              "Failed to load your AniList library. Synchronization can still proceed without comparison data.",
          );
        }
        setUserLibrary({});
        setLibraryLoading(false);
      }
    });
}
