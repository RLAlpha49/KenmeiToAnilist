/**
 * @packageDocumentation
 * @module auth_listeners
 * @description Registers IPC event listeners for authentication-related actions (OAuth, credentials, token exchange) in the Electron main process.
 */

import { BrowserWindow, ipcMain, shell } from "electron";
import { URL } from "url";
import * as http from "http";

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
    console.error("auth:exchangeToken missing required fields", missing);
    return {
      isValid: false,
      error: `Missing required auth fields: ${missing.join(", ")}`,
    };
  }

  // Basic sanity checks
  if (clientId.length < 4 || clientSecret.length < 8) {
    console.warn("auth:exchangeToken suspicious credential lengths", {
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
}): Promise<{ success: boolean; token?: unknown; error?: string }> {
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

  console.log("Token exchange response status:", response.status);

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Token exchange error:", errorText);
    if (errorText.includes("invalid_client")) {
      console.error("Detected invalid_client from AniList. Diagnostics:", {
        clientIdLen: clientId.length,
        clientSecretLen: clientSecret.length,
        redirectUri,
        codeLen: code.length,
      });
    }
    return {
      success: false,
      error: `API error: ${response.status} ${errorText}`,
    };
  }

  const data = await response.json();
  console.log("Token exchange successful:", {
    token_type: data.token_type,
    expires_in: data.expires_in,
    token_length: data.access_token?.length || 0,
  });

  return { success: true, token: data };
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
  } else if (lastError && typeof lastError === "object" && "toString" in lastError && typeof (lastError as any).toString === "function") {
    errorMessage = (lastError as any).toString();
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
            const redirectParam = oauthUrlObj.searchParams.get("redirect_uri");
            if (redirectParam) {
              oauthUrlObj.searchParams.set("redirect_uri", updatedRedirectUri);
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

            // Set timeout for the entire auth process
            setTimeout(() => {
              if (authResolve) {
                authReject?.(
                  new Error("Authentication timed out after 2 minutes"),
                );
                cleanupAuthServer();
              }
            }, 120000); // 2 minute timeout
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
            authCodePromise
              .then((code) => {
                console.log("Auth code received, sending to renderer...", {
                  codeLength: code.length,
                  codeStart: code.substring(0, 10) + "...",
                  redirectUri,
                });

                // Make sure this code isn't truncated
                if (code.length > 500) {
                  console.warn(
                    "Auth code is very long, it may be truncated or malformed",
                  );
                }

                mainWindow.webContents.send("auth:codeReceived", { code });
              })
              .catch((error) => {
                if (!authCancelled) {
                  console.log(
                    "Auth promise rejected but not cancelled, sending cancelled event...",
                  );
                  mainWindow.webContents.send("auth:cancelled");
                }
                const errorMessage =
                  error instanceof Error
                    ? error.message
                    : "Authentication failed";
                console.error("Auth error:", errorMessage);
              });
          }, 100);

          // IMPORTANT: Return success immediately so the IPC call resolves
          // The actual code handling will happen via the auth:codeReceived event
          return { success: true };
        } catch (serverError) {
          const errorMessage =
            serverError instanceof Error
              ? serverError.message
              : "Failed to start authentication server";
          console.error("Server error:", serverError);
          mainWindow.webContents.send(
            "auth:status",
            `Authentication error: ${errorMessage}`,
          );
          return { success: false, error: errorMessage };
        }
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        console.error("Failed to open OAuth window:", error);
        cleanupAuthServer();
        return { success: false, error: errorMessage };
      }
    },
  );

  // Handle storing and retrieving API credentials
  ipcMain.handle("auth:storeCredentials", async (_, credentials) => {
    try {
      console.log("Storing credentials:", credentials);
      // Store the credentials in memory
      if (credentials?.source) {
        storedCredentials[credentials.source] = credentials;
      }
      return { success: true };
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      console.error("Failed to store credentials:", error);
      return { success: false, error: errorMessage };
    }
  });

  // Get stored credentials
  ipcMain.handle("auth:getCredentials", async (_, source) => {
    try {
      console.log("Retrieving credentials for source:", source);
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
      console.error("Failed to retrieve credentials:", error);
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

      console.log("Exchanging token in main process:", {
        clientId: clientId.substring(0, 4) + "...",
        redirectUri,
        codeLength: code.length,
      });

      // Maximum number of retry attempts
      const MAX_RETRIES = 3;
      let retries = 0;
      let lastError = null;

      while (retries < MAX_RETRIES) {
        try {
          console.log(`Token exchange attempt ${retries + 1}/${MAX_RETRIES}`);

          // Add delay between retries
          if (retries > 0) {
            const delay = retries * 1000; // 1s, 2s, 3s
            console.log(`Waiting ${delay}ms before retry...`);
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
          console.error(`Token exchange attempt ${retries + 1} failed:`, error);

          if (!isNetworkError(error)) {
            // Don't retry for non-network errors
            break;
          }

          retries++;
        }
      }

      // If we reach here, all retries failed
      console.error("All token exchange attempts failed:", lastError);
      return {
        success: false,
        error: formatTokenExchangeError(lastError),
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error("Token exchange handler error:", errorMessage);
      return { success: false, error: errorMessage };
    }
  });
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
    console.log("Empty request URL, ignoring");
    return { isValid: false };
  }

  try {
    const parsedUrl = new URL(reqUrl, `http://localhost:${port}`);
    const parsedPath = parsedUrl.pathname;
    return { isValid: true, parsedUrl, parsedPath };
  } catch (error) {
    console.error("Failed to parse URL:", error);
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
  sendResponse: (
    res: http.ServerResponse,
    statusCode: number,
    message: string,
  ) => void,
): { shouldContinue: boolean; code?: string; processed: boolean } {
  const hasCode = params.has("code");
  const hasError = params.has("error");

  console.log(`Callback detected: code=${hasCode}, error=${hasError}`);

  // If we already processed a code, don't do it again
  if (codeProcessed) {
    console.log("Code already processed, returning success response");
    sendResponse(
      res,
      200,
      "Authentication already processed. You can close this window.",
    );
    return { shouldContinue: false, processed: true };
  }

  if (hasError) {
    const error = params.get("error");
    const errorDescription = params.get("error_description");
    const errorMessage = `Authentication Error: ${error} - ${errorDescription}`;
    console.error(errorMessage);

    authReject?.(new Error(errorMessage));
    sendResponse(res, 400, `Authentication failed: ${errorDescription}`);
    return { shouldContinue: false, processed: true };
  }

  if (hasCode) {
    const code = params.get("code");
    if (!code) {
      sendResponse(res, 400, "Invalid code parameter");
      return { shouldContinue: false, processed: true };
    }
    return { shouldContinue: true, code, processed: true };
  }

  // Neither code nor error
  sendResponse(res, 400, "Invalid callback: missing code or error parameter");
  return { shouldContinue: false, processed: true };
}

/**
 * Handle successful authentication code receipt.
 * @internal
 */
function handleSuccessfulAuth(
  code: string,
  res: http.ServerResponse,
  sendResponse: (
    res: http.ServerResponse,
    statusCode: number,
    message: string,
  ) => void,
): void {
  console.log("Authentication successful, resolving with code");

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
    console.warn("authResolve is null - code cannot be processed");
  }

  // Send successful response to browser
  sendResponse(
    res,
    200,
    "Authentication successful! You can close this window.",
  );
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
  // Cleanup any existing server
  cleanupAuthServer();

  // Normalize the callback path
  const normalizedCallbackPath = callbackPath.startsWith("/")
    ? callbackPath
    : `/${callbackPath}`;

  console.log(
    `Starting auth server on port ${port}, watching for path: ${normalizedCallbackPath}`,
  );

  // Flag to track if we've already processed a code
  let codeProcessed = false;

  // Helper function to send a response
  function sendResponse(
    res: http.ServerResponse,
    statusCode: number,
    message: string,
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

  // Create and start the server
  return new Promise<void>((resolve, reject) => {
    try {
      authServer = http.createServer((req, res) => {
        try {
          console.log(`Received request: ${req.url}`);

          const urlResult = validateAndParseUrl(req.url, port);
          if (
            !urlResult.isValid ||
            !urlResult.parsedUrl ||
            !urlResult.parsedPath
          ) {
            return sendResponse(res, 400, "Bad Request: No URL provided");
          }

          const { parsedUrl, parsedPath } = urlResult;

          console.log(
            `Parsed path: ${parsedPath}, comparing to: ${normalizedCallbackPath} or ${callbackPath}`,
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
              sendResponse,
            );
            if (!authResult.shouldContinue) {
              if (authResult.processed) {
                codeProcessed = true;
              }
              return;
            }

            // Mark as processed to prevent duplicate handling
            codeProcessed = true;

            // Handle successful authentication
            if (authResult.code) {
              return handleSuccessfulAuth(authResult.code, res, sendResponse);
            }
          } else {
            // Not our callback path
            return sendResponse(res, 404, "Not Found");
          }
        } catch (err) {
          console.error("Error handling request:", err);
          sendResponse(res, 500, "Internal Server Error");
        }
      });

      // Start the server
      authServer.listen(parseInt(port), "localhost", () => {
        console.log(
          `Auth server started on port ${port}, waiting for callback at ${normalizedCallbackPath}`,
        );
        mainWindow.webContents.send(
          "auth:status",
          `Server started on port ${port}, waiting for authentication...`,
        );
        resolve();
      });

      // Handle server errors
      authServer.on("error", (err) => {
        console.error("Auth server error:", err);
        mainWindow.webContents.send(
          "auth:status",
          `Auth server error: ${err instanceof Error ? err.message : "Unknown error"}`,
        );
        reject(err instanceof Error ? err : new Error(String(err)));
      });
    } catch (err) {
      console.error("Failed to create auth server:", err);
      mainWindow.webContents.send(
        "auth:status",
        `Failed to create auth server: ${err instanceof Error ? err.message : "Unknown error"}`,
      );
      reject(err instanceof Error ? err : new Error(String(err)));
    }
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
      console.error("Error closing auth server:", err);
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
