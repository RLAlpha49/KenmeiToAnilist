/**
 * @packageDocumentation
 * @module auth_listeners
 * @description Registers IPC event listeners for authentication-related actions (OAuth, credentials, token exchange) in the Electron main process.
 */

import { BrowserWindow, ipcMain, shell } from "electron";
import { URL } from "node:url";
import * as http from "node:http";
import fetch from "node-fetch";
import { withGroupAsync, startGroup, endGroup } from "../../../utils/logging";
import type { TokenExchangeResponse } from "../../../types/auth";

let authCancelled = false;
let loadTimeout: NodeJS.Timeout | null = null;
let authServer: http.Server | null = null;
let authResolve: ((code: string) => void) | null = null;
let authReject: ((error: Error) => void) | null = null;

// Use a more reliable default port that doesn't require admin privileges
const DEFAULT_PORT = 8765;

/**
 * Represents authentication credentials for AniList API.
 *
 * @property source - The credential source ("default" or "custom").
 * @property clientId - The client ID string.
 * @property clientSecret - The client secret string.
 * @property redirectUri - The redirect URI string.
 * @source
 */
interface AuthCredentials {
  source: "default" | "custom";
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

// Get client ID and secret from environment or provide defaults
const DEFAULT_CLIENT_ID = process.env.VITE_ANILIST_CLIENT_ID || "";
const DEFAULT_CLIENT_SECRET = process.env.VITE_ANILIST_CLIENT_SECRET || "";

// Store the credentials for each source
const storedCredentials: Record<string, AuthCredentials | null> = {
  default: {
    source: "default",
    clientId: DEFAULT_CLIENT_ID,
    clientSecret: DEFAULT_CLIENT_SECRET,
    redirectUri: `http://localhost:${DEFAULT_PORT}/callback`,
  },
  custom: null,
};

/**
 * Validate token exchange parameters.
 * @internal
 */
function validateTokenExchangeParams(params: {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  code: string;
}): { isValid: boolean; error?: string } {
  const { clientId, clientSecret, redirectUri, code } = params;

  // Validation guard: ensure required fields are present and non-empty
  const missing: string[] = [];
  if (!clientId) missing.push("clientId");
  if (!clientSecret) missing.push("clientSecret");
  if (!redirectUri) missing.push("redirectUri");
  if (!code) missing.push("code");
  if (missing.length) {
    console.error(
      "[AuthIPC] auth:exchangeToken missing required fields",
      missing,
    );
    return {
      isValid: false,
      error: `Missing required auth fields: ${missing.join(", ")}`,
    };
  }

  // Basic sanity checks
  if (clientId.length < 4 || clientSecret.length < 8) {
    console.warn("[AuthIPC] auth:exchangeToken suspicious credential lengths", {
      clientIdLen: clientId.length,
      clientSecretLen: clientSecret.length,
    });
  }

  // Redirect URI strictness: AniList requires exact match including protocol and path
  try {
    const parsed = new URL(redirectUri);
    if (!/^https?:$/.test(parsed.protocol)) {
      return {
        isValid: false,
        error: `Invalid redirect URI protocol: ${parsed.protocol}`,
      };
    }
  } catch {
    return {
      isValid: false,
      error: `Invalid redirect URI format: ${redirectUri}`,
    };
  }

  return { isValid: true };
}

/**
 * Perform a single token exchange HTTP request.
 * @internal
 */
async function performTokenExchange(params: {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  code: string;
}): Promise<
  | { success: true; token: TokenExchangeResponse["token"] }
  | { success: false; error: string }
> {
  return withGroupAsync(`[AuthIPC] Exchange Attempt`, async () => {
    const { clientId, clientSecret, redirectUri, code } = params;

    const response = await fetch("https://anilist.co/api/v2/oauth/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        grant_type: "authorization_code",
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        code,
      }),
    });

    console.info("[AuthIPC] Token exchange response status:", response.status);

    if (!response.ok) {
      const errorText = await response.text();
      const redactedError = errorText.replaceAll(
        /client_secret[^&\s]*/gi,
        "client_secret=[REDACTED]",
      );
      console.error(
        "[AuthIPC] Token exchange error (redacted):",
        redactedError,
      );
      if (errorText.includes("invalid_client")) {
        console.error(
          "[AuthIPC] Detected invalid_client from AniList. Diagnostics:",
          {
            clientIdLen: clientId.length,
            clientSecretLen: clientSecret.length,
            redirectUri,
            codeLen: code.length,
          },
        );
      }
      return {
        success: false,
        error: `API error: ${response.status} ${redactedError}`,
      };
    }

    const data = (await response.json()) as TokenExchangeResponse["token"];

    if (!data?.access_token) {
      return {
        success: false,
        error: "Token exchange returned invalid response structure",
      };
    }

    console.info("[AuthIPC] Token exchange successful:", {
      token_type: data.token_type,
      expires_in: data.expires_in,
      token_length: data.access_token?.length || 0,
    });

    return { success: true, token: data };
  });
}

/**
 * Check if an error is a network error that should be retried.
 * @internal
 */
function isNetworkError(error: unknown): boolean {
  const errorMessage = error instanceof Error ? error.message : String(error);
  return (
    errorMessage.includes("ENOTFOUND") ||
    errorMessage.includes("ETIMEDOUT") ||
    errorMessage.includes("ECONNRESET") ||
    errorMessage.includes("socket hang up") ||
    errorMessage.includes("network error")
  );
}

/**
 * Format the final error message for failed token exchange.
 * @internal
 */
function formatTokenExchangeError(lastError: unknown): string {
  let errorMessage: string;
  if (lastError instanceof Error) {
    errorMessage = lastError.message;
  } else if (
    lastError &&
    typeof lastError === "object" &&
    "toString" in lastError &&
    typeof (lastError as { toString: () => string }).toString === "function"
  ) {
    errorMessage = (lastError as { toString: () => string }).toString();
  } else if (lastError) {
    errorMessage = String(lastError);
  } else {
    errorMessage = "Unknown error";
  }
  return `Failed to exchange code for token: ${errorMessage}`;
}

/**
 * Add event listeners for authentication-related IPC events
 * @param mainWindow The main application window
 */
export function addAuthEventListeners(mainWindow: BrowserWindow) {
  // Open the OAuth window when requested by the renderer
  ipcMain.handle(
    "auth:openOAuthWindow",
    async (_, oauthUrl: string, redirectUri: string) => {
      return withGroupAsync(
        `[AuthIPC] OAuth Flow: ${redirectUri}`,
        async () => {
          try {
            // Reset cancellation flag
            authCancelled = false;

            // Extract redirect URI parts
            const redirectUrl = new URL(redirectUri);
            // Use a non-privileged port by default
            const port = redirectUrl.port || DEFAULT_PORT.toString();

            // Update the redirectUri with our port if none was specified
            if (!redirectUrl.port) {
              redirectUrl.port = port;
              const updatedRedirectUri = redirectUrl.toString();

              // If the redirect URI in the oauth URL doesn't match the updated one,
              // we need to update the oauth URL too
              if (redirectUri !== updatedRedirectUri) {
                const oauthUrlObj = new URL(oauthUrl);
                const redirectParam =
                  oauthUrlObj.searchParams.get("redirect_uri");
                if (redirectParam) {
                  oauthUrlObj.searchParams.set(
                    "redirect_uri",
                    updatedRedirectUri,
                  );
                  oauthUrl = oauthUrlObj.toString();
                }
              }

              // Update the redirect URI to include the port
              redirectUri = updatedRedirectUri;
            }

            // Start the temporary HTTP server first
            try {
              await startAuthServer(port, redirectUrl.pathname, mainWindow);

              // Send status update
              mainWindow.webContents.send(
                "auth:status",
                `Server started on port ${port}, opening browser for authentication...`,
              );

              // IMPORTANT: Set up the auth code promise AFTER server is started
              const authCodePromise = new Promise<string>((resolve, reject) => {
                authResolve = resolve;
                authReject = reject;

                // Set timeout for the entire auth process and store handle for cleanup
                loadTimeout = createAuthTimeout();
              });

              // Open the authorization URL in the default browser
              await shell.openExternal(oauthUrl);

              // Notify the user about the browser
              mainWindow.webContents.send(
                "auth:status",
                "Browser opened for authentication. Please complete the process in your browser.",
              );

              // Set up the background handling of the auth code
              // This needs to be done after we return the response
              // to avoid the "reply was never sent" error
              setTimeout(() => {
                handleAuthCodePromise(authCodePromise, mainWindow, redirectUri);
              }, 100);

              // IMPORTANT: Return success immediately so the IPC call resolves
              // The actual code handling will happen via the auth:codeReceived event
              return { success: true };
            } catch (serverError) {
              const errorMessage =
                serverError instanceof Error
                  ? serverError.message
                  : "Failed to start authentication server";
              console.error("[AuthIPC] Server error:", serverError);
              mainWindow.webContents.send(
                "auth:status",
                `Authentication error: ${errorMessage}`,
              );
              return { success: false, error: errorMessage };
            }
          } catch (error: unknown) {
            const errorMessage =
              error instanceof Error ? error.message : "Unknown error";
            console.error("[AuthIPC] Failed to open OAuth window:", error);
            cleanupAuthServer();
            return { success: false, error: errorMessage };
          }
        },
      );
    },
  );

  // Handle storing and retrieving API credentials
  ipcMain.handle("auth:storeCredentials", async (_, credentials) => {
    try {
      console.debug(
        "[AuthIPC] Storing credentials for source:",
        credentials?.source,
      );
      // Store the credentials in memory
      if (credentials?.source) {
        storedCredentials[credentials.source] = credentials;
      }
      return { success: true };
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      console.error("[AuthIPC] Failed to store credentials:", error);
      return { success: false, error: errorMessage };
    }
  });

  // Get stored credentials
  ipcMain.handle("auth:getCredentials", async (_, source) => {
    try {
      console.debug("[AuthIPC] Retrieving credentials for source:", source);
      const credentials = storedCredentials[source];

      if (!credentials) {
        return {
          success: false,
          error: `No credentials found for source: ${source}`,
        };
      }

      return {
        success: true,
        credentials,
      };
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      console.error("[AuthIPC] Failed to retrieve credentials:", error);
      return { success: false, error: errorMessage };
    }
  });

  // Add a way to manually cancel auth
  ipcMain.handle("auth:cancel", () => {
    authCancelled = true;
    authReject?.(new Error("Authentication cancelled by user"));
    cleanupAuthServer();
    return { success: true };
  });

  // Add a handler to exchange auth code for token in the main process
  // This avoids network issues that can happen in the renderer process
  ipcMain.handle("auth:exchangeToken", async (_, params) => {
    return withGroupAsync(
      `[AuthIPC] Token Exchange (${params.clientId.substring(0, 8)}...)`,
      async () => {
        try {
          const { clientId, clientSecret, redirectUri, code } = params;

          // Validate parameters
          const validation = validateTokenExchangeParams({
            clientId,
            clientSecret,
            redirectUri,
            code,
          });
          if (!validation.isValid) {
            return { success: false, error: validation.error };
          }

          console.info("[AuthIPC] Exchanging token in main process:", {
            clientIdLength: clientId.length,
            redirectUri,
            codeLength: code.length,
          });

          // Maximum number of retry attempts
          const MAX_RETRIES = 3;
          let retries = 0;
          let lastError = null;

          while (retries < MAX_RETRIES) {
            try {
              console.debug(
                `[AuthIPC] Token exchange attempt ${retries + 1}/${MAX_RETRIES}`,
              );

              // Add delay between retries
              if (retries > 0) {
                const delay = retries * 1000; // 1s, 2s, 3s
                console.debug(`[AuthIPC] Waiting ${delay}ms before retry...`);
                await new Promise((resolve) => setTimeout(resolve, delay));
              }

              const result = await performTokenExchange({
                clientId,
                clientSecret,
                redirectUri,
                code,
              });
              if (result.success) {
                return { success: true, token: result.token };
              }

              throw new Error(result.error);
            } catch (error) {
              lastError = error;
              console.error(
                `[AuthIPC] Token exchange attempt ${retries + 1} failed:`,
                error,
              );

              if (!isNetworkError(error)) {
                // Don't retry for non-network errors
                break;
              }

              retries++;
            }
          }

          // If we reach here, all retries failed
          console.error(
            "[AuthIPC] All token exchange attempts failed:",
            lastError,
          );
          return {
            success: false,
            error: formatTokenExchangeError(lastError),
          };
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          console.error(
            "[AuthIPC] Token exchange handler error:",
            errorMessage,
          );
          return { success: false, error: errorMessage };
        }
      },
    );
  });
}

/**
 * Send an HTTP response with HTML content for OAuth callback.
 * @internal
 */
function sendResponse(
  res: http.ServerResponse,
  statusCode: number,
  message: string,
  mainWindow: BrowserWindow,
): void {
  const htmlResponse = `
    <html>
      <head>
        <title>AniList Authentication</title>
        <style>
          body {
            font-family: sans-serif;
            text-align: center;
            padding: 50px;
            max-width: 600px;
            margin: 0 auto;
            line-height: 1.6;
          }
          .container {
            border: 1px solid #eee;
            border-radius: 10px;
            padding: 20px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
          }
          h1 {
            color: ${statusCode === 200 ? "#4CAF50" : "#F44336"};
          }
          .close-button {
            margin-top: 20px;
            padding: 10px 20px;
            background-color: #4CAF50;
            color: white;
            border: none;
            border-radius: 5px;
            cursor: pointer;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>${statusCode === 200 ? "Authentication Successful" : "Authentication Error"}</h1>
          <p>${message}</p>
          <button class="close-button" onclick="window.close()">Close Window</button>
          <script>
            // Auto close after 5 seconds
            setTimeout(() => window.close(), 5000);
          </script>
        </div>
      </body>
    </html>
  `;

  res.writeHead(statusCode, { "Content-Type": "text/html" });
  res.end(htmlResponse);

  // Send status update to the main window
  mainWindow.webContents.send("auth:status", message);
}

/**
 * Validate and parse an incoming HTTP request URL.
 * @internal
 */
function validateAndParseUrl(
  reqUrl: string | undefined,
  port: string,
): { isValid: boolean; parsedUrl?: URL; parsedPath?: string } {
  if (!reqUrl) {
    console.debug("[AuthIPC] Empty request URL, ignoring");
    return { isValid: false };
  }

  try {
    const parsedUrl = new URL(reqUrl, `http://localhost:${port}`);
    const parsedPath = parsedUrl.pathname;
    return { isValid: true, parsedUrl, parsedPath };
  } catch (error) {
    console.error("[AuthIPC] Failed to parse URL:", error);
    return { isValid: false };
  }
}

/**
 * Check if the parsed path matches our callback paths.
 * @internal
 */
function isCallbackPath(
  parsedPath: string,
  normalizedCallbackPath: string,
  callbackPath: string,
): boolean {
  return parsedPath === normalizedCallbackPath || parsedPath === callbackPath;
}

/**
 * Process OAuth callback parameters and handle authentication flow.
 * @internal
 */
function processAuthCallback(
  params: URLSearchParams,
  codeProcessed: boolean,
  res: http.ServerResponse,
  mainWindow: BrowserWindow,
): { shouldContinue: boolean; code?: string; processed: boolean } {
  const hasCode = params.has("code");
  const hasError = params.has("error");

  console.debug(
    `[AuthIPC] Callback detected: code=${hasCode}, error=${hasError}`,
  );

  // If we already processed a code, don't do it again
  if (codeProcessed) {
    console.debug(
      "[AuthIPC] Code already processed, returning success response",
    );
    sendResponse(
      res,
      200,
      "Authentication already processed. You can close this window.",
      mainWindow,
    );
    return { shouldContinue: false, processed: true };
  }

  if (hasError) {
    const error = params.get("error");
    const errorDescription = params.get("error_description");
    const errorMessage = `Authentication Error: ${error} - ${errorDescription}`;
    console.error("[AuthIPC]", errorMessage);

    authReject?.(new Error(errorMessage));
    sendResponse(
      res,
      400,
      `Authentication failed: ${errorDescription}`,
      mainWindow,
    );
    return { shouldContinue: false, processed: true };
  }

  if (hasCode) {
    const code = params.get("code");
    if (!code) {
      sendResponse(res, 400, "Invalid code parameter", mainWindow);
      return { shouldContinue: false, processed: true };
    }
    return { shouldContinue: true, code, processed: true };
  }

  // Neither code nor error
  sendResponse(
    res,
    400,
    "Invalid callback: missing code or error parameter",
    mainWindow,
  );
  return { shouldContinue: false, processed: true };
}

/**
 * Handle successful authentication code receipt.
 * @internal
 */
function handleSuccessfulAuth(
  code: string,
  res: http.ServerResponse,
  mainWindow: BrowserWindow,
): void {
  console.info("[AuthIPC] Authentication successful, resolving with code");

  // Resolve the promise with the code
  if (authResolve) {
    // Set a short timeout to allow the response to be sent first
    setTimeout(() => {
      authResolve!(code);

      // Also set a timeout to clean up the server
      setTimeout(() => {
        cleanupAuthServer();
      }, 3000);
    }, 100);
  } else {
    console.warn("[AuthIPC] authResolve is null - code cannot be processed");
  }

  // Send successful response to browser
  sendResponse(
    res,
    200,
    "Authentication successful! You can close this window.",
    mainWindow,
  );
}

/**
 * Set up a timeout for the authentication process.
 * @internal
 */
function createAuthTimeout(): NodeJS.Timeout {
  return setTimeout(() => {
    if (authResolve) {
      authReject?.(new Error("Authentication timed out after 2 minutes"));
      cleanupAuthServer();
    }
  }, 120000); // 2 minute timeout
}

/**
 * Handle the authentication code promise after the server is running.
 * @internal
 */
function handleAuthCodePromise(
  authCodePromise: Promise<string>,
  mainWindow: BrowserWindow,
  redirectUri: string,
): void {
  authCodePromise
    .then((code) => {
      console.info("[AuthIPC] Auth code received, sending to renderer...", {
        codeLength: code.length,
        codeStart: code.substring(0, 10) + "...",
        redirectUri,
      });

      // Make sure this code isn't truncated
      if (code.length > 500) {
        console.warn(
          "[AuthIPC] Auth code is very long, it may be truncated or malformed",
        );
      }

      mainWindow.webContents.send("auth:codeReceived", { code });
    })
    .catch((error) => {
      if (!authCancelled) {
        console.debug(
          "[AuthIPC] Auth promise rejected but not cancelled, sending cancelled event...",
        );
        mainWindow.webContents.send("auth:cancelled");
      }
      const errorMessage =
        error instanceof Error ? error.message : "Authentication failed";
      console.error("[AuthIPC] Auth error:", errorMessage);
    });
}

/**
 * Start a temporary HTTP server to handle the OAuth callback
 *
 * @param port - The port to listen on.
 * @param callbackPath - The callback path to watch for.
 * @param mainWindow - The main Electron browser window instance.
 * @returns A promise that resolves when the server is started.
 * @internal
 * @source
 */
async function startAuthServer(
  port: string,
  callbackPath: string,
  mainWindow: BrowserWindow,
): Promise<void> {
  return withGroupAsync(`[AuthIPC] Auth Server (port ${port})`, async () => {
    // Cleanup any existing server
    cleanupAuthServer();

    // Normalize the callback path
    const normalizedCallbackPath = callbackPath.startsWith("/")
      ? callbackPath
      : `/${callbackPath}`;

    console.info(
      `[AuthIPC] Starting auth server on port ${port}, watching for path: ${normalizedCallbackPath}`,
    );

    // Flag to track if we've already processed a code
    let codeProcessed = false;

    // Create and start the server
    return new Promise<void>((resolve, reject) => {
      try {
        authServer = http.createServer((req, res) => {
          startGroup(`[AuthIPC] Callback Request: ${req.url}`);
          try {
            console.debug(`[AuthIPC] Received request: ${req.url}`);

            const urlResult = validateAndParseUrl(req.url, port);
            if (
              !urlResult.isValid ||
              !urlResult.parsedUrl ||
              !urlResult.parsedPath
            ) {
              endGroup();
              return sendResponse(
                res,
                400,
                "Bad Request: No URL provided",
                mainWindow,
              );
            }

            const { parsedUrl, parsedPath } = urlResult;

            console.debug(
              `[AuthIPC] Parsed path: ${parsedPath}, comparing to: ${normalizedCallbackPath} or ${callbackPath}`,
            );

            if (
              isCallbackPath(parsedPath, normalizedCallbackPath, callbackPath)
            ) {
              // This is our callback
              const params = parsedUrl.searchParams;

              const authResult = processAuthCallback(
                params,
                codeProcessed,
                res,
                mainWindow,
              );
              if (!authResult.shouldContinue) {
                if (authResult.processed) {
                  codeProcessed = true;
                }
                endGroup();
                return;
              }

              // Mark as processed to prevent duplicate handling
              codeProcessed = true;

              // Handle successful authentication
              if (authResult.code) {
                endGroup();
                return handleSuccessfulAuth(authResult.code, res, mainWindow);
              }
            } else {
              // Not our callback path
              endGroup();
              return sendResponse(res, 404, "Not Found", mainWindow);
            }
          } catch (err) {
            console.error("[AuthIPC] Error handling request:", err);
            endGroup();
            sendResponse(res, 500, "Internal Server Error", mainWindow);
          }
        });

        // Start the server
        authServer.listen(Number.parseInt(port), "127.0.0.1", () => {
          console.info(
            `[AuthIPC] Auth server started on 127.0.0.1:${port}, waiting for callback at ${normalizedCallbackPath}`,
          );
          mainWindow.webContents.send(
            "auth:status",
            `Server started on port ${port}, waiting for authentication...`,
          );
          resolve();
        });

        // Handle server errors
        authServer.on("error", (err: NodeJS.ErrnoException) => {
          // Handle port already in use - try the next port
          if (err.code === "EADDRINUSE") {
            const nextPort = Number.parseInt(port) + 1;
            console.warn(
              `[AuthIPC] Port ${port} already in use, attempting port ${nextPort}`,
            );
            mainWindow.webContents.send(
              "auth:status",
              `Port ${port} busy, trying ${nextPort}...`,
            );

            // Clean up current server state before retry
            cleanupAuthServer();
            startAuthServer(nextPort.toString(), callbackPath, mainWindow)
              .then(resolve)
              .catch(reject);
          } else {
            console.error("[AuthIPC] Auth server error:", err);
            mainWindow.webContents.send(
              "auth:status",
              `Auth server error: ${err instanceof Error ? err.message : "Unknown error"}`,
            );
            reject(err instanceof Error ? err : new Error(String(err)));
          }
        });
      } catch (err) {
        console.error("[AuthIPC] Failed to create auth server:", err);
        mainWindow.webContents.send(
          "auth:status",
          `Failed to create auth server: ${err instanceof Error ? err.message : "Unknown error"}`,
        );
        reject(err instanceof Error ? err : new Error(String(err)));
      }
    });
  });
}

/**
 * Clean up the auth server and related resources
 *
 * @internal
 * @source
 */
function cleanupAuthServer() {
  if (authServer) {
    try {
      authServer.close();
    } catch (err) {
      console.error("[AuthIPC] Error closing auth server:", err);
    }
    authServer = null;
  }

  // Clear any pending timeouts
  if (loadTimeout) {
    clearTimeout(loadTimeout);
    loadTimeout = null;
  }

  // Clear the promise resolvers
  authResolve = null;
  authReject = null;
}
