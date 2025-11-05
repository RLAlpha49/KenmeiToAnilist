/**
 * @packageDocumentation
 * @module auth_context
 * @description Exposes the Electron authentication context bridge (OAuth, credentials, token exchange, event listeners) to the renderer process.
 */

import { APICredentials } from "@/types/auth";
import { contextBridge, ipcRenderer } from "electron";

/**
 * Exposes the Electron authentication context bridge to the renderer process.
 * Provides methods for OAuth flow, credentials management, and token exchange.
 * @throws {Error} If contextBridge or ipcRenderer modules are unavailable.
 * @source
 */
export function exposeAuthContext() {
  try {
    if (!contextBridge || !ipcRenderer) {
      throw new Error(
        "Failed to load electron modules: contextBridge or ipcRenderer is undefined",
      );
    }

    console.debug("[AuthContext] Setting up auth context bridge...");

    contextBridge.exposeInMainWorld("electronAuth", {
      /**
       * Opens the OAuth authorization window and handles the redirect callback.
       * @param oauthUrl - The OAuth authorization URL from AniList.
       * @param redirectUri - The callback redirect URI.
       * @returns Promise resolving to success status.
       */
      openOAuthWindow: (oauthUrl: string, redirectUri: string) => {
        console.debug(
          "[AuthContext] Renderer requesting to open OAuth window",
          {
            oauthUrl,
            redirectUri,
          },
        );
        return ipcRenderer.invoke(
          "auth:openOAuthWindow",
          oauthUrl,
          redirectUri,
        );
      },
      /**
       * Stores API credentials in the main process.
       * @param credentials - The credentials object with source, clientId, clientSecret, and redirectUri.
       * @returns Promise resolving to success status.
       */
      storeCredentials: (credentials: APICredentials) => {
        console.debug(
          "[AuthContext] Renderer requesting to store credentials",
          {
            source: credentials.source,
          },
        );
        return ipcRenderer.invoke("auth:storeCredentials", credentials);
      },
      /**
       * Retrieves stored credentials for a given source.
       * @param source - The credential source ("default" or "custom").
       * @returns Promise resolving to credentials object.
       */
      getCredentials: (source: "default" | "custom") => {
        console.debug(
          "[AuthContext] Renderer requesting credentials for",
          source,
        );
        return ipcRenderer.invoke("auth:getCredentials", source);
      },
      /**
       * Cancels the ongoing authentication process.
       * @returns Promise resolving to success status.
       */
      cancelAuth: () => {
        console.debug("[AuthContext] Renderer requesting to cancel auth");
        return ipcRenderer.invoke("auth:cancel");
      },
      /**
       * Exchanges an authorization code for an access token.
       * @param params - Token exchange parameters (clientId, clientSecret, redirectUri, code).
       * @returns Promise resolving to token response.
       */
      exchangeToken: (params: {
        clientId: string;
        clientSecret: string;
        redirectUri: string;
        code: string;
      }) => {
        console.debug("[AuthContext] Renderer requesting token exchange");
        return ipcRenderer.invoke("auth:exchangeToken", params);
      },
      /**
       * Registers a listener for when the authorization code is received.
       * @param callback - Function called with the authorization code.
       * @returns Function to unregister the listener.
       */
      onCodeReceived: (callback: (data: { code: string }) => void) => {
        // Prevent duplicate listeners by removing existing ones first
        ipcRenderer.removeAllListeners("auth:codeReceived");

        ipcRenderer.on("auth:codeReceived", (_, data) => {
          console.debug("[AuthContext] Received auth code from main process", {
            codeLength: data?.code?.length || 0,
          });
          callback(data);
        });

        // Return cleanup function for unregistering the listener
        return () => {
          ipcRenderer.removeAllListeners("auth:codeReceived");
        };
      },
      /**
       * Registers a listener for authentication cancellation events.
       * @param callback - Function called when auth is cancelled.
       * @returns Function to unregister the listener.
       */
      onCancelled: (callback: () => void) => {
        // Prevent duplicate listeners by removing existing ones first
        ipcRenderer.removeAllListeners("auth:cancelled");

        ipcRenderer.on("auth:cancelled", () => {
          console.debug("[AuthContext] Auth was cancelled");
          callback();
        });

        // Return cleanup function for unregistering the listener
        return () => {
          ipcRenderer.removeAllListeners("auth:cancelled");
        };
      },
      /**
       * Registers a listener for authentication status updates.
       * @param callback - Function called with status message.
       * @returns Function to unregister the listener.
       */
      onStatus: (callback: (message: string) => void) => {
        // Prevent duplicate listeners by removing existing ones first
        ipcRenderer.removeAllListeners("auth:status");

        ipcRenderer.on("auth:status", (_, message) => {
          console.debug("[AuthContext] Status update:", message);
          callback(message);
        });

        // Return cleanup function for unregistering the listener
        return () => {
          ipcRenderer.removeAllListeners("auth:status");
        };
      },
    });

    console.info("[AuthContext] ✅ Auth context bridge setup complete");
  } catch (error) {
    console.error("[AuthContext] ❌ Error exposing auth context:", error);
  }
}
