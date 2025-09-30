/**
 * @packageDocumentation
 * @module AuthContext
 * @description React context provider for authentication state and actions, including login, logout, and credential management.
 */

import React, { useState, useEffect, ReactNode, useRef } from "react";
import { toast } from "sonner";
import { storage } from "../utils/storage";
import {
  AuthState,
  APICredentials,
  ViewerResponse,
  AuthContextType,
} from "../types/auth";
import { AuthContext } from "./AuthContextDefinition";

/**
 * Props for the AuthProvider component.
 *
 * @property children - The React children to be wrapped by the provider.
 * @source
 */
interface AuthProviderProps {
  children: ReactNode;
}

/**
 * Provides authentication context to its children, managing authentication state and actions.
 *
 * @param children - The React children to be wrapped by the provider.
 * @returns The authentication context provider with value for consumers.
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
        console.error("Failed to parse stored auth state:", err);
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

  // Update storage only when state meaningfully changes
  useEffect(() => {
    const serializedState = JSON.stringify(authState);
    // Only update storage if the state has actually changed
    if (serializedState !== prevAuthStateRef.current) {
      prevAuthStateRef.current = serializedState;
      storage.setItem("authState", serializedState);
    }
  }, [authState]);

  // Helper function to validate credentials
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

  // Helper function to handle user profile fetching
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
      } else {
        throw new Error("Failed to retrieve user profile");
      }
    } catch (profileError) {
      console.error("Profile fetch error:", profileError);
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
          console.warn("Stale auth code event ignored (attempt id mismatch)");
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

        console.log("Exchanging auth code for token with credentials:", {
          clientId: clientId.substring(0, 4) + "...",
          redirectUri,
          codeLength: data.code.length,
          codeStart: data.code.substring(0, 10) + "...",
        });

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
            "Discarding token from stale auth attempt (attempt id changed)",
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
        console.log("Token received:", {
          expires_in: tokenResponse.expires_in,
          token_type: tokenResponse.token_type,
          token_length: tokenResponse.access_token.length,
          token_start: tokenResponse.access_token.substring(0, 5) + "...",
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
        console.error("Authentication error:", err);
        toast.error(
          err instanceof Error ? err.message : "Authentication failed",
        );
        setError(err instanceof Error ? err.message : "Authentication failed");
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

  // Login function
  const login = async (credentials: APICredentials) => {
    try {
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
        if (isBrowserAuthFlow) {
          console.log(
            "Browser auth flow in progress - ignoring globalThis.close error...",
          );
        } else {
          console.error("Login window error:", err);
          const msg =
            err instanceof Error
              ? err.message
              : "Failed to open authentication window";
          toast.error(msg);
          setError(msg);
          setStatusMessage(null);
          setIsLoading(false);
          setIsBrowserAuthFlow(false);
        }
      }

      // The rest of the authentication process happens in the code received listener
    } catch (err: unknown) {
      console.error("Login error:", err);
      const msg = err instanceof Error ? err.message : "Login failed";
      toast.error(msg);
      setError(msg);
      setStatusMessage(null);
      setIsLoading(false);
      setIsBrowserAuthFlow(false);
    }
  };

  // Logout function
  const logout = () => {
    storage.removeItem("authState");
    // Clear the previous state reference when logging out
    prevAuthStateRef.current = "";
    setAuthState({
      isAuthenticated: false,
      credentialSource: authState.credentialSource,
    });
    setStatusMessage(null);
    lockedCredentialSourceRef.current = null;
  };

  const cancelAuth = async () => {
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
      console.error("Cancel auth error:", err);
      toast.error(message);
    }
  };

  // Set credential source
  const setCredentialSource = (source: "default" | "custom") => {
    // Only update if the source actually changed
    if (source !== authState.credentialSource) {
      // Prevent switching source during an active OAuth browser flow
      if (isBrowserAuthFlow) {
        console.warn(
          "Credential source change ignored during active auth flow",
        );
        return;
      }
      setAuthState((prevState) => ({
        ...prevState,
        credentialSource: source,
      }));
    }
  };

  // Update custom credentials
  const updateCustomCredentials = (
    clientId: string,
    clientSecret: string,
    redirectUri: string,
  ) => {
    // Only update if values have actually changed
    if (
      !customCredentials ||
      customCredentials.clientId !== clientId ||
      customCredentials.clientSecret !== clientSecret ||
      customCredentials.redirectUri !== redirectUri
    ) {
      setCustomCredentials({
        source: "custom",
        clientId,
        clientSecret,
        redirectUri,
      });
    }
  };

  // Function to fetch user profile from AniList
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

  // Create the context value, memoized to avoid unnecessary re-renders
  const contextValue: AuthContextType = React.useMemo(
    () => ({
      authState,
      login,
      logout,
      cancelAuth,
      isLoading,
      error,
      statusMessage,
      setCredentialSource,
      updateCustomCredentials,
      customCredentials,
    }),
    [
      authState,
      login,
      logout,
      cancelAuth,
      isLoading,
      error,
      statusMessage,
      setCredentialSource,
      updateCustomCredentials,
      customCredentials,
    ],
  );

  return (
    <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>
  );
}
