/**
 * @packageDocumentation
 * @module AuthContext
 * @description React context provider for authentication state and actions, including login, logout, and credential management.
 */

import React, {
  useState,
  useEffect,
  ReactNode,
  useRef,
  useCallback,
} from "react";
import { toast } from "sonner";
import * as Sentry from "@sentry/electron/renderer";
import { storage } from "../utils/storage";
import {
  captureError,
  ErrorType,
  createError,
  showErrorNotification,
  ErrorRecoveryAction,
} from "../utils/errorHandling";
import { truncateToastMessage } from "../utils/textHighlight";
import {
  AuthState,
  APICredentials,
  ViewerResponse,
  AuthStateContextValue,
  AuthActionsContextValue,
  OfflineQueueTask,
} from "../types/auth";
import { AuthActionsContext, AuthStateContext } from "./AuthContextDefinition";
import { DEFAULT_ANILIST_CONFIG } from "../config/anilist";
import { useDebugActions, StateInspectorHandle } from "./DebugContext";
import { request } from "../api/anilist/client";
import { GET_VIEWER } from "../api/anilist/queries";

/**
 * Props for the AuthProvider component.
 * @property children - React children elements to wrap with authentication context.
 * @source
 */
interface AuthProviderProps {
  children: ReactNode;
}

/**
 * Debug snapshot of the authentication context state for inspection and time-travel debugging.
 * Captures the complete authentication state at a point in time for debugging purposes.
 * @property authState - Current authentication state including credentials and user info.
 * @property isLoading - Whether an authentication operation is in progress.
 * @property error - The latest authentication error message, if any.
 * @property statusMessage - User-facing status message during authentication flow.
 * @property isBrowserAuthFlow - Whether an OAuth browser flow is currently active.
 * @property customCredentials - Custom API credentials if user-provided, otherwise null.
 * @property isOnline - Whether the application currently has network connectivity.
 * @property wasOffline - Whether the application was offline since the last check.
 * @source
 */
interface AuthDebugSnapshot {
  authState: AuthState;
  isLoading: boolean;
  error: string | null;
  statusMessage: string | null;
  isBrowserAuthFlow: boolean;
  customCredentials: APICredentials | null;
  isOnline: boolean;
  wasOffline: boolean;
}

/**
 * Provides complete authentication context to child components via split context pattern.
 * Manages OAuth flows, token lifecycle, credential storage, user profiles, offline queue,
 * and network status. Integrates with Electron IPC for secure credential storage and OAuth windows.
 *
 * **Key Features:**
 * - Split context (state/actions) to minimize re-renders
 * - OAuth flow management with browser window integration
 * - Automatic token refresh on expiry
 * - Offline queue for background requests when connectivity is lost
 * - Network status monitoring with automatic recovery
 * - Debug inspection and state snapshots via Debug Context
 * - Rate limit aware (checks online status before auth operations)
 *
 * @param children - React children to wrap with authentication context.
 * @returns Provider component exposing AuthStateContext and AuthActionsContext.
 * @source
 */
export function AuthProvider({ children }: Readonly<AuthProviderProps>) {
  // Add a ref to track previous state for comparison
  const prevAuthStateRef = useRef<string>("");

  const [authState, setAuthState] = useState<AuthState>(() => {
    // Load auth state from storage if available
    const storedAuthState = storage.getItem("authState");
    if (storedAuthState) {
      try {
        const parsedState = JSON.parse(storedAuthState);
        // Check if the token is still valid
        if (parsedState.expiresAt && parsedState.expiresAt > Date.now()) {
          // Initialize our ref with the current state
          prevAuthStateRef.current = storedAuthState;
          return parsedState;
        }
      } catch (err) {
        console.error("[AuthContext] Failed to parse stored auth state:", err);
      }
    }
    return {
      isAuthenticated: false,
      credentialSource: "default",
    };
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [customCredentials, setCustomCredentials] =
    useState<APICredentials | null>(null);
  const [isBrowserAuthFlow, setIsBrowserAuthFlow] = useState(false);
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [wasOffline, setWasOffline] = useState<boolean>(false);
  /**
   * Offline request queue - holds requests made while offline to be replayed when connection restores.
   * Current behavior: Queue is volatile and lost on app restart (stored in React state only).
   *
   * FUTURE OPTIMIZATION: For critical use cases, consider persisting this queue to storage:
   * - Save to storage when tasks are added to the queue
   * - Restore from storage on app startup
   * - Clear from storage when tasks are successfully drained
   * - This would allow recovery of pending requests across app restarts
   *
   * Trade-offs:
   * - Persistence adds I/O overhead and increases storage usage
   * - Volatility (current behavior) is simpler and suitable for most cases
   * - Users can manually retry failed operations via "Retry" button if app crashes
   *
   * See: drainOfflineQueue() and queue addition logic in IPC listeners
   */
  const [offlineQueue, setOfflineQueue] = useState<OfflineQueueTask[]>([]);
  // Track a monotonic auth attempt id to prevent races (stale responses)
  const authAttemptRef = useRef(0);
  // Lock credential source during an active OAuth flow to avoid mismatches
  const lockedCredentialSourceRef = useRef<null | ("default" | "custom")>(null);
  const { registerStateInspector: registerAuthStateInspector, recordEvent } =
    useDebugActions();
  const authInspectorHandleRef =
    useRef<StateInspectorHandle<AuthDebugSnapshot> | null>(null);
  const authSnapshotRef = useRef<AuthDebugSnapshot | null>(null);
  const getAuthSnapshotRef = useRef<() => AuthDebugSnapshot>(() => ({
    authState,
    isLoading,
    error,
    statusMessage,
    isBrowserAuthFlow,
    customCredentials,
    isOnline,
    wasOffline,
  }));
  getAuthSnapshotRef.current = () => ({
    authState,
    isLoading,
    error,
    statusMessage,
    isBrowserAuthFlow,
    customCredentials,
    isOnline,
    wasOffline,
  });

  const applyAuthDebugSnapshot = useCallback(
    (snapshot: AuthDebugSnapshot) => {
      setAuthState(snapshot.authState);
      setIsLoading(snapshot.isLoading);
      setError(snapshot.error);
      setStatusMessage(snapshot.statusMessage);
      setIsBrowserAuthFlow(snapshot.isBrowserAuthFlow);
      setCustomCredentials(snapshot.customCredentials);
      setIsOnline(snapshot.isOnline);
      setWasOffline(snapshot.wasOffline);
      authSnapshotRef.current = snapshot;
    },
    [
      setAuthState,
      setIsLoading,
      setError,
      setStatusMessage,
      setIsBrowserAuthFlow,
      setCustomCredentials,
      setIsOnline,
      setWasOffline,
    ],
  );

  useEffect(() => {
    const snapshot = getAuthSnapshotRef.current();
    authSnapshotRef.current = snapshot;
    authInspectorHandleRef.current?.publish(snapshot);
  }, [
    authState,
    isLoading,
    error,
    statusMessage,
    isBrowserAuthFlow,
    customCredentials,
  ]);

  useEffect(() => {
    if (!registerAuthStateInspector) return;

    authSnapshotRef.current = getAuthSnapshotRef.current();

    const handle = registerAuthStateInspector<AuthDebugSnapshot>({
      id: "auth-state",
      label: "Authentication",
      description:
        "Authentication context session, credentials, and flow state.",
      group: "Application",
      getSnapshot: () =>
        authSnapshotRef.current ?? getAuthSnapshotRef.current(),
      setSnapshot: applyAuthDebugSnapshot,
    });

    authInspectorHandleRef.current = handle;

    return () => {
      handle.unregister();
      authInspectorHandleRef.current = null;
      authSnapshotRef.current = null;
    };
  }, [registerAuthStateInspector, applyAuthDebugSnapshot]);

  // Update storage only when state meaningfully changes
  useEffect(() => {
    const serializedState = JSON.stringify(authState);
    // Only update storage if the state has actually changed
    if (serializedState !== prevAuthStateRef.current) {
      prevAuthStateRef.current = serializedState;
      storage.setItem("authState", serializedState);
    }
  }, [authState]);

  /**
   * Validates that API credentials have all required fields (clientId, clientSecret, redirectUri).
   * Displays toast error and throws if validation fails.
   * @param credentials - The credentials object to validate.
   * @returns The validated credentials object.
   * @throws {Error} If any required credential field is missing.
   * @source
   */
  const validateCredentials = (credentials: APICredentials) => {
    const { clientId, clientSecret, redirectUri } = credentials;
    if (!clientId || !clientSecret || !redirectUri) {
      toast.error(
        truncateToastMessage(
          "Credentials incomplete. Please ensure Client ID, Secret & Redirect URI are set.",
          200,
        ).component,
      );
      throw new Error(
        "Incomplete credentials: missing clientId, clientSecret or redirectUri",
      );
    }
    return { clientId, clientSecret, redirectUri };
  };

  /**
   * Fetches and caches the authenticated user's profile data from AniList GraphQL API.
   * Updates authentication state with username, user ID, and avatar URL.
   * Sets user context in Sentry error tracking and records debug event on success.
   * Gracefully degrades with default values if profile fetch fails but token is valid.
   * @param accessToken - The OAuth access token for API requests.
   * @throws Errors are caught and logged; state is partially updated as fallback.
   * @source
   */
  const handleUserProfile = async (accessToken: string) => {
    try {
      const userProfile = await fetchUserProfile(accessToken);

      if (userProfile?.data?.Viewer) {
        const viewer = userProfile.data.Viewer;
        setAuthState((prevState) => ({
          ...prevState,
          username: viewer.name,
          userId: viewer.id,
          avatarUrl:
            viewer.avatar?.large ||
            viewer.avatar?.medium ||
            "https://s4.anilist.co/file/anilistcdn/user/avatar/large/default.png",
        }));
        // Set user context in Sentry after successful authentication
        Sentry.setUser({
          id: viewer.id.toString(),
          username: viewer.name,
        });
        // Add breadcrumb for successful authentication
        Sentry.addBreadcrumb({
          category: "auth",
          message: "User profile fetched",
          level: "info",
          data: {
            userId: viewer.id,
            username: viewer.name,
          },
        });
        setStatusMessage("Authentication complete!");
        recordEvent({
          type: "auth.login",
          message: "User authenticated successfully",
          level: "success",
          metadata: {
            username: viewer.name,
            userId: viewer.id,
          },
        });
      } else {
        throw new Error("Failed to retrieve user profile");
      }
    } catch (profileError) {
      console.error("[AuthContext] Profile fetch error:", profileError);
      captureError(
        ErrorType.AUTH,
        "Failed to fetch user profile from AniList",
        profileError,
        {
          context: "handleUserProfile",
          stage: "profile_fetch",
        },
      );

      // Show recovery notification for profile fetch failure
      showErrorNotification(
        createError(
          ErrorType.AUTH,
          "Could not load your AniList profile",
          profileError,
          "PROFILE_FETCH_FAILED",
          ErrorRecoveryAction.RETRY,
          "We couldn't load your AniList profile. Check your connection and try again.",
        ),
        {
          onRetry: () => handleUserProfile(accessToken),
          duration: 8000,
        },
      );

      // Still authenticated but with limited info - use defaults
      setAuthState((prevState) => ({
        ...prevState,
        username: "AniList User",
        avatarUrl:
          "https://s4.anilist.co/file/anilistcdn/user/avatar/large/default.png",
      }));
      setStatusMessage("Authentication complete (limited profile info)");
    }
  };

  // Set up the code received listener
  useEffect(() => {
    // Only set up the listener if globalThis.electronAuth is available
    if (!globalThis.electronAuth?.onCodeReceived) return;

    const unsubscribe = globalThis.electronAuth.onCodeReceived(async (data) => {
      const currentAttempt = authAttemptRef.current;
      try {
        // We received the code, so the browser flow is now complete
        setIsBrowserAuthFlow(false);
        setIsLoading(true);
        setError(null);
        setStatusMessage(
          "Authorization code received! Exchanging for token...",
        );

        // Guard against stale events if user restarted login mid-flow
        if (currentAttempt !== authAttemptRef.current) {
          console.warn(
            "[AuthContext] Stale auth code event ignored (attempt id mismatch)",
          );
          toast.warning("Ignored outdated authentication response.");
          return;
        }

        // Use locked credential source if set to avoid mid-flow toggles
        const effectiveSource: "default" | "custom" =
          lockedCredentialSourceRef.current || authState.credentialSource;

        // Get the current credentials being used
        const credentialsResponse =
          await globalThis.electronAuth.getCredentials(effectiveSource);

        if (!credentialsResponse.success || !credentialsResponse.credentials) {
          throw new Error(
            credentialsResponse.error || "Failed to get credentials",
          );
        }

        const { clientId, clientSecret, redirectUri } = validateCredentials(
          credentialsResponse.credentials,
        );

        console.debug(
          "[AuthContext] Exchanging auth code for token with credentials:",
          {
            clientIdLength: clientId.length,
            redirectUri,
            codeLength: data.code.length,
          },
        );

        // Exchange the code for an access token
        setStatusMessage("Exchanging auth code for token...");
        const tokenExchangeResult = await globalThis.electronAuth.exchangeToken(
          {
            clientId,
            clientSecret,
            redirectUri,
            code: data.code,
          },
        );

        // Re-check attempt id after async boundary to prevent stale token applying
        if (currentAttempt !== authAttemptRef.current) {
          console.warn(
            "[AuthContext] Discarding token from stale auth attempt (attempt id changed)",
          );
          toast.warning(
            "Discarded token from an outdated authentication attempt.",
          );
          return;
        }

        if (!tokenExchangeResult.success || !tokenExchangeResult.token) {
          throw new Error(
            tokenExchangeResult.error || "Failed to exchange token",
          );
        }

        const tokenResponse = tokenExchangeResult.token;
        console.info("[AuthContext] Token received:", {
          expires_in: tokenResponse.expires_in,
          token_type: tokenResponse.token_type,
          token_length: tokenResponse.access_token.length,
        });

        setStatusMessage("Token received! Fetching user profile...");

        // Temporarily update the auth state with token (without user info yet)
        setAuthState((prevState) => ({
          ...prevState,
          isAuthenticated: true,
          accessToken: tokenResponse.access_token,
          expiresAt: Date.now() + tokenResponse.expires_in * 1000,
        }));

        // Fetch user profile data from AniList
        await handleUserProfile(tokenResponse.access_token);

        // Clear any errors
        setError(null);
        setIsLoading(false);
        // Clear credential lock after flow completes
        lockedCredentialSourceRef.current = null;
      } catch (err: unknown) {
        console.error("[AuthContext] Authentication error:", err);
        const msg =
          err instanceof Error ? err.message : "Authentication failed";
        captureError(
          ErrorType.AUTH,
          "Token exchange failed during authentication",
          err,
          {
            credentialSource: authState.credentialSource,
            attemptId: authAttemptRef.current,
            stage: "token_exchange",
          },
        );
        recordEvent({
          type: "auth.token-exchange",
          message: `Token exchange failed: ${msg}`,
          level: "error",
          metadata: { error: msg },
        });
        toast.error(truncateToastMessage(msg, 200).component);
        setError(msg);
        setStatusMessage(null);
        setIsLoading(false);
        setIsBrowserAuthFlow(false);
        lockedCredentialSourceRef.current = null;
      }
    });

    // Clean up the listener on unmount
    return unsubscribe;
  }, [authState.credentialSource]);

  // Set up network status monitoring
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      // Dispatch custom event for other components to react to
      globalThis.dispatchEvent(new Event("app:online"));
      // Show toast notification
      toast.success("Connection restored");
    };

    const handleOffline = () => {
      setIsOnline(false);
      setWasOffline(true);
      // Dispatch custom event for other components to react to
      globalThis.dispatchEvent(new Event("app:offline"));
    };

    globalThis.addEventListener("online", handleOnline);
    globalThis.addEventListener("offline", handleOffline);

    // Clean up event listeners on unmount
    return () => {
      globalThis.removeEventListener("online", handleOnline);
      globalThis.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Set up the status message listener
  useEffect(() => {
    // Only set up the listener if globalThis.electronAuth is available
    if (!globalThis.electronAuth?.onStatus) return;

    const unsubscribe = globalThis.electronAuth.onStatus((message) => {
      setStatusMessage(message);
    });

    // Clean up the listener on unmount
    return unsubscribe;
  }, []);

  // Set up the cancellation listener
  useEffect(() => {
    // Only set up the listener if globalThis.electronAuth is available
    if (!globalThis.electronAuth?.onCancelled) return;

    const unsubscribe = globalThis.electronAuth.onCancelled(() => {
      setIsLoading(false);
      setIsBrowserAuthFlow(false);
      setError("Authentication was cancelled");
      setStatusMessage(null);
    });

    // Clean up the listener on unmount
    return unsubscribe;
  }, []);

  const storeCredentialsAndBuildUrl = useCallback(
    async (
      incoming: APICredentials,
    ): Promise<{ oauthUrl: string; redirectUri: string }> => {
      // Normalize redirect URI to include protocol
      let redirectUri = incoming.redirectUri;
      const creds = { ...incoming };
      if (
        !redirectUri.startsWith("http://") &&
        !redirectUri.startsWith("https://")
      ) {
        redirectUri = `http://${redirectUri}`;
        creds.redirectUri = redirectUri;
      }

      setStatusMessage("Storing credentials...");
      const storeResult = await globalThis.electronAuth.storeCredentials(creds);
      if (!storeResult.success) {
        toast.error(storeResult.error || "Failed to store credentials");
        throw new Error(storeResult.error || "Failed to store credentials");
      }

      // Verify credentials were actually stored by reading them back
      setStatusMessage("Verifying credentials...");
      const verifyResult = await globalThis.electronAuth.getCredentials(
        creds.source,
      );
      if (!verifyResult.success || !verifyResult.credentials) {
        const errorMsg = "Credential storage verification failed";
        console.error("[AuthContext] ❌ Verification failed:", {
          stored: creds,
          retrieved: verifyResult,
        });
        toast.error(errorMsg);
        throw new Error(errorMsg);
      }

      // Validate that stored credentials match what we sent
      const stored = verifyResult.credentials;
      if (
        stored.clientId !== creds.clientId ||
        stored.clientSecret !== creds.clientSecret ||
        stored.redirectUri !== creds.redirectUri
      ) {
        const errorMsg = "Stored credentials do not match";
        console.error("[AuthContext] ❌ Credential mismatch:", {
          expected: creds,
          actual: stored,
        });
        toast.error(errorMsg);
        throw new Error(errorMsg);
      }

      console.debug(
        "[AuthContext] ✅ Credentials stored and verified successfully",
      );

      const clientId = encodeURIComponent(creds.clientId);
      const encodedRedirectUri = encodeURIComponent(redirectUri);
      const oauthUrl = `https://anilist.co/api/v2/oauth/authorize?client_id=${clientId}&redirect_uri=${encodedRedirectUri}&response_type=code`;
      return { oauthUrl, redirectUri };
    },
    [],
  );

  const openOAuthWindow = useCallback(
    async (oauthUrl: string, redirectUri: string) => {
      const result = await globalThis.electronAuth.openOAuthWindow(
        oauthUrl,
        redirectUri,
      );
      if (!result.success) {
        toast.error(result.error || "Failed to open authentication window");
        throw new Error(result.error || "Failed to open authentication window");
      }
    },
    [],
  );

  const handleOpenWindowError = useCallback(
    (err: unknown, ignoreMessage?: string) => {
      if (isBrowserAuthFlow) {
        console.debug(
          "[AuthContext]",
          ignoreMessage ||
            "Browser auth flow in progress - ignoring window.close error...",
        );
        return;
      }

      console.error("[AuthContext] Login window error:", err);
      const msg =
        err instanceof Error
          ? err.message
          : "Failed to open authentication window";
      toast.error(msg);
      setError(msg);
      setStatusMessage(null);
      setIsLoading(false);
      setIsBrowserAuthFlow(false);
    },
    [isBrowserAuthFlow],
  );

  const refreshToken = useCallback(async () => {
    try {
      // Check if online before attempting to refresh token
      if (!isOnline) {
        // Show recovery notification for offline state
        showErrorNotification(
          createError(
            ErrorType.NETWORK,
            "Cannot refresh token while offline",
            new Error("Offline"),
            "AUTH_OFFLINE",
            ErrorRecoveryAction.CHECK_CONNECTION,
            "Your internet connection is offline. Connect to the internet and try again.",
          ),
          {
            duration: 8000,
          },
        );
        throw new Error(
          "Cannot refresh token while offline. Please check your internet connection.",
        );
      }

      // Add breadcrumb for token refresh
      Sentry.addBreadcrumb({
        category: "auth",
        message: "Token refresh initiated",
        level: "info",
      });
      recordEvent({
        type: "auth.refresh",
        message: "User initiated token refresh",
        level: "info",
      });
      setIsLoading(true);
      setError(null);
      setStatusMessage("Refreshing authentication...");
      setIsBrowserAuthFlow(true);
      // Increment attempt id and lock credential source for this flow
      authAttemptRef.current += 1;
      lockedCredentialSourceRef.current = authState.credentialSource;

      // Get current credentials based on credential source
      const credentials: APICredentials =
        authState.credentialSource === "custom" && customCredentials
          ? customCredentials
          : {
              source: "default" as const,
              clientId: DEFAULT_ANILIST_CONFIG.clientId,
              clientSecret: DEFAULT_ANILIST_CONFIG.clientSecret,
              redirectUri: DEFAULT_ANILIST_CONFIG.redirectUri,
            };

      // Store credentials and build OAuth URL
      const { oauthUrl, redirectUri } =
        await storeCredentialsAndBuildUrl(credentials);

      setStatusMessage("Opening authentication window...");

      // Open the OAuth window and handle transient window-close errors
      try {
        await openOAuthWindow(oauthUrl, redirectUri);
      } catch (err) {
        handleOpenWindowError(
          err,
          "Browser auth flow in progress - ignoring window.close error...",
        );
      }

      // The rest of the authentication process happens in the code received listener
    } catch (err: unknown) {
      console.error("[AuthContext] Token refresh error:", err);
      const msg = err instanceof Error ? err.message : "Token refresh failed";
      captureError(ErrorType.AUTH, "Token refresh failed", err, {
        stage: "token_refresh",
      });

      // Show enhanced error notification with recovery action
      // Note: logout callback used inline to avoid forward reference issues
      showErrorNotification(
        createError(
          ErrorType.AUTH,
          msg,
          err,
          "TOKEN_REFRESH_FAILED",
          ErrorRecoveryAction.REFRESH_TOKEN,
          "Your session has expired. Please log in again to continue.",
        ),
        {
          onRetry: () => {
            // Logout to clear stale state, user must re-authenticate
            setAuthState({
              isAuthenticated: false,
              accessToken: undefined,
              credentialSource: "default",
            });
            setError(null);
            setStatusMessage(null);
            setIsLoading(false);
            localStorage.removeItem("authState");
            sessionStorage.removeItem("pendingAuthFlow");
          },
          duration: 10000,
        },
      );

      recordEvent({
        type: "auth.refresh",
        message: `Token refresh failed: ${msg}`,
        level: "error",
        metadata: { error: msg },
      });
      toast.error(msg);
      setError(msg);
      setStatusMessage(null);
      setIsLoading(false);
      setIsBrowserAuthFlow(false);
    }
  }, [
    authState.credentialSource,
    customCredentials,
    handleOpenWindowError,
    openOAuthWindow,
    recordEvent,
    storeCredentialsAndBuildUrl,
    isOnline,
  ]);

  // Login function
  const login = useCallback(
    async (credentials: APICredentials) => {
      try {
        // Check if online before attempting to authenticate
        if (!isOnline) {
          // Show recovery notification for offline state
          showErrorNotification(
            createError(
              ErrorType.NETWORK,
              "Cannot authenticate while offline",
              new Error("Offline"),
              "AUTH_OFFLINE",
              ErrorRecoveryAction.CHECK_CONNECTION,
              "Connect to the internet and try again.",
            ),
            {
              duration: 8000,
            },
          );
          throw new Error(
            "Cannot authenticate while offline. Please check your internet connection.",
          );
        }

        // Add breadcrumb for login initiation
        Sentry.addBreadcrumb({
          category: "auth",
          message: "Login initiated",
          level: "info",
          data: {
            credentialSource: credentials.source,
          },
        });
        recordEvent({
          type: "auth.login",
          message: "User initiated login",
          level: "info",
          metadata: {
            credentialSource: credentials.source,
          },
        });
        setIsLoading(true);
        setError(null);
        setStatusMessage("Preparing authentication...");
        setIsBrowserAuthFlow(true);
        // Increment attempt id and lock credential source for this flow
        authAttemptRef.current += 1;
        lockedCredentialSourceRef.current = authState.credentialSource;

        // Make sure the redirectUri is properly formatted with http://
        let redirectUri = credentials.redirectUri;
        if (
          !redirectUri.startsWith("http://") &&
          !redirectUri.startsWith("https://")
        ) {
          redirectUri = `http://${redirectUri}`;
          credentials = { ...credentials, redirectUri };
        }

        // Store the credentials securely
        setStatusMessage("Storing credentials...");
        const storeResult =
          await globalThis.electronAuth.storeCredentials(credentials);
        if (!storeResult.success) {
          toast.error(storeResult.error || "Failed to store credentials");
          throw new Error(storeResult.error || "Failed to store credentials");
        }

        // Add breadcrumb for token exchange
        Sentry.addBreadcrumb({
          category: "auth",
          message: "Token exchange started",
          level: "info",
        });

        // Verify credentials were actually stored
        setStatusMessage("Verifying credentials...");
        const verifyResult = await globalThis.electronAuth.getCredentials(
          credentials.source,
        );
        if (!verifyResult.success || !verifyResult.credentials) {
          const errorMsg = "Credential storage verification failed";
          console.error("[AuthContext] ❌ Verification failed:", {
            stored: credentials,
            retrieved: verifyResult,
          });
          toast.error(errorMsg);
          throw new Error(errorMsg);
        }

        // Validate that stored credentials match what we sent
        const stored = verifyResult.credentials;
        if (
          stored.clientId !== credentials.clientId ||
          stored.clientSecret !== credentials.clientSecret ||
          stored.redirectUri !== credentials.redirectUri
        ) {
          const errorMsg = "Stored credentials do not match";
          console.error("[AuthContext] ❌ Credential mismatch:", {
            expected: credentials,
            actual: stored,
          });
          toast.error(errorMsg);
          throw new Error(errorMsg);
        }

        console.debug(
          "[AuthContext] ✅ Credentials stored and verified successfully",
        );

        // Generate the OAuth URL
        const clientId = encodeURIComponent(credentials.clientId);
        const encodedRedirectUri = encodeURIComponent(redirectUri);
        const oauthUrl = `https://anilist.co/api/v2/oauth/authorize?client_id=${clientId}&redirect_uri=${encodedRedirectUri}&response_type=code`;

        setStatusMessage("Opening authentication globalThis...");

        // Open the OAuth window
        try {
          const result = await globalThis.electronAuth.openOAuthWindow(
            oauthUrl,
            redirectUri,
          );

          if (!result.success) {
            toast.error(result.error || "Failed to open authentication window");
            throw new Error(
              result.error || "Failed to open authentication window",
            );
          }
        } catch (err) {
          handleOpenWindowError(
            err,
            "Browser auth flow in progress - ignoring globalThis.close error...",
          );
        }

        // The rest of the authentication process happens in the code received listener
      } catch (err: unknown) {
        console.error("[AuthContext] Login error:", err);
        const msg = err instanceof Error ? err.message : "Login failed";
        captureError(ErrorType.AUTH, "Login failed", err, {
          credentialSource: credentials.source,
          stage: "login",
        });

        // Show enhanced error notification with recovery action
        showErrorNotification(
          createError(
            ErrorType.AUTH,
            msg,
            err,
            "LOGIN_FAILED",
            ErrorRecoveryAction.RETRY,
            "Check your credentials and internet connection, then try logging in again.",
          ),
          {
            onRetry: () => login(credentials),
            duration: 10000,
          },
        );

        toast.error(msg);
        setError(msg);
        setStatusMessage(null);
        setIsLoading(false);
        setIsBrowserAuthFlow(false);
        recordEvent({
          type: "auth.login",
          message: "Login failed",
          level: "error",
          metadata: {
            error: msg,
          },
        });
      }
    },
    [authState.credentialSource, handleOpenWindowError, recordEvent],
  );

  /**
   * Clears authentication state and removes persisted credentials from storage.
   * Resets Sentry user context and records logout event in debug logs.
   * @source
   */
  const logout = useCallback(() => {
    // Add breadcrumb for logout
    Sentry.addBreadcrumb({
      category: "auth",
      message: "User logged out",
      level: "info",
      data: {
        username: authState.username,
      },
    });
    // Clear user context in Sentry on logout
    Sentry.setUser(null);
    recordEvent({
      type: "auth.logout",
      message: "User logged out",
      level: "info",
      metadata: {
        username: authState.username,
      },
    });
    storage.removeItem("authState");
    // Clear the previous state reference when logging out
    prevAuthStateRef.current = "";
    setAuthState({
      isAuthenticated: false,
      credentialSource: authState.credentialSource,
    });
    setStatusMessage(null);
    lockedCredentialSourceRef.current = null;
  }, [authState.credentialSource, authState.username, recordEvent]);

  /**
   * Cancels an in-progress OAuth authentication flow immediately.
   * Invalidates in-flight auth responses via attempt ID increment and clears UI state.
   * @source
   */
  const cancelAuth = useCallback(async () => {
    recordEvent({
      type: "auth.cancel",
      message: "User cancelled authentication",
      level: "warn",
    });
    // Increment attempt id to invalidate any in-flight responses
    authAttemptRef.current += 1;
    lockedCredentialSourceRef.current = null;

    setIsLoading(false);
    setIsBrowserAuthFlow(false);
    setStatusMessage(null);
    setError("Authentication was cancelled");

    try {
      if (globalThis.electronAuth?.cancelAuth) {
        const result = await globalThis.electronAuth.cancelAuth();
        if (!result?.success && result?.error) {
          toast.error(result.error);
        }
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to cancel authentication";
      console.error("[AuthContext] Cancel auth error:", err);
      toast.error(message);
    }
  }, [recordEvent]);

  /**
   * Updates the credential source used for OAuth flows (default or custom credentials).
   * Prevents switching source during an active authentication flow to avoid state mismatch.
   * Only updates if the new source differs from the current source.
   * @param source - The credential source: "default" (built-in) or "custom" (user-provided).
   * @source
   */
  const setCredentialSource = useCallback(
    (source: "default" | "custom") => {
      // Only update if the source actually changed
      if (source !== authState.credentialSource) {
        // Prevent switching source during an active OAuth browser flow
        if (isBrowserAuthFlow) {
          console.warn(
            "[AuthContext] Credential source change ignored during active auth flow",
          );
          return;
        }
        recordEvent({
          type: "auth.credential-source-change",
          message: `Credential source changed to: ${source}`,
          level: "info",
          metadata: { source },
        });
        setAuthState((prevState) => ({
          ...prevState,
          credentialSource: source,
        }));
      }
    },
    [authState.credentialSource, isBrowserAuthFlow, recordEvent],
  );

  /**
   * Updates custom API credentials (clientId, clientSecret, redirectUri) for authentication.
   * Only updates if values have actually changed from the current custom credentials.
   * Useful for allowing users to bring their own AniList API credentials.
   * @param clientId - The OAuth client ID from AniList.
   * @param clientSecret - The OAuth client secret (kept secure in Electron store).
   * @param redirectUri - The OAuth redirect URI (must match AniList application settings).
   * @source
   */
  const updateCustomCredentials = useCallback(
    (clientId: string, clientSecret: string, redirectUri: string) => {
      // Only update if values have actually changed
      if (
        customCredentials?.clientId !== clientId ||
        customCredentials.clientSecret !== clientSecret ||
        customCredentials.redirectUri !== redirectUri
      ) {
        recordEvent({
          type: "auth.custom-credentials-update",
          message: "Custom API credentials updated",
          level: "info",
          metadata: {
            hasClientId: !!clientId,
            hasClientSecret: !!clientSecret,
            redirectUri,
          },
        });
        setCustomCredentials({
          source: "custom",
          clientId,
          clientSecret,
          redirectUri,
        });
      }
    },
    [customCredentials, recordEvent],
  );

  /**
   * Enqueues a task to be executed when the application comes online.
   * If already online, executes the task immediately. If offline, stores the task with
   * deduplication: a newer task with the same taskId replaces an older one.
   * Enforces a maximum queue length (100 tasks) and drops oldest tasks if exceeded.
   * @param taskId - Unique identifier for the task (used for deduplication).
   * @param fn - Async function to execute when online (should be resilient to interruption).
   * @source
   */
  const enqueueWhenOnline = useCallback(
    (taskId: string, fn: () => Promise<void>) => {
      if (isOnline) {
        // Execute immediately if online
        fn().catch((err) => {
          console.error(`[AuthContext] Task ${taskId} failed:`, err);
          captureError(
            ErrorType.NETWORK,
            `Failed to execute online task: ${taskId}`,
            err,
            { context: "enqueueWhenOnline", taskId },
          );
        });
      } else {
        // Queue for later execution - deduplication: remove any existing task with same ID
        setOfflineQueue((prev) => {
          const MAX_OFFLINE_QUEUE_LENGTH = 100;
          const filtered = prev.filter((t) => t.taskId !== taskId);
          let updated = [
            ...filtered,
            {
              taskId,
              fn,
              addedAt: Date.now(),
              attempts: 0,
            },
          ];

          // Enforce max queue length by dropping oldest tasks if needed
          if (updated.length > MAX_OFFLINE_QUEUE_LENGTH) {
            const excess = updated.length - MAX_OFFLINE_QUEUE_LENGTH;
            console.warn(
              `[AuthContext] ⚠️ Offline queue exceeded max length (${updated.length}), dropping ${excess} oldest task(s)`,
            );
            updated = updated.slice(excess);
          }

          return updated;
        });
      }
    },
    [isOnline],
  );

  /**
   * Drains the offline queue when connectivity is restored.
   * Executes tasks sequentially with a 150ms delay between tasks to avoid overwhelming the API.
   * Tasks that fail are logged but do not prevent subsequent tasks from executing.
   * Clears the queue after all tasks have been attempted.
   * @source
   */
  const drainOfflineQueue = useCallback(async () => {
    if (offlineQueue.length === 0) return;

    console.info(
      `[AuthContext] Draining offline queue (${offlineQueue.length} tasks)`,
    );

    const tasks = [...offlineQueue];
    setOfflineQueue([]);

    for (let i = 0; i < tasks.length; i += 1) {
      const task = tasks[i];
      try {
        await task.fn();
        console.debug(`[AuthContext] Task ${task.taskId} completed`);
      } catch (err) {
        console.error(`[AuthContext] Task ${task.taskId} failed:`, err);
        captureError(
          ErrorType.NETWORK,
          `Failed to execute queued task: ${task.taskId}`,
          err,
          {
            context: "drainOfflineQueue",
            taskId: task.taskId,
            attempt: task.attempts + 1,
          },
        );
      }

      // Delay between tasks (except after last one)
      if (i < tasks.length - 1) {
        await sleep(150);
      }
    }
  }, [offlineQueue]);

  // Helper function for sleep
  const sleep = (ms: number) =>
    new Promise((resolve) => setTimeout(resolve, ms));

  // Drain offline queue when connectivity is restored
  useEffect(() => {
    if (isOnline && offlineQueue.length > 0) {
      // Use a small delay to allow for any other online event handlers to complete
      const timeoutId = setTimeout(() => {
        drainOfflineQueue();
      }, 100);
      return () => clearTimeout(timeoutId);
    }
  }, [isOnline, offlineQueue.length, drainOfflineQueue]);

  /**
   * Fetches the authenticated user's profile from AniList GraphQL API.
   * Uses the centralized `request()` function which provides:
   * - Automatic retry with exponential backoff for transient errors
   * - Rate limit handling and detection
   * - Consistent error handling across all API operations
   *
   * @param accessToken - The OAuth access token to authenticate the request.
   * @returns The viewer profile response with user ID, name, and avatar URLs.
   * @throws {Error} If the API request fails after exhausting retries.
   * @source
   */
  const fetchUserProfile = async (
    accessToken: string,
  ): Promise<ViewerResponse> => {
    const response = await request<{
      Viewer?: {
        id: number;
        name: string;
        avatar?: {
          medium?: string;
          large?: string;
        };
      };
    }>(GET_VIEWER, undefined, accessToken, undefined, false, false);

    return {
      data: {
        Viewer: response.data?.Viewer,
      },
      errors: response.errors,
    };
  };

  // Memoize split context values to minimise downstream re-renders
  const stateContextValue = React.useMemo<AuthStateContextValue>(
    () => ({
      authState,
      isLoading,
      error,
      statusMessage,
      customCredentials,
      isOnline,
      wasOffline,
    }),
    [
      authState,
      isLoading,
      error,
      statusMessage,
      customCredentials,
      isOnline,
      wasOffline,
    ],
  );

  const actionsContextValue = React.useMemo<AuthActionsContextValue>(
    () => ({
      login,
      refreshToken,
      logout,
      cancelAuth,
      setCredentialSource,
      updateCustomCredentials,
      enqueueWhenOnline,
    }),
    [
      login,
      refreshToken,
      logout,
      cancelAuth,
      setCredentialSource,
      updateCustomCredentials,
      enqueueWhenOnline,
    ],
  );

  return (
    <AuthActionsContext.Provider value={actionsContextValue}>
      <AuthStateContext.Provider value={stateContextValue}>
        {children}
      </AuthStateContext.Provider>
    </AuthActionsContext.Provider>
  );
}
