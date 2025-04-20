import React, { useState, useEffect, ReactNode, useRef } from "react";
import { storage } from "../utils/storage";
import {
  AuthState,
  APICredentials,
  ViewerResponse,
  AuthContextType,
} from "../types/auth";
import { AuthContext } from "./AuthContextDefinition";

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
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

  // Update storage only when state meaningfully changes
  useEffect(() => {
    const serializedState = JSON.stringify(authState);
    // Only update storage if the state has actually changed
    if (serializedState !== prevAuthStateRef.current) {
      prevAuthStateRef.current = serializedState;
      storage.setItem("authState", serializedState);
    }
  }, [authState]);

  // Set up the code received listener
  useEffect(() => {
    // Only set up the listener if window.electronAuth is available
    if (!window.electronAuth?.onCodeReceived) return;

    const unsubscribe = window.electronAuth.onCodeReceived(async (data) => {
      try {
        // We received the code, so the browser flow is now complete
        setIsBrowserAuthFlow(false);
        setIsLoading(true);
        setError(null);
        setStatusMessage(
          "Authorization code received! Exchanging for token...",
        );

        // Get the current credentials being used
        const credentialsResponse = await window.electronAuth.getCredentials(
          authState.credentialSource,
        );

        if (!credentialsResponse.success || !credentialsResponse.credentials) {
          throw new Error(
            credentialsResponse.error || "Failed to get credentials",
          );
        }

        const { clientId, clientSecret, redirectUri } =
          credentialsResponse.credentials;

        console.log("Exchanging auth code for token with credentials:", {
          clientId: clientId.substring(0, 4) + "...",
          redirectUri,
          codeLength: data.code.length,
          codeStart: data.code.substring(0, 10) + "...",
        });

        // Exchange the code for an access token
        try {
          setStatusMessage("Exchanging auth code for token...");

          // Use the main process token exchange instead of direct fetch
          // This avoids network issues in the renderer process
          const tokenExchangeResult = await window.electronAuth.exchangeToken({
            clientId,
            clientSecret,
            redirectUri,
            code: data.code,
          });

          if (!tokenExchangeResult.success || !tokenExchangeResult.token) {
            throw new Error(
              tokenExchangeResult.error || "Failed to exchange token",
            );
          }

          const tokenResponse = tokenExchangeResult.token;

          // Now TypeScript knows tokenResponse is defined
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
          try {
            const userProfile = await fetchUserProfile(
              tokenResponse.access_token,
            );

            if (userProfile && userProfile.data && userProfile.data.Viewer) {
              const viewer = userProfile.data.Viewer;

              // Update auth state with user profile data
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
              console.warn("User profile data incomplete:", userProfile);
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

          // Clear any errors
          setError(null);
        } catch (tokenError) {
          console.error("Token exchange error:", tokenError);
          throw new Error(
            tokenError instanceof Error
              ? `Failed to exchange code for token: ${tokenError.message}`
              : "Failed to exchange code for token",
          );
        }

        setIsLoading(false);
      } catch (err: unknown) {
        console.error("Authentication error:", err);
        setError(err instanceof Error ? err.message : "Authentication failed");
        setStatusMessage(null);
        setIsLoading(false);
        setIsBrowserAuthFlow(false);
      }
    });

    // Clean up the listener on unmount
    return unsubscribe;
  }, [authState.credentialSource]);

  // Set up the status message listener
  useEffect(() => {
    // Only set up the listener if window.electronAuth is available
    if (!window.electronAuth?.onStatus) return;

    const unsubscribe = window.electronAuth.onStatus((message) => {
      setStatusMessage(message);
    });

    // Clean up the listener on unmount
    return unsubscribe;
  }, []);

  // Set up the cancellation listener
  useEffect(() => {
    // Only set up the listener if window.electronAuth is available
    if (!window.electronAuth?.onCancelled) return;

    const unsubscribe = window.electronAuth.onCancelled(() => {
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
        await window.electronAuth.storeCredentials(credentials);
      if (!storeResult.success) {
        throw new Error(storeResult.error || "Failed to store credentials");
      }

      // Generate the OAuth URL
      const clientId = encodeURIComponent(credentials.clientId);
      const encodedRedirectUri = encodeURIComponent(redirectUri);
      const oauthUrl = `https://anilist.co/api/v2/oauth/authorize?client_id=${clientId}&redirect_uri=${encodedRedirectUri}&response_type=code`;

      setStatusMessage("Opening authentication window...");

      // Open the OAuth window
      try {
        const result = await window.electronAuth.openOAuthWindow(
          oauthUrl,
          redirectUri,
        );

        if (!result.success) {
          throw new Error(
            result.error || "Failed to open authentication window",
          );
        }
      } catch (err) {
        if (!isBrowserAuthFlow) {
          console.error("Login window error:", err);
          setError(
            err instanceof Error
              ? err.message
              : "Failed to open authentication window",
          );
          setStatusMessage(null);
          setIsLoading(false);
          setIsBrowserAuthFlow(false);
        } else {
          console.log(
            "Browser auth flow in progress - ignoring window.close error...",
          );
        }
      }

      // The rest of the authentication process happens in the code received listener
    } catch (err: unknown) {
      console.error("Login error:", err);
      setError(err instanceof Error ? err.message : "Login failed");
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
  };

  // Set credential source
  const setCredentialSource = (source: "default" | "custom") => {
    // Only update if the source actually changed
    if (source !== authState.credentialSource) {
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

  // Create the context value
  const contextValue: AuthContextType = {
    authState,
    login,
    logout,
    isLoading,
    error,
    statusMessage,
    setCredentialSource,
    updateCustomCredentials,
    customCredentials,
  };

  return (
    <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>
  );
}
