/**
 * @packageDocumentation
 * @module auth-types
 * @description TypeScript types and interfaces for authentication state, credentials, and context in the application.
 */

/**
 * Represents the authentication state for a user session.
 *
 * @property isAuthenticated - Whether the user is authenticated.
 * @property username - The username of the authenticated user.
 * @property avatarUrl - The URL of the user's avatar image.
 * @property userId - The user's unique identifier.
 * @property accessToken - The OAuth access token.
 * @property expiresAt - The expiration timestamp for the access token.
 * @property credentialSource - The source of the credentials (default or custom).
 * @source
 */
export interface AuthState {
  isAuthenticated: boolean;
  username?: string;
  avatarUrl?: string;
  userId?: number;
  accessToken?: string;
  expiresAt?: number;
  credentialSource: "default" | "custom";
}

/**
 * Represents API credentials for authentication.
 *
 * @property source - The credential source (default or custom).
 * @property clientId - The client ID for the API.
 * @property clientSecret - The client secret for the API.
 * @property redirectUri - The redirect URI for OAuth.
 * @source
 */
export interface APICredentials {
  source: "default" | "custom";
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

/**
 * Represents the response from a token exchange request.
 *
 * @property success - Whether the token exchange was successful.
 * @property token - The token object if successful.
 * @property error - The error message if unsuccessful.
 * @source
 */
export interface TokenExchangeResponse {
  success: boolean;
  token?: {
    access_token: string;
    token_type: string;
    expires_in: number;
  };
  error?: string;
}

/**
 * Represents the response from an AniList viewer query.
 *
 * @property data - The viewer data if successful.
 * @property errors - An array of error messages if unsuccessful.
 * @source
 */
export interface ViewerResponse {
  data?: {
    Viewer?: {
      id: number;
      name: string;
      avatar?: {
        medium?: string;
        large?: string;
      };
    };
  };
  errors?: Array<{
    message: string;
  }>;
}

/**
 * Represents the authentication context type for React context providers.
 *
 * @property authState - The current authentication state.
 * @property login - Function to log in with credentials.
 * @property refreshToken - Function to refresh the authentication token.
 * @property logout - Function to log out the user.
 * @property cancelAuth - Function to cancel an in-progress authentication flow.
 * @property isLoading - Whether an authentication operation is in progress.
 * @property error - The current authentication error message, if any.
 * @property statusMessage - The current status message, if any.
 * @property setCredentialSource - Function to set the credential source.
 * @property updateCustomCredentials - Function to update custom credentials.
 * @property customCredentials - The current custom credentials, if any.
 * @source
 */
export interface AuthContextType {
  authState: AuthState;
  login: (credentials: APICredentials) => Promise<void>;
  refreshToken: () => Promise<void>;
  logout: () => void;
  cancelAuth: () => Promise<void>;
  isLoading: boolean;
  error: string | null;
  statusMessage: string | null;
  setCredentialSource: (source: "default" | "custom") => void;
  updateCustomCredentials: (
    clientId: string,
    clientSecret: string,
    redirectUri: string,
  ) => void;
  customCredentials: APICredentials | null;
}
