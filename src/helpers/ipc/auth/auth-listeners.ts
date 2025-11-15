/**
 * @packageDocumentation
 * @module auth-listeners
 * @description Registers IPC event listeners for authentication-related actions (OAuth, credentials, token exchange) in the Electron main process.
 */

import { BrowserWindow, shell } from "electron";
import { secureHandle } from "../listeners-register";
import { URL } from "node:url";
import * as http from "node:http";
import { withGroupAsync, startGroup, endGroup } from "../../../utils/logging";
import type { TokenExchangeResponse } from "../../../types/api";
import { exchangeToken as exchangeTokenHelper } from "../../../api/anilist/auth";
import {
  DEFAULT_ANILIST_CONFIG,
  DEFAULT_AUTH_PORT,
} from "../../../config/anilist";

let authCancelled = false; // Flag to track if user cancelled auth
let loadTimeout: NodeJS.Timeout | null = null; // Timeout handle for auth process
let authServer: http.Server | null = null; // HTTP server for OAuth callback
let authResolve: ((code: string) => void) | null = null; // Promise resolver for auth code
let authReject: ((error: Error) => void) | null = null; // Promise rejecter for auth errors

/** Port for OAuth callback server (non-privileged, no admin required). @source */
const DEFAULT_PORT = DEFAULT_AUTH_PORT;

/**
 * Represents authentication credentials for AniList API.
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

/** In-memory store of user credentials by source. @source */
const storedCredentials: Record<string, AuthCredentials | null> = {
  default: DEFAULT_ANILIST_CONFIG
    ? {
        source: "default",
        clientId: DEFAULT_ANILIST_CONFIG.clientId || "",
        clientSecret: DEFAULT_ANILIST_CONFIG.clientSecret || "",
        redirectUri:
          DEFAULT_ANILIST_CONFIG.redirectUri ||
          `http://localhost:${DEFAULT_PORT}/callback`,
      }
    : {
        source: "default",
        clientId: "",
        clientSecret: "",
        redirectUri: `http://localhost:${DEFAULT_PORT}/callback`,
      },
  custom: null,
};

/**
 * Validates token exchange request parameters.
 * @param params - Token exchange parameters to validate.
 * @returns Validation result with status and optional error message.
 * @internal
 * @source
 */
function validateTokenExchangeParams(params: {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  code: string;
}): { isValid: boolean; error?: string } {
  const { clientId, clientSecret, redirectUri, code } = params;

  // Check for missing required fields
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

  // Warn on suspicious credential lengths
  if (clientId.length < 4 || clientSecret.length < 8) {
    console.warn("[AuthIPC] auth:exchangeToken suspicious credential lengths", {
      clientIdLen: clientId.length,
      clientSecretLen: clientSecret.length,
    });
  }

  // Validate redirect URI format and protocol
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
 * Detects if an error is a network error that warrants retrying.
 * @param error - The error to check.
 * @returns True if error is network-related and retryable.
 * @internal
 * @source
 */
function isNetworkError(error: unknown): boolean {
  const errorMessage = error instanceof Error ? error.message : String(error);

  // Generic network-level errors
  if (
    errorMessage.includes("ENOTFOUND") ||
    errorMessage.includes("ETIMEDOUT") ||
    errorMessage.includes("ECONNRESET") ||
    errorMessage.includes("socket hang up") ||
    errorMessage.includes("network error")
  ) {
    return true;
  }

  // Retry on server-side 5xx responses surfaced by exchangeToken or other helpers
  if (errorMessage.includes("HTTP 5")) return true;

  // Retry on aborts/timeouts (AbortController or fetch abort)
  if (
    errorMessage.includes("aborted") ||
    errorMessage.includes("The operation was aborted") ||
    errorMessage.includes("timed out") ||
    errorMessage.includes("timeout")
  ) {
    return true;
  }

  return false;
}

/**
 * Formats a token exchange error into a user-friendly message.
 * @param lastError - The error to format.
 * @returns Formatted error message string.
 * @internal
 * @source
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
 * Validates the OAuth URL protocol is HTTPS.
 * @param url - Parsed OAuth URL.
 * @returns Validation result.
 * @internal
 * @source
 */
function validateOAuthProtocol(url: URL): { valid: boolean; error?: string } {
  if (url.protocol !== "https:") {
    return {
      valid: false,
      error: `Invalid OAuth URL protocol: ${url.protocol}. Only HTTPS is allowed.`,
    };
  }
  return { valid: true };
}

/**
 * Validates the OAuth URL domain is from AniList.
 * @param url - Parsed OAuth URL.
 * @returns Validation result.
 * @internal
 * @source
 */
function validateOAuthDomain(url: URL): { valid: boolean; error?: string } {
  if (!url.hostname.endsWith("anilist.co")) {
    return {
      valid: false,
      error: `Invalid OAuth URL domain: ${url.hostname}. Only anilist.co is allowed.`,
    };
  }
  return { valid: true };
}

/**
 * Validates the OAuth URL path points to the authorize endpoint.
 * @param url - Parsed OAuth URL.
 * @returns Validation result.
 * @internal
 * @source
 */
function validateOAuthPath(url: URL): { valid: boolean; error?: string } {
  if (!url.pathname.startsWith("/api/v2/oauth/authorize")) {
    return {
      valid: false,
      error: `Invalid OAuth URL path: ${url.pathname}. Expected /api/v2/oauth/authorize.`,
    };
  }
  return { valid: true };
}

/**
 * Validates required OAuth query parameters are present.
 * @param url - Parsed OAuth URL.
 * @returns Validation result.
 * @internal
 * @source
 */
function validateOAuthParams(url: URL): { valid: boolean; error?: string } {
  const requiredParams = ["client_id", "response_type"];
  for (const param of requiredParams) {
    if (!url.searchParams.has(param)) {
      return {
        valid: false,
        error: `Missing required OAuth parameter: ${param}`,
      };
    }
  }
  return { valid: true };
}

/**
 * Validates the redirect_uri parameter matches expected localhost URL.
 * @param url - Parsed OAuth URL.
 * @param expectedRedirectUri - Expected redirect URI to validate against.
 * @returns Validation result.
 * @internal
 * @source
 */
function validateRedirectUri(
  url: URL,
  expectedRedirectUri: string,
): { valid: boolean; error?: string } {
  const urlRedirectUri = url.searchParams.get("redirect_uri");
  if (!urlRedirectUri) {
    return {
      valid: false,
      error: `Missing redirect_uri parameter in OAuth URL`,
    };
  }

  try {
    const redirectUrl = new URL(urlRedirectUri);
    const expectedUrl = new URL(expectedRedirectUri);

    // Protocol and hostname must match
    if (
      redirectUrl.protocol !== expectedUrl.protocol ||
      redirectUrl.hostname !== expectedUrl.hostname
    ) {
      return {
        valid: false,
        error: `redirect_uri origin mismatch. Expected ${expectedUrl.origin}, got ${redirectUrl.origin}`,
      };
    }

    // Must use localhost loopback
    if (
      redirectUrl.hostname !== "localhost" &&
      redirectUrl.hostname !== "127.0.0.1"
    ) {
      return {
        valid: false,
        error: `redirect_uri must use localhost. Got: ${redirectUrl.hostname}`,
      };
    }

    if (!redirectUrl.port) {
      return {
        valid: false,
        error: `redirect_uri must include a port number`,
      };
    }

    return { valid: true };
  } catch (error) {
    return {
      valid: false,
      error: `Invalid redirect_uri URL: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Resolve an implementation for fetch and AbortController in Electron main process.
 * Falls back to node-fetch if globals are unavailable.
 * @returns fetchImpl and AbortController implementation (may be undefined if not found)
 */
async function getFetchAndAbortController(): Promise<{
  fetchImpl?: typeof globalThis.fetch;
  AbortControllerImpl?: typeof AbortController;
}> {
  let fetchImpl: typeof globalThis.fetch | undefined =
    typeof globalThis.fetch === "function" ? globalThis.fetch : undefined;
  let AbortControllerImpl: typeof AbortController | undefined =
    typeof globalThis.AbortController === "function"
      ? globalThis.AbortController
      : undefined;

  if (!fetchImpl || !AbortControllerImpl) {
    try {
      const nodeFetchModule: unknown = await import("node-fetch");
      const nf = nodeFetchModule as {
        default?: typeof globalThis.fetch;
        AbortController?: typeof AbortController;
      };
      fetchImpl = nf.default ?? (nf as unknown as typeof globalThis.fetch);
      AbortControllerImpl = nf.AbortController ?? globalThis.AbortController;
    } catch (err) {
      console.debug(
        "[AuthIPC] node-fetch fallback not available, relying on global fetch/AbortController",
        err instanceof Error ? err.message : String(err),
      );
    }
  }

  return { fetchImpl, AbortControllerImpl };
}

/**
 * Attempt a single token exchange using the helper with provided fetch/AbortController.
 * Throws on non-success results to allow caller to classify retries.
 */
async function attemptExchangeTokenOnce(
  params: {
    clientId: string;
    clientSecret: string;
    redirectUri: string;
    code: string;
  },
  fetchImpl?: typeof globalThis.fetch,
  AbortControllerImpl?: typeof AbortController,
): Promise<TokenExchangeResponse> {
  const result = await exchangeTokenHelper(
    {
      clientId: params.clientId,
      clientSecret: params.clientSecret,
      redirectUri: params.redirectUri,
      code: params.code,
    },
    { fetch: fetchImpl, AbortController: AbortControllerImpl },
  );
  if (result.success) return result;
  throw new Error(result.error);
}

/**
 * Performs token exchange with retries on network-level errors (including 5xx and aborts/timeouts).
 */
async function exchangeTokenWithRetries(
  params: {
    clientId: string;
    clientSecret: string;
    redirectUri: string;
    code: string;
  },
  maxAttempts = 3,
): Promise<TokenExchangeResponse> {
  let lastError: unknown = null;
  let attempts = 0;
  const deps = await getFetchAndAbortController();

  while (attempts < maxAttempts) {
    try {
      if (attempts > 0) {
        const delay = Math.min(Math.pow(2, attempts) * 1000, 60000);
        console.debug(`[AuthIPC] Waiting ${delay}ms before retry...`);
        await new Promise((r) => setTimeout(r, delay));
      }

      const result = await attemptExchangeTokenOnce(
        params,
        deps.fetchImpl,
        deps.AbortControllerImpl,
      );
      return result;
    } catch (err) {
      lastError = err;
      const msg = err instanceof Error ? err.message : String(err);
      console.error(
        `[AuthIPC] Token exchange attempt ${attempts + 1} failed: ${msg}`,
      );
      // Retry classification
      if (!isNetworkError(err)) {
        break;
      }
      attempts++;
    }
  }

  // All attempts exhausted
  return { success: false, error: formatTokenExchangeError(lastError) };
}

/**
 * Validates an OAuth URL comprehensively before opening in browser.
 * Checks protocol (HTTPS), domain (anilist.co), path, and required parameters.
 * @param url - The OAuth URL to validate.
 * @param redirectUri - Optional expected redirect URI to validate against.
 * @returns Validation result with error details if invalid.
 * @internal
 * @source
 */
function validateOAuthUrl(
  url: string,
  redirectUri?: string,
): { valid: boolean; error?: string } {
  try {
    const parsedUrl = new URL(url);

    // Validate protocol
    const protocolCheck = validateOAuthProtocol(parsedUrl);
    if (!protocolCheck.valid) return protocolCheck;

    // Validate domain
    const domainCheck = validateOAuthDomain(parsedUrl);
    if (!domainCheck.valid) return domainCheck;

    // Validate path
    const pathCheck = validateOAuthPath(parsedUrl);
    if (!pathCheck.valid) return pathCheck;

    // Validate required params
    const paramsCheck = validateOAuthParams(parsedUrl);
    if (!paramsCheck.valid) return paramsCheck;

    // Validate redirect_uri if provided
    if (redirectUri) {
      const redirectCheck = validateRedirectUri(parsedUrl, redirectUri);
      if (!redirectCheck.valid) return redirectCheck;
    }

    return { valid: true };
  } catch (error) {
    return {
      valid: false,
      error: `Invalid OAuth URL format: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Registers IPC event listeners for all authentication-related operations.
 * Handles OAuth flow, credentials management, and token exchange.
 * @param mainWindow - The main application browser window.
 * @source
 */
export function addAuthEventListeners(mainWindow: BrowserWindow) {
  // Open the OAuth window when requested by the renderer
  secureHandle(
    "auth:openOAuthWindow",
    async (event, oauthUrl: string, redirectUri: string) => {
      return withGroupAsync(
        `[AuthIPC] OAuth Flow: ${redirectUri}`,
        async () => {
          try {
            // Reset cancellation flag
            authCancelled = false;

            // Validate OAuth URL and parameters EARLY before allocating any resources
            const validation = validateOAuthUrl(oauthUrl, redirectUri);
            if (!validation.valid) {
              console.error(
                `[AuthIPC] ❌ OAuth URL validation failed: ${validation.error}`,
              );
              mainWindow.webContents.send(
                "auth:status",
                `Security error: ${validation.error}`,
              );
              return {
                success: false,
                error: validation.error,
              };
            }

            console.info(
              `[AuthIPC] ✅ OAuth URL validated: ${new URL(oauthUrl).hostname}`,
            );

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
    mainWindow,
  );

  // Handle storing and retrieving API credentials
  secureHandle(
    "auth:storeCredentials",
    async (event, credentials: AuthCredentials) => {
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
    },
    mainWindow,
  );

  // Get stored credentials
  secureHandle(
    "auth:getCredentials",
    async (event, source: string) => {
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
    },
    mainWindow,
  );

  // Add a way to manually cancel auth
  secureHandle(
    "auth:cancel",
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    (event) => {
      authCancelled = true;
      authReject?.(new Error("Authentication cancelled by user"));
      cleanupAuthServer();
      return { success: true };
    },
    mainWindow,
  );

  // Add a handler to exchange auth code for token in the main process
  // This avoids network issues that can happen in the renderer process
  secureHandle(
    "auth:exchangeToken",
    async (
      _event,
      params: {
        code: string;
        clientId: string;
        clientSecret: string;
        redirectUri: string;
      },
    ) => {
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

            const result = await exchangeTokenWithRetries(
              { clientId, clientSecret, redirectUri, code },
              3,
            );
            return result;
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
    },
    mainWindow,
  );
}

/**
 * Sends an HTTP response with HTML content for OAuth callback results.
 * @param res - HTTP response object.
 * @param statusCode - HTTP status code.
 * @param message - Message to display to the user.
 * @param mainWindow - The main window for sending status updates.
 * @internal
 * @source
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
 * Validates and parses an incoming HTTP request URL.
 * @param reqUrl - The request URL string.
 * @param port - The server port.
 * @returns Parsed URL or validation failure indicator.
 * @internal
 * @source
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
 * Checks if a parsed path matches the expected OAuth callback paths.
 * @param parsedPath - The parsed request path.
 * @param normalizedCallbackPath - Normalized callback path with leading slash.
 * @param callbackPath - Original callback path.
 * @returns True if path matches either normalized or original path.
 * @internal
 * @source
 */
function isCallbackPath(
  parsedPath: string,
  normalizedCallbackPath: string,
  callbackPath: string,
): boolean {
  return parsedPath === normalizedCallbackPath || parsedPath === callbackPath;
}

/**
 * Processes OAuth callback parameters and sends appropriate HTTP response.
 * @param params - URL search parameters from callback.
 * @param codeProcessed - Flag indicating if a code was already processed.
 * @param res - HTTP response object.
 * @param mainWindow - The main window for sending status updates.
 * @returns Processing result with code if successful.
 * @internal
 * @source
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

  // Prevent duplicate code processing
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

  // Handle OAuth error response
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

  // Handle successful code response
  if (hasCode) {
    const code = params.get("code");
    if (!code) {
      sendResponse(res, 400, "Invalid code parameter", mainWindow);
      return { shouldContinue: false, processed: true };
    }
    return { shouldContinue: true, code, processed: true };
  }

  // Neither code nor error present
  sendResponse(
    res,
    400,
    "Invalid callback: missing code or error parameter",
    mainWindow,
  );
  return { shouldContinue: false, processed: true };
}

/**
 * Handles successful authentication code receipt and sends to renderer.
 * @param code - The authorization code from OAuth callback.
 * @param res - HTTP response object.
 * @param mainWindow - The main window for sending code and cleaning up.
 * @internal
 * @source
 */
function handleSuccessfulAuth(
  code: string,
  res: http.ServerResponse,
  mainWindow: BrowserWindow,
): void {
  console.info("[AuthIPC] Authentication successful, resolving with code");

  // Resolve the promise with the code
  if (authResolve) {
    // Small delay to allow HTTP response to be sent first
    setTimeout(() => {
      authResolve!(code);

      // Schedule server cleanup after code is processed
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
 * Creates a timeout for the entire authentication process (2 minutes).
 * @returns Timeout handle for cleanup.
 * @internal
 * @source
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
 * Handles the authentication code promise after server is running.
 * Sends code to renderer or handles cancellation/errors.
 * @param authCodePromise - Promise that resolves with the auth code.
 * @param mainWindow - The main window for sending events.
 * @param redirectUri - The redirect URI for logging.
 * @internal
 * @source
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

      // Warn if code is suspiciously long
      if (code.length > 500) {
        console.warn(
          "[AuthIPC] Auth code is very long, it may be truncated or malformed",
        );
      }

      mainWindow.webContents.send("auth:codeReceived", { code });
    })
    .catch((error) => {
      // Only send cancelled event if auth wasn't explicitly cancelled by user
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
 * Starts a temporary HTTP server to handle the OAuth callback.
 * Creates a server listening for the authorization callback with automatic port fallback.
 * @param port - The port to listen on.
 * @param callbackPath - The callback path to watch for (e.g., "/callback").
 * @param mainWindow - The main Electron browser window instance.
 * @returns Promise that resolves when server is successfully started.
 * @throws {Error} If server cannot be started after port fallback attempts.
 * @internal
 * @source
 */
async function startAuthServer(
  port: string,
  callbackPath: string,
  mainWindow: BrowserWindow,
): Promise<void> {
  return withGroupAsync(`[AuthIPC] Auth Server (port ${port})`, async () => {
    // Clean up any existing server first
    cleanupAuthServer();

    // Normalize the callback path
    const normalizedCallbackPath = callbackPath.startsWith("/")
      ? callbackPath
      : `/${callbackPath}`;

    console.info(
      `[AuthIPC] Starting auth server on port ${port}, watching for path: ${normalizedCallbackPath}`,
    );

    // Flag to prevent duplicate code handling
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

        // Handle server errors (e.g., port already in use)
        authServer.on("error", (err: NodeJS.ErrnoException) => {
          if (err.code === "EADDRINUSE") {
            // Port in use, try next port
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
 * Cleans up the auth server and all related resources.
 * Closes the HTTP server, clears timeouts, and resets promise handlers.
 * @internal
 * @source
 */
function cleanupAuthServer() {
  // Close the HTTP server
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

  // Reset the promise handlers
  authResolve = null;
  authReject = null;
}
