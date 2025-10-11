/**
 * @packageDocumentation
 * @module auth_context
 * @description Exposes the Electron authentication context bridge (OAuth, credentials, token exchange, event listeners) to the renderer process.
 */

import { APICredentials } from "@/types/auth";
import { contextBridge, ipcRenderer } from "electron";

/**
 * Exposes the Electron authentication context bridge to the renderer process.
 *
 * @source
 */
export function exposeAuthContext() {
  // For debugging
  console.debug("[AuthContext] Setting up auth context bridge...");

  contextBridge.exposeInMainWorld("electronAuth", {
    openOAuthWindow: (oauthUrl: string, redirectUri: string) => {
      console.debug("[AuthContext] Renderer requesting to open OAuth window", {
        oauthUrl,
        redirectUri,
      });
      return ipcRenderer.invoke("auth:openOAuthWindow", oauthUrl, redirectUri);
    },
    storeCredentials: (credentials: APICredentials) => {
      console.debug("[AuthContext] Renderer requesting to store credentials", {
        source: credentials.source,
      });
      return ipcRenderer.invoke("auth:storeCredentials", credentials);
    },
    getCredentials: (source: "default" | "custom") => {
      console.debug(
        "[AuthContext] Renderer requesting credentials for",
        source,
      );
      return ipcRenderer.invoke("auth:getCredentials", source);
    },
    cancelAuth: () => {
      console.debug("[AuthContext] Renderer requesting to cancel auth");
      return ipcRenderer.invoke("auth:cancel");
    },
    exchangeToken: (params: {
      clientId: string;
      clientSecret: string;
      redirectUri: string;
      code: string;
    }) => {
      console.debug("[AuthContext] Renderer requesting token exchange");
      return ipcRenderer.invoke("auth:exchangeToken", params);
    },
    onCodeReceived: (callback: (data: { code: string }) => void) => {
      // Clear any existing listeners to prevent duplicates
      ipcRenderer.removeAllListeners("auth:codeReceived");

      // Add the event listener for the auth code
      ipcRenderer.on("auth:codeReceived", (_, data) => {
        console.debug("[AuthContext] Received auth code from main process", {
          codeLength: data?.code?.length || 0,
        });
        callback(data);
      });

      // Return a function to remove the event listener
      return () => {
        ipcRenderer.removeAllListeners("auth:codeReceived");
      };
    },
    onCancelled: (callback: () => void) => {
      // Clear any existing listeners to prevent duplicates
      ipcRenderer.removeAllListeners("auth:cancelled");

      // Add the event listener for auth cancellation
      ipcRenderer.on("auth:cancelled", () => {
        console.debug("[AuthContext] Auth was cancelled");
        callback();
      });

      // Return a function to remove the event listener
      return () => {
        ipcRenderer.removeAllListeners("auth:cancelled");
      };
    },
    onStatus: (callback: (message: string) => void) => {
      // Clear any existing listeners to prevent duplicates
      ipcRenderer.removeAllListeners("auth:status");

      // Add the event listener for status updates
      ipcRenderer.on("auth:status", (_, message) => {
        console.debug("[AuthContext] Status update:", message);
        callback(message);
      });

      // Return a function to remove the event listener
      return () => {
        ipcRenderer.removeAllListeners("auth:status");
      };
    },
  });

  console.info("[AuthContext] Auth context bridge setup complete");
}
