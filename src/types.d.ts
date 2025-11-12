/**
 * @packageDocumentation
 * @module types
 * @description Global and ambient type declarations for the KenmeiToAnilist Electron app, including Vite, Electron, and window augmentation.
 * @source
 */

/// <reference types="vite/client" />

/** Development server URL injected by Forge's Vite plugin. Used to load dev bundles in development mode. @source */
declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string | undefined;

/** Vite bundle name injected by Forge's Vite plugin. Used to locate bundled assets. @source */
declare const MAIN_WINDOW_VITE_NAME: string;

/**
 * Vite worker import declarations.
 * Allows importing web workers with the ?worker query parameter pattern.
 * @source
 */
declare module "*.ts?worker" {
  const workerConstructor: {
    new (): Worker;
  };
  export default workerConstructor;
}

import type { APICredentials, TokenExchangeResponse } from "./types/auth";
import type { TokenExchangeParams } from "./types/api";
import type { AniListRequest } from "./helpers/ipc/api/api-context";
import type { MangaSource } from "./api/manga-sources/types";
import type { ElectronBackupApi } from "./helpers/ipc/backup/backup-context";
import type { ElectronIpcDebugBridge } from "./helpers/ipc/debug/debug-context";

/**
 * Theme mode control interface exposed to the renderer process.
 * Provides methods to query and control the application's theme mode.
 * @source
 */
interface ThemeModeContext {
  /**
   * Toggles between light and dark theme modes.
   * @returns Promise resolving to the new theme mode preference.
   * @source
   */
  toggle: () => Promise<boolean>;

  /**
   * Sets the theme to dark mode.
   * @source
   */
  dark: () => Promise<void>;

  /**
   * Sets the theme to light mode.
   * @source
   */
  light: () => Promise<void>;

  /**
   * Sets the theme to system preference (respects OS theme).
   * @returns Promise resolving to whether system preference was applied.
   * @source
   */
  system: () => Promise<boolean>;

  /**
   * Retrieves the current theme mode setting.
   * @returns Promise resolving to the current mode: "dark", "light", or "system".
   * @source
   */
  current: () => Promise<"dark" | "light" | "system">;
}

/**
 * Window control interface exposed to the renderer process.
 * Provides methods to control the application window (minimize, maximize, close).
 * @source
 */
interface ElectronWindow {
  /**
   * Minimizes the application window.
   * @source
   */
  minimize: () => Promise<void>;

  /**
   * Maximizes the application window.
   * @source
   */
  maximize: () => Promise<void>;

  /**
   * Closes the application window.
   * @source
   */
  close: () => Promise<void>;
}

/**
 * Clipboard operations interface exposed to the renderer process.
 * Provides methods to write text to the system clipboard.
 * @source
 */
interface ElectronClipboard {
  /**
   * Writes text to the system clipboard.
   * @param text - Text content to write to clipboard.
   * @returns Promise that resolves when text is written.
   * @source
   */
  writeText: (text: string) => Promise<void>;
}

/**
 * Backup schedule management interface for the renderer process.
 * Type-safe reference to electronBackup context exposed by preload script.
 * @see backup-context.ts for implementation
 * @source
 */
type ElectronBackup = ElectronBackupApi;

/**
 * Auto-updater interface for application updates.
 * Provides methods for checking, downloading, and installing updates.
 * @source
 */
interface ElectronUpdater {
  /**
   * Checks for available updates from the update server.
   * @param options Optional configuration for the check
   * @param options.allowPrerelease Whether to include prerelease versions (default: false)
   * @returns Promise with update availability and version information
   */
  checkForUpdates: (options?: { allowPrerelease?: boolean }) => Promise<{
    updateAvailable: boolean;
    version?: string;
    releaseNotes?: string;
    releaseDate?: string;
  }>;

  /**
   * Initiates download of an available update.
   * @returns Promise that resolves when download starts
   */
  downloadUpdate: () => Promise<void>;

  /**
   * Quits the application and installs the downloaded update.
   * @returns Promise that resolves before app quits
   */
  installUpdate: () => Promise<void>;

  /**
   * Subscribes to update available events.
   * @param callback Function to call when an update is available
   * @returns Function to unsubscribe from the event
   */
  onUpdateAvailable: (
    callback: (info: {
      version: string;
      releaseNotes: string;
      releaseDate: string;
    }) => void,
  ) => () => void;

  /**
   * Subscribes to download progress events.
   * @param callback Function to call with download progress updates
   * @returns Function to unsubscribe from the event
   */
  onDownloadProgress: (
    callback: (progress: {
      percent: number;
      bytesPerSecond: number;
      transferred: number;
      total: number;
    }) => void,
  ) => () => void;

  /**
   * Subscribes to update downloaded events.
   * @param callback Function to call when download is complete
   * @returns Function to unsubscribe from the event
   */
  onUpdateDownloaded: (
    callback: (info: { version: string }) => void,
  ) => () => void;

  /**
   * Subscribes to update error events.
   * @param callback Function to call when an update error occurs
   * @returns Function to unsubscribe from the event
   */
  onUpdateError: (
    callback: (error: {
      message: string;
      stack?: string;
      name?: string;
    }) => void,
  ) => () => void;
}

/**
 * Manga matching process state synchronized across the application.
 * Tracks progress, timing estimates, and pause state during manga matching operations.
 * @source
 */
interface MatchingProcessState {
  /** Whether the matching process is currently running. @source */
  isRunning: boolean;

  /** Progress tracking information. @source */
  progress: {
    /** Current index in the matching process. @source */
    current: number;
    /** Total number of manga to process. @source */
    total: number;
    /** Title of the manga currently being matched. @source */
    currentTitle: string;
  };

  /** User-facing status message for the matching progress. @source */
  statusMessage: string;

  /** Detailed message providing additional context or error information. @source */
  detailMessage: string | null;

  /** Time estimation data for remaining work. @source */
  timeEstimate?: {
    /** Timestamp when matching started (milliseconds). @source */
    startTime: number;
    /** Average time spent per manga in milliseconds. @source */
    averageTimePerManga: number;
    /** Estimated remaining time in seconds. @source */
    estimatedRemainingSeconds: number;
  };

  /** Whether the user manually paused the matching process. @source */
  isManuallyPaused?: boolean;

  /** Whether the pause state is currently transitioning. @source */
  isPauseTransitioning?: boolean;

  /** Whether the matching process was interrupted by a rate limit. @source */
  wasRateLimitPaused?: boolean;

  /** Timestamp of the last state update (milliseconds). @source */
  lastUpdated: number;
}

declare global {
  /**
   * Vite import metadata with environment variables.
   * @source
   */
  interface ImportMeta {
    /**
     * Environment variables injected by Vite at build time.
     * @source
     */
    readonly env: {
      /** Generic environment variable. @source */
      [key: string]: string | boolean | undefined;

      /** AniList API client ID for OAuth. @source */
      readonly VITE_ANILIST_CLIENT_ID: string;

      /** Application version from package.json. @source */
      readonly VITE_APP_VERSION?: string;

      /** Sentry DSN for error tracking (optional). @source */
      readonly VITE_SENTRY_DSN?: string;

      /** Encryption key for sensitive data storage (optional). @source */
      readonly VITE_ANILIST_ENCRYPTION_KEY?: string;

      /** Build mode: "development" or "production". @source */
      readonly MODE: string;

      /** True when running in development mode. @source */
      readonly DEV: boolean;

      /** True when running in production mode. @source */
      readonly PROD: boolean;
    };
  }

  /**
   * Global window interface augmented with KenmeiToAnilist-specific APIs.
   * Contains exposed IPC context bridges from the main process.
   * @source
   */
  interface Window {
    /** Theme mode control API. @source */
    themeMode: ThemeModeContext;

    /** Window control API. @source */
    electronWindow: ElectronWindow;

    /** Clipboard API. @source */
    electronClipboard: ElectronClipboard;

    /**
     * Main Electron API container for various IPC operations.
     * Provides access to window, theme, AniList, manga sources, and storage.
     * @source
     */
    electronAPI: {
      /**
       * Window management methods.
       * @source
       */
      window: {
        /** Minimizes the main window. @source */
        minimize: () => Promise<void>;
        /** Maximizes the main window. @source */
        maximize: () => Promise<void>;
        /** Closes the main window. @source */
        close: () => Promise<void>;
      };

      /**
       * Theme management methods.
       * @source
       */
      theme: {
        /**
         * Sets the application theme.
         * @param theme - Theme name or mode.
         * @source
         */
        setTheme: (theme: string) => Promise<void>;
        /**
         * Retrieves the current theme setting.
         * @returns Current theme name or mode.
         * @source
         */
        getTheme: () => Promise<string>;
      };

      /**
       * AniList API methods for GraphQL requests and authentication.
       * @source
       */
      anilist: {
        /**
         * Sends a GraphQL request to the AniList API.
         * @param payload - GraphQL request configuration.
         * @returns Response with data or error information.
         * @source
         */
        request: (payload: AniListRequest) => Promise<{
          success: boolean;
          data?: Record<string, unknown>;
          error?: {
            message: string;
            status?: number;
            errors?: Array<{ message: string }>;
          };
        }>;

        /**
         * Exchanges OAuth authorization code for access token.
         * @param params - Token exchange parameters.
         * @returns Token response with access token and expiration.
         * @source
         */
        exchangeToken: (params: TokenExchangeParams) => Promise<{
          success: boolean;
          token?: {
            access_token: string;
            token_type: string;
            expires_in: number;
          };
          error?: string;
        }>;

        /**
         * Clears the search result cache.
         * @param searchQuery - Optional specific query to clear (clears all if omitted).
         * @source
         */
        clearCache: (searchQuery?: string) => Promise<{ success: boolean }>;

        /**
         * Retrieves current API rate limit status.
         * @returns Rate limit information and time until reset.
         * @source
         */
        getRateLimitStatus: () => Promise<{
          isRateLimited: boolean;
          retryAfter: number | null;
          timeRemaining: number;
        }>;
      };

      /**
       * Manga source search and detail retrieval methods.
       * @source
       */
      mangaSource: {
        /**
         * Searches for manga across specified source.
         * @param source - Target manga source (MangaDex, ComicK, etc.).
         * @param query - Search query string.
         * @param limit - Optional result limit.
         * @source
         */
        search: (
          source: MangaSource,
          query: string,
          limit?: number,
        ) => Promise<unknown>;

        /**
         * Retrieves detailed information for a specific manga.
         * @param source - Target manga source.
         * @param slug - Manga identifier/slug on the source.
         * @source
         */
        getMangaDetail: (source: MangaSource, slug: string) => Promise<unknown>;
      };

      /**
       * ComicK-specific manga API methods.
       * @source
       */
      comick: {
        /**
         * Searches ComicK for manga.
         * @param query - Search query string.
         * @param limit - Optional result limit.
         * @source
         */
        search: (query: string, limit?: number) => Promise<unknown>;

        /**
         * Retrieves ComicK manga details by HID.
         * @param hid - ComicK manga HID (hierarchical ID).
         * @source
         */
        getMangaDetail: (hid: string) => Promise<unknown>;
      };

      /**
       * Shell operations for external interactions.
       * @source
       */
      shell: {
        /**
         * Opens an external URL in the default browser.
         * @param url - URL to open.
         * @source
         */
        openExternal: (url: string) => Promise<void>;
      };

      /**
       * Persistent key-value storage API.
       * Stores configuration and data across sessions.
       * @source
       */
      electronStore: {
        /**
         * Retrieves a value from persistent storage.
         * @param key - Storage key.
         * @returns Stored value as string.
         * @source
         */
        getItem: (key: string) => Promise<string>;

        /**
         * Stores a value in persistent storage.
         * @param key - Storage key.
         * @param value - Value to store.
         * @source
         */
        setItem: (key: string, value: string) => Promise<void>;

        /**
         * Removes a value from persistent storage.
         * @param key - Storage key.
         * @source
         */
        removeItem: (key: string) => Promise<void>;

        /**
         * Clears all persistent storage.
         * @source
         */
        clear: () => Promise<void>;
      };
    };

    /**
     * Authentication context API for OAuth flows.
     * Manages token exchange, credential storage, and auth events.
     * @source
     */
    electronAuth: {
      /**
       * Opens OAuth authorization window.
       * @param oauthUrl - Authorization endpoint URL.
       * @param redirectUri - Callback redirect URI.
       * @returns Result with success status or error message.
       * @source
       */
      openOAuthWindow: (
        oauthUrl: string,
        redirectUri: string,
      ) => Promise<{ success: boolean; error?: string }>;

      /**
       * Stores API credentials persistently.
       * @param credentials - API credentials to store.
       * @returns Result with success status or error message.
       * @source
       */
      storeCredentials: (
        credentials: APICredentials,
      ) => Promise<{ success: boolean; error?: string }>;

      /**
       * Retrieves stored API credentials.
       * @param source - Credential source: "default" or "custom".
       * @returns Result with credentials or error message.
       * @source
       */
      getCredentials: (source: "default" | "custom") => Promise<{
        success: boolean;
        credentials?: APICredentials;
        error?: string;
      }>;

      /**
       * Subscribes to OAuth authorization code received events.
       * @param callback - Function called when code is received.
       * @returns Unsubscribe function.
       * @source
       */
      onCodeReceived: (
        callback: (data: { code: string }) => void,
      ) => () => void;

      /**
       * Subscribes to authentication status message events.
       * @param callback - Function called when status message is sent.
       * @returns Unsubscribe function.
       * @source
       */
      onStatus: (callback: (message: string) => void) => () => void;

      /**
       * Subscribes to authentication cancellation events.
       * @param callback - Function called when user cancels auth.
       * @returns Unsubscribe function.
       * @source
       */
      onCancelled: (callback: () => void) => () => void;

      /**
       * Cancels the ongoing authentication flow.
       * @returns Result with success status or error message.
       * @source
       */
      cancelAuth: () => Promise<{ success: boolean; error?: string }>;

      /**
       * Exchanges OAuth code for access token.
       * @param data - Client credentials and authorization code.
       * @returns Token exchange response.
       * @source
       */
      exchangeToken: (data: {
        clientId: string;
        clientSecret: string;
        redirectUri: string;
        code: string;
      }) => Promise<TokenExchangeResponse>;
    };

    /** Optional debug bridge for IPC inspection and testing. @source */
    electronDebug?: ElectronIpcDebugBridge;

    /** Application auto-updater API. @source */
    electronUpdater: ElectronUpdater;

    /** Backup and restore operations API. @source */
    electronBackup: ElectronBackup;

    /** Shared manga matching process state. @source */
    matchingProcessState?: MatchingProcessState;

    /** Active abort controller for canceling ongoing operations. @source */
    activeAbortController?: AbortController;
  }

  /**
   * Global namespace extensions for window properties.
   * These variables are made available globally via context bridge.
   * @source
   */
  namespace globalThis {
    /** Theme mode control (global access). @source */
    // eslint-disable-next-line no-var
    var themeMode: Window["themeMode"];

    /** Window control API (global access). @source */
    // eslint-disable-next-line no-var
    var electronWindow: Window["electronWindow"];

    /** Clipboard API (global access). @source */
    // eslint-disable-next-line no-var
    var electronClipboard: Window["electronClipboard"];

    /** Main Electron API container (global access). @source */
    // eslint-disable-next-line no-var
    var electronAPI: Window["electronAPI"];

    /** Authentication context API (global access). @source */
    // eslint-disable-next-line no-var
    var electronAuth: Window["electronAuth"];

    /** Optional debug bridge (global access). @source */
    // eslint-disable-next-line no-var
    var electronDebug: Window["electronDebug"] | undefined;

    /** Auto-updater API (global access). @source */
    // eslint-disable-next-line no-var
    var electronUpdater: Window["electronUpdater"];

    /** Backup API (global access). @source */
    // eslint-disable-next-line no-var
    var electronBackup: Window["electronBackup"];

    /** Shared manga matching process state (global access). @source */
    // eslint-disable-next-line no-var
    var matchingProcessState: MatchingProcessState | undefined;

    /** Active abort controller (global access). @source */
    // eslint-disable-next-line no-var
    var activeAbortController: Window["activeAbortController"] | undefined;

    /** Persistent storage API (global access). @source */
    // eslint-disable-next-line no-var
    var electronStore: Window["electronAPI"]["electronStore"];
  }
}
