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
import { storage } from "../utils/storage";
import {
  AuthState,
  APICredentials,
  ViewerResponse,
  AuthContextType,
  AuthStateContextValue,
  AuthActionsContextValue,
} from "../types/auth";
import {
  AuthActionsContext,
  AuthLegacyContext,
  AuthStateContext,
} from "./AuthContextDefinition";
import { DEFAULT_ANILIST_CONFIG } from "../config/anilist";
import { useDebugActions, StateInspectorHandle } from "./DebugContext";

/**
 * Props for the AuthProvider component.
 * @property children - React children to wrap with authentication context.
 * @source
 */
interface AuthProviderProps {
  children: ReactNode;
}

/**
 * Debug snapshot of the authentication context state.
 * @source
 */
interface AuthDebugSnapshot {
  authState: AuthState;
  isLoading: boolean;
  error: string | null;
  statusMessage: string | null;
  isBrowserAuthFlow: boolean;
  customCredentials: APICredentials | null;
}

/**
 * Provides authentication context including state and actions (login, logout, token refresh).
 * Manages OAuth flow, credential storage, and user profile data.
 * @param children - React children to wrap with authentication context.
 * @returns Provider component with split contexts for state and actions.
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
  }));
  getAuthSnapshotRef.current = () => ({
    authState,
    isLoading,
    error,
    statusMessage,
    isBrowserAuthFlow,
    customCredentials,
  });

  const applyAuthDebugSnapshot = useCallback(
    (snapshot: AuthDebugSnapshot) => {
      setAuthState(snapshot.authState);
      setIsLoading(snapshot.isLoading);
      setError(snapshot.error);
      setStatusMessage(snapshot.statusMessage);
      setIsBrowserAuthFlow(snapshot.isBrowserAuthFlow);
      setCustomCredentials(snapshot.customCredentials);
      authSnapshotRef.current = snapshot;
    },
    [
      setAuthState,
      setIsLoading,
      setError,
      setStatusMessage,
      setIsBrowserAuthFlow,
      setCustomCredentials,
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
   * Validates API credentials have required fields.
   * @param credentials - The credentials object to validate.
   * @returns Validated credentials object.
   * @throws If any required field is missing.
   * @source
   */
  const validateCredentials = (credentials: APICredentials) => {
    const { clientId, clientSecret, redirectUri } = credentials;
    if (!clientId || !clientSecret || !redirectUri) {
      toast.error(
        "Credentials incomplete. Please ensure Client ID, Secret & Redirect URI are set.",
      );
      throw new Error(
        "Incomplete credentials: missing clientId, clientSecret or redirectUri",
      );
    }
    return { clientId, clientSecret, redirectUri };
  };

  /**
   * Fetches and updates user profile data from AniList using access token.
   * @param accessToken - The OAuth access token.
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
        recordEvent({
          type: "auth.token-exchange",
          message: `Token exchange failed: ${msg}`,
          level: "error",
          metadata: { error: msg },
        });
        toast.error(msg);
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
  ]);

  // Login function
  const login = useCallback(
    async (credentials: APICredentials) => {
      try {
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
   * Clears authentication state and removes stored credentials.
   * @source
   */
  const logout = useCallback(() => {
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
   * Cancels an in-progress OAuth authentication flow.
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
   * Updates the credential source (default or custom) used for OAuth flow.
   * Prevents switching during active authentication.
   * @param source - The credential source to use.
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
   * Updates the custom API credentials (clientId, clientSecret, redirectUri).
   * @param clientId - The OAuth client ID.
   * @param clientSecret - The OAuth client secret.
   * @param redirectUri - The OAuth redirect URI.
   * @source
   */
  const updateCustomCredentials = useCallback(
    (clientId: string, clientSecret: string, redirectUri: string) => {
      // Only update if values have actually changed
      if (
        !customCredentials ||
        customCredentials.clientId !== clientId ||
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
   * Fetches viewer profile data from AniList GraphQL API.
   * @param accessToken - The OAuth access token.
   * @returns The viewer profile response.
   * @throws If the API request fails.
   * @source
   */
  const fetchUserProfile = async (
    accessToken: string,
  ): Promise<ViewerResponse> => {
    const query = `
      query {
        Viewer {
          id
          name
          avatar {
            large
            medium
          }
        }
      }
    `;

    const response = await fetch("https://graphql.anilist.co", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ query }),
    });

    if (!response.ok) {
      throw new Error(
        `AniList API error: ${response.status} ${response.statusText}`,
      );
    }

    return await response.json();
  };

  // Memoize split context values to minimise downstream re-renders
  const stateContextValue = React.useMemo<AuthStateContextValue>(
    () => ({
      authState,
      isLoading,
      error,
      statusMessage,
      customCredentials,
    }),
    [authState, isLoading, error, statusMessage, customCredentials],
  );

  const actionsContextValue = React.useMemo<AuthActionsContextValue>(
    () => ({
      login,
      refreshToken,
      logout,
      cancelAuth,
      setCredentialSource,
      updateCustomCredentials,
    }),
    [
      login,
      refreshToken,
      logout,
      cancelAuth,
      setCredentialSource,
      updateCustomCredentials,
    ],
  );

  const legacyContextValue = React.useMemo<AuthContextType>(
    () => ({
      ...stateContextValue,
      ...actionsContextValue,
    }),
    [stateContextValue, actionsContextValue],
  );

  return (
    <AuthActionsContext.Provider value={actionsContextValue}>
      <AuthStateContext.Provider value={stateContextValue}>
        <AuthLegacyContext.Provider value={legacyContextValue}>
          {children}
        </AuthLegacyContext.Provider>
      </AuthStateContext.Provider>
    </AuthActionsContext.Provider>
  );
}
