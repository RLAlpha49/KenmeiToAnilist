/**
 * @packageDocumentation
 * @module api-context
 * @description Exposes the Electron API context bridge (AniList API, shell actions) to the renderer process.
 */

import { contextBridge, ipcRenderer } from "electron";
import type { MangaSource } from "../../../api/manga-sources/types";
import type { ShellOperationResult } from "../types";

/**
 * Cache control options for AniList requests.
 * @property bypassCache - Bypass the response cache for this request.
 * @source
 */
export interface CacheControl {
  bypassCache?: boolean;
}

/**
 * Typed request payload for AniList GraphQL requests.
 * @property query - The GraphQL query or mutation string.
 * @property variables - Optional variables for the query.
 * @property token - Optional authorization token for authenticated requests.
 * @property cacheControl - Optional cache control options.
 * @property noRetry - Optional flag to disable retry logic for this request.
 * @source
 */
export interface AniListRequest {
  query: string;
  variables?: Record<string, unknown>;
  token?: string;
  cacheControl?: CacheControl;
  noRetry?: boolean;
}

/**
 * Envelope returned by main process for AniList requests.
 * Keeps the renderer/client API consistent and decouples GraphQL format.
 */
export interface AniListResponseEnvelope {
  success: boolean;
  data?: Record<string, unknown>;
  error?: {
    message: string;
    status?: number;
    errors?: Array<{ message: string }>;
  };
}

/**
 * Exposes the Electron API context bridge to the renderer process.
 * Provides secure IPC interfaces for AniList GraphQL requests, manga source searches, and shell operations.
 *
 * @throws {Error} If Electron modules (contextBridge or ipcRenderer) are unavailable.
 * @source
 */
export function exposeApiContext() {
  try {
    if (!contextBridge || !ipcRenderer) {
      throw new Error(
        "Failed to load electron modules: contextBridge or ipcRenderer is undefined",
      );
    }

    contextBridge.exposeInMainWorld("electronAPI", {
      anilist: {
        request: (payload: AniListRequest): Promise<AniListResponseEnvelope> =>
          ipcRenderer.invoke("anilist:request", payload),
        clearCache: (searchQuery?: string) =>
          ipcRenderer.invoke("anilist:clearCache", searchQuery),
        getRateLimitStatus: () =>
          ipcRenderer.invoke("anilist:getRateLimitStatus"),
        onSearchCacheCleared: (
          handler: (payload: { searchQuery?: string }) => void,
        ) => {
          const listener = (
            _event: Electron.IpcRendererEvent,
            payload: { searchQuery?: string },
          ) => handler(payload);
          ipcRenderer.on("anilist:search-cache-cleared", listener);
          return () =>
            ipcRenderer.removeListener(
              "anilist:search-cache-cleared",
              listener,
            );
        },
      },
      mangaSource: {
        search: (source: MangaSource, query: string, limit?: number) =>
          ipcRenderer.invoke("mangaSource:search", source, query, limit),
        getMangaDetail: (source: MangaSource, slug: string) =>
          ipcRenderer.invoke("mangaSource:getMangaDetail", source, slug),
      },
      shell: {
        openExternal: (url: string): Promise<ShellOperationResult> =>
          ipcRenderer.invoke("shell:openExternal", url),
      },
    });

    console.log("[APIContext] ✅ API context exposed in main world");
  } catch (error) {
    console.error("[APIContext] ❌ Error exposing API context:", error);
  }
}
