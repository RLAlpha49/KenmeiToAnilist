/**
 * @packageDocumentation
 * @module api_context
 * @description Exposes the Electron API context bridge (AniList API, shell actions) to the renderer process.
 */

import { contextBridge, ipcRenderer } from "electron";

/**
 * Exposes the Electron API context bridge to the renderer process.
 *
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
        request: (
          query: string,
          variables?: Record<string, unknown>,
          token?: string,
        ) => ipcRenderer.invoke("anilist:request", query, variables, token),
        clearCache: (searchQuery?: string) =>
          ipcRenderer.invoke("anilist:clearCache", searchQuery),
        getRateLimitStatus: () =>
          ipcRenderer.invoke("anilist:getRateLimitStatus"),
      },
      mangaSource: {
        search: (source: string, query: string, limit?: number) =>
          ipcRenderer.invoke("mangaSource:search", source, query, limit),
        getMangaDetail: (source: string, slug: string) =>
          ipcRenderer.invoke("mangaSource:getMangaDetail", source, slug),
      },
      shell: {
        openExternal: (url: string) =>
          ipcRenderer.invoke("shell:openExternal", url),
      },
    });

    console.log("[APIContext] ✅ API context exposed in main world");
  } catch (error) {
    console.error("[APIContext] ❌ Error exposing API context:", error);
  }
}
