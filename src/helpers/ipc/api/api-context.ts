/**
 * @packageDocumentation
 * @module api_context
 * @description Exposes the Electron API context bridge (AniList API, shell actions) to the renderer process.
 */

import { contextBridge, ipcRenderer } from "electron";
import { TokenExchangeParams } from "@/types/api";

/**
 * Exposes the Electron API context bridge to the renderer process.
 *
 * @source
 */
export function exposeApiContext() {
  contextBridge.exposeInMainWorld("electronAPI", {
    anilist: {
      request: (
        query: string,
        variables?: Record<string, unknown>,
        token?: string,
      ) => ipcRenderer.invoke("anilist:request", query, variables, token),
      exchangeToken: (params: TokenExchangeParams) =>
        ipcRenderer.invoke("anilist:exchangeToken", params),
      clearCache: (searchQuery?: string) =>
        ipcRenderer.invoke("anilist:clearCache", searchQuery),
      getRateLimitStatus: () =>
        ipcRenderer.invoke("anilist:getRateLimitStatus"),
    },
    // Generic manga source API
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
}
