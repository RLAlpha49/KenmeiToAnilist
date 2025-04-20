import { APICredentials } from "@/types/auth";
import { contextBridge, ipcRenderer } from "electron";

export function exposeAuthContext() {
  // For debugging
  console.log("Setting up auth context bridge...");

  contextBridge.exposeInMainWorld("electronAuth", {
    openOAuthWindow: (oauthUrl: string, redirectUri: string) => {
      console.log("Renderer requesting to open OAuth window", {
        oauthUrl,
        redirectUri,
      });
      return ipcRenderer.invoke("auth:openOAuthWindow", oauthUrl, redirectUri);
    },
    storeCredentials: (credentials: APICredentials) => {
      console.log("Renderer requesting to store credentials", {
        source: credentials.source,
      });
      return ipcRenderer.invoke("auth:storeCredentials", credentials);
    },
    getCredentials: (source: "default" | "custom") => {
      console.log("Renderer requesting credentials for", source);
      return ipcRenderer.invoke("auth:getCredentials", source);
    },
    cancelAuth: () => {
      console.log("Renderer requesting to cancel auth");
      return ipcRenderer.invoke("auth:cancel");
    },
    exchangeToken: (params: {
      clientId: string;
      clientSecret: string;
      redirectUri: string;
      code: string;
    }) => {
      console.log("Renderer requesting token exchange");
      return ipcRenderer.invoke("auth:exchangeToken", params);
    },
    onCodeReceived: (callback: (data: { code: string }) => void) => {
      console.log("Renderer setting up code received listener");

      // Clear any existing listeners to prevent duplicates
      ipcRenderer.removeAllListeners("auth:codeReceived");

      // Add the event listener for the auth code
      ipcRenderer.on("auth:codeReceived", (_, data) => {
        console.log("Received auth code from main process", {
          codeLength: data?.code?.length || 0,
        });
        callback(data);
      });

      // Return a function to remove the event listener
      return () => {
        console.log("Removing code received listener");
        ipcRenderer.removeAllListeners("auth:codeReceived");
      };
    },
    onCancelled: (callback: () => void) => {
      console.log("Renderer setting up cancelled listener");

      // Clear any existing listeners to prevent duplicates
      ipcRenderer.removeAllListeners("auth:cancelled");

      // Add the event listener for auth cancellation
      ipcRenderer.on("auth:cancelled", () => {
        console.log("Auth was cancelled");
        callback();
      });

      // Return a function to remove the event listener
      return () => {
        console.log("Removing cancelled listener");
        ipcRenderer.removeAllListeners("auth:cancelled");
      };
    },
    onStatus: (callback: (message: string) => void) => {
      console.log("Renderer setting up status listener");

      // Clear any existing listeners to prevent duplicates
      ipcRenderer.removeAllListeners("auth:status");

      // Add the event listener for status updates
      ipcRenderer.on("auth:status", (_, message) => {
        console.log("Status update:", message);
        callback(message);
      });

      // Return a function to remove the event listener
      return () => {
        console.log("Removing status listener");
        ipcRenderer.removeAllListeners("auth:status");
      };
    },
  });

  console.log("Auth context bridge setup complete");
}
