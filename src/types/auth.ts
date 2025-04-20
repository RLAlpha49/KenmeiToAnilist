// Auth state interface
export interface AuthState {
  isAuthenticated: boolean;
  username?: string;
  avatarUrl?: string;
  userId?: number;
  accessToken?: string;
  expiresAt?: number;
  credentialSource: "default" | "custom";
}

// API credentials interface
export interface APICredentials {
  source: "default" | "custom";
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

// Token exchange response type
export interface TokenExchangeResponse {
  success: boolean;
  token?: {
    access_token: string;
    token_type: string;
    expires_in: number;
  };
  error?: string;
}

// AniList viewer query response type
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

// Auth context type
export interface AuthContextType {
  authState: AuthState;
  login: (credentials: APICredentials) => Promise<void>;
  logout: () => void;
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
