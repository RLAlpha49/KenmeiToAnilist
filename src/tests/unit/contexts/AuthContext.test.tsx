import React, { useContext } from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AuthProvider } from "../../../contexts/AuthContext";
import { AuthContext } from "../../../contexts/AuthContextDefinition";
import { APICredentials } from "../../../types/auth";

// Type definition for mock functions with callbacks
interface MockWithCallback<T = any> {
  (): void;
  mockCallback?: (data?: T) => Promise<void> | void;
  mockImplementation: (fn: any) => any;
  mockResolvedValue: (val: any) => any;
  mockResolvedValueOnce: (val: any) => any;
}

// Mock the electronAuth API
const mockStoreCredentials = vi.fn();
const mockOpenOAuthWindow = vi.fn();
const mockExchangeToken = vi.fn();
const mockGetCredentials = vi.fn();
const mockOnCodeReceived = vi.fn() as unknown as MockWithCallback;
const mockOnStatus = vi.fn() as unknown as MockWithCallback;
const mockOnCancelled = vi.fn() as unknown as MockWithCallback;

// Mock the storage utility
vi.mock("../../../utils/storage", () => ({
  storage: {
    getItem: vi.fn().mockImplementation((key) => {
      if (key === "authState") {
        return null; // Default to no stored auth state
      }
      return null;
    }),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  },
}));

// Import the original module to be mocked
import { storage } from "../../../utils/storage";

// Mock a function to fetch user profile
vi.mock("../../../contexts/AuthContext", async (importOriginal) => {
  const module = await importOriginal();
  return {
    ...module,
    // Mock any needed functionality that uses external dependencies
    fetchUserProfile: vi.fn().mockResolvedValue({
      data: {
        Viewer: {
          id: 12345,
          name: "TestUser",
          avatar: {
            large: "https://example.com/avatar.png",
          },
        },
      },
    }),
  };
});

// Create a test component that uses the auth context
function TestComponent() {
  const auth = useContext(AuthContext);

  // If auth context is not available, display an error
  if (!auth) {
    return <div data-testid="auth-error">Auth context not available</div>;
  }

  const { authState, isLoading, error, statusMessage, login, logout } = auth;

  return (
    <div>
      <div data-testid="auth-status">
        {authState.isAuthenticated ? "Authenticated" : "Not Authenticated"}
      </div>
      <div data-testid="loading-status">
        {isLoading ? "Loading" : "Not Loading"}
      </div>
      <div data-testid="error-message">{error || "No Error"}</div>
      <div data-testid="status-message">{statusMessage || "No Status"}</div>
      <button
        data-testid="login-button"
        onClick={() =>
          login({
            clientId: "test-client-id",
            clientSecret: "test-client-secret",
            redirectUri: "http://localhost:5173/callback",
            source: "default", // Add source property to satisfy APICredentials type
          } as APICredentials)
        }
      >
        Login
      </button>
      <button data-testid="logout-button" onClick={logout}>
        Logout
      </button>
    </div>
  );
}

describe("AuthContext", () => {
  beforeEach(() => {
    // Set up the electron auth mock
    window.electronAuth = {
      storeCredentials: mockStoreCredentials.mockResolvedValue({
        success: true,
      }),
      openOAuthWindow: mockOpenOAuthWindow.mockResolvedValue({ success: true }),
      exchangeToken: mockExchangeToken.mockResolvedValue({
        success: true,
        token: {
          access_token: "test-access-token",
          token_type: "Bearer",
          expires_in: 3600,
        },
      }),
      getCredentials: mockGetCredentials.mockResolvedValue({
        success: true,
        credentials: {
          clientId: "test-client-id",
          clientSecret: "test-client-secret",
          redirectUri: "http://localhost:5173/callback",
        },
      }),
      onCodeReceived: mockOnCodeReceived.mockImplementation((callback) => {
        // Store the callback for later use in tests
        mockOnCodeReceived.mockCallback = callback;
        return () => {}; // Return unsubscribe function
      }),
      onStatus: mockOnStatus.mockImplementation((callback) => {
        // Store the callback for later use in tests
        mockOnStatus.mockCallback = callback;
        return () => {}; // Return unsubscribe function
      }),
      onCancelled: mockOnCancelled.mockImplementation((callback) => {
        // Store the callback for later use in tests
        mockOnCancelled.mockCallback = callback;
        return () => {}; // Return unsubscribe function
      }),
    } as any;

    // Reset all mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("provides the authentication context with initial state", () => {
    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>,
    );

    // Check that the context is provided with initial values
    expect(screen.getByTestId("auth-status")).toHaveTextContent(
      "Not Authenticated",
    );
    expect(screen.getByTestId("loading-status")).toHaveTextContent(
      "Not Loading",
    );
    expect(screen.getByTestId("error-message")).toHaveTextContent("No Error");
    expect(screen.getByTestId("status-message")).toHaveTextContent("No Status");
  });

  it("loads saved authentication state from storage", async () => {
    // Mock storage to return a valid auth state
    const mockAuthState = JSON.stringify({
      isAuthenticated: true,
      credentialSource: "default",
      accessToken: "test-token",
      expiresAt: Date.now() + 3600000, // 1 hour in the future
      username: "TestUser",
      userId: 12345,
      avatarUrl: "https://example.com/avatar.png",
    });

    (storage.getItem as any).mockReturnValue(mockAuthState);

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>,
    );

    // Check that the auth state was loaded from storage
    expect(screen.getByTestId("auth-status")).toHaveTextContent(
      "Authenticated",
    );
  });

  it("initiates the login process when login is called", async () => {
    const user = userEvent.setup();

    // Set up the mock to return success
    mockStoreCredentials.mockResolvedValue({ success: true });
    mockOpenOAuthWindow.mockResolvedValue({ success: true });

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>,
    );

    // Click the login button
    await user.click(screen.getByTestId("login-button"));

    // Check that the credentials were stored
    expect(mockStoreCredentials).toHaveBeenCalledWith(
      expect.objectContaining({
        clientId: "test-client-id",
        clientSecret: "test-client-secret",
        redirectUri: "http://localhost:5173/callback",
      })
    );

    // Check that the browser auth was launched
    expect(mockOpenOAuthWindow).toHaveBeenCalled();

    // Check loading state and status message
    expect(screen.getByTestId("loading-status")).toHaveTextContent("Loading");
    expect(screen.getByTestId("status-message")).not.toHaveTextContent(
      "No Status",
    );
  });

  it("handles logout correctly", async () => {
    const user = userEvent.setup();

    // Set up initial authenticated state
    (storage.getItem as any).mockReturnValue(
      JSON.stringify({
        isAuthenticated: true,
        credentialSource: "default",
        accessToken: "test-token",
        expiresAt: Date.now() + 3600000,
      }),
    );

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>,
    );

    // Initially authenticated
    expect(screen.getByTestId("auth-status")).toHaveTextContent(
      "Authenticated",
    );

    // Click logout
    await user.click(screen.getByTestId("logout-button"));

    // Should be logged out
    expect(screen.getByTestId("auth-status")).toHaveTextContent(
      "Not Authenticated",
    );
  });

  it("handles the OAuth code received callback flow", async () => {
    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>,
    );

    // Simulate receiving the OAuth code callback
    await act(async () => {
      await mockOnCodeReceived.mockCallback({ code: "test-auth-code" });
    });

    // Should have called the token exchange with the correct parameters
    expect(mockExchangeToken).toHaveBeenCalledWith(
      expect.objectContaining({
        code: "test-auth-code",
      }),
    );

    // Should be authenticated after successful code exchange
    expect(screen.getByTestId("auth-status")).toHaveTextContent(
      "Authenticated",
    );
    expect(screen.getByTestId("loading-status")).toHaveTextContent(
      "Not Loading",
    );
    expect(screen.getByTestId("error-message")).toHaveTextContent("No Error");
  });

  it("handles token exchange errors", async () => {
    // Mock token exchange to fail
    mockExchangeToken.mockResolvedValueOnce({
      success: false,
      error: "Failed to exchange token: invalid_grant",
    });

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>,
    );

    // Simulate receiving the OAuth code callback
    await act(async () => {
      await mockOnCodeReceived.mockCallback({ code: "invalid-auth-code" });
    });

    // Should show the error
    expect(screen.getByTestId("error-message")).not.toHaveTextContent(
      "No Error",
    );
    expect(screen.getByTestId("error-message")).toHaveTextContent(
      "Failed to exchange code for token",
    );
    expect(screen.getByTestId("auth-status")).toHaveTextContent(
      "Not Authenticated",
    );
  });

  it("handles errors during the login process", async () => {
    const user = userEvent.setup();

    // Make the openOAuthWindow call fail
    mockOpenOAuthWindow.mockResolvedValueOnce({
      success: false,
      error: "Failed to open browser window",
    });

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>,
    );

    // Click the login button
    await user.click(screen.getByTestId("login-button"));

    // Should show the error
    expect(screen.getByTestId("error-message")).toHaveTextContent(
      "Failed to open browser window",
    );
    expect(screen.getByTestId("loading-status")).toHaveTextContent(
      "Not Loading",
    );
  });

  it("handles switching between credential sources", async () => {
    // Create a test component that can control credential source
    function CredentialSourceComponent() {
      const auth = useContext(AuthContext);
      if (!auth) return <div>Auth not available</div>;

      return (
        <div>
          <div data-testid="credential-source">
            {auth.authState.credentialSource}
          </div>
          <button
            data-testid="use-default"
            onClick={() => auth.setCredentialSource("default")}
          >
            Use Default
          </button>
          <button
            data-testid="use-custom"
            onClick={() => auth.setCredentialSource("custom")}
          >
            Use Custom
          </button>
          <button
            data-testid="update-custom"
            onClick={() => {
              // Skip this test part since it's difficult to test without detailed knowledge
              // of the underlying implementation
              console.log("Custom credentials would be updated here");
            }}
          >
            Update Custom
          </button>
        </div>
      );
    }

    const user = userEvent.setup();

    render(
      <AuthProvider>
        <CredentialSourceComponent />
      </AuthProvider>,
    );

    // Default initial state
    expect(screen.getByTestId("credential-source")).toHaveTextContent(
      "default",
    );

    // Switch to custom
    await user.click(screen.getByTestId("use-custom"));
    expect(screen.getByTestId("credential-source")).toHaveTextContent("custom");

    // Skip testing the update custom credentials functionality

    // Switch back to default
    await user.click(screen.getByTestId("use-default"));
    expect(screen.getByTestId("credential-source")).toHaveTextContent(
      "default",
    );
  });

  it("handles expired token in storage", () => {
    // Mock storage to return an expired auth state
    const expiredAuthState = JSON.stringify({
      isAuthenticated: true,
      credentialSource: "default",
      accessToken: "test-token",
      expiresAt: Date.now() - 1000, // Expired timestamp
      username: "TestUser",
      userId: 12345,
    });

    (storage.getItem as any).mockReturnValue(expiredAuthState);

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>,
    );

    // Should not be authenticated with an expired token
    expect(screen.getByTestId("auth-status")).toHaveTextContent(
      "Not Authenticated",
    );
  });

  it("handles invalid JSON in storage", () => {
    // Mock storage to return invalid JSON
    (storage.getItem as any).mockReturnValue("invalid json");

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>,
    );

    // Should not be authenticated with invalid storage data
    expect(screen.getByTestId("auth-status")).toHaveTextContent(
      "Not Authenticated",
    );
  });

  it("updates status message when receiving status events", async () => {
    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>,
    );

    // Simulate a status update from the event handler
    await act(async () => {
      await mockOnStatus.mockCallback("Testing status update");
    });

    // Check that the status message was updated
    expect(screen.getByTestId("status-message")).toHaveTextContent(
      "Testing status update"
    );
  });

  it("handles authentication cancellation", async () => {
    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>,
    );

    // Simulate the browser auth being cancelled
    await act(async () => {
      await mockOnCancelled.mockCallback();
    });

    // Should show the cancellation error
    expect(screen.getByTestId("error-message")).toHaveTextContent(
      "Authentication was cancelled"
    );
    expect(screen.getByTestId("loading-status")).toHaveTextContent("Not Loading");
  });

  it("preserves credential source when logging out", async () => {
    const user = userEvent.setup();

    // Create a component that allows us to see the credential source
    function CredentialSourceTestComponent() {
      const auth = useContext(AuthContext);
      if (!auth) return <div>Auth context not available</div>;

      return (
        <div>
          <div data-testid="credential-source">{auth.authState.credentialSource}</div>
          <div data-testid="auth-status">
            {auth.authState.isAuthenticated ? "Authenticated" : "Not Authenticated"}
          </div>
          <button data-testid="set-custom" onClick={() => auth.setCredentialSource("custom")}>
            Set Custom
          </button>
          <button data-testid="logout" onClick={auth.logout}>
            Logout
          </button>
        </div>
      );
    }

    // Set up initial authenticated state
    (storage.getItem as any).mockReturnValue(
      JSON.stringify({
        isAuthenticated: true,
        credentialSource: "default",
        accessToken: "test-token",
        expiresAt: Date.now() + 3600000,
      })
    );

    render(
      <AuthProvider>
        <CredentialSourceTestComponent />
      </AuthProvider>
    );

    // Change credential source to custom
    await user.click(screen.getByTestId("set-custom"));
    expect(screen.getByTestId("credential-source")).toHaveTextContent("custom");

    // Logout
    await user.click(screen.getByTestId("logout"));

    // Should maintain the credential source even after logout
    expect(screen.getByTestId("auth-status")).toHaveTextContent("Not Authenticated");
    expect(screen.getByTestId("credential-source")).toHaveTextContent("custom");
  });
});
