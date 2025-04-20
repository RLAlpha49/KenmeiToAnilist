import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import * as React from "react";
import { useAuth } from "@/hooks/useAuth";
import { AuthContext } from "@/contexts/AuthContextDefinition";
import { AuthContextType } from "@/types/auth";

describe("useAuth", () => {
  it("returns authentication values from context", () => {
    // Create a mock context value
    const mockAuthContext: AuthContextType = {
      authState: {
        isAuthenticated: true,
        userId: 12345,
        username: "TestUser",
        avatarUrl: "https://example.com/avatar.png",
        credentialSource: "default",
        expiresAt: Date.now() + 3600000,
      },
      login: vi.fn(),
      logout: vi.fn(),
      isLoading: false,
      error: null,
      statusMessage: null,
      setCredentialSource: vi.fn(),
      updateCustomCredentials: vi.fn(),
      customCredentials: null,
    };

    // Create a wrapper component
    const Wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
      <AuthContext.Provider value={mockAuthContext}>
        {children}
      </AuthContext.Provider>
    );

    // Render the hook with the context provider wrapper
    const { result } = renderHook(() => useAuth(), { wrapper: Wrapper });

    // Verify the returned values match our mock
    expect(result.current.authState.isAuthenticated).toBe(true);
    expect(result.current.authState.userId).toBe(12345);
    expect(result.current.authState.username).toBe("TestUser");
    expect(result.current.login).toBe(mockAuthContext.login);
    expect(result.current.logout).toBe(mockAuthContext.logout);
  });

  it("throws error when used outside of AuthProvider", () => {
    // Testing the error case when no context value is available
    // We expect the hook to throw an error
    expect(() => {
      renderHook(() => useAuth());
    }).toThrow("useAuth must be used within an AuthProvider");
  });
});
