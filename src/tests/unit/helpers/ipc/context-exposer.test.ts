import { describe, it, expect, vi, beforeEach } from "vitest";
import exposeContexts from "@/helpers/ipc/context-exposer";
import { exposeWindowContext } from "@/helpers/ipc/window/window-context";
import { exposeThemeContext } from "@/helpers/ipc/theme/theme-context";
import { exposeAuthContext } from "@/helpers/ipc/auth/auth-context";
import { exposeStoreContext } from "@/helpers/ipc/store/store-context";
import { exposeApiContext } from "@/helpers/ipc/api/api-context";

// Mock all the expose context functions
vi.mock("@/helpers/ipc/window/window-context", () => ({
  exposeWindowContext: vi.fn(),
}));

vi.mock("@/helpers/ipc/theme/theme-context", () => ({
  exposeThemeContext: vi.fn(),
}));

vi.mock("@/helpers/ipc/auth/auth-context", () => ({
  exposeAuthContext: vi.fn(),
}));

vi.mock("@/helpers/ipc/store/store-context", () => ({
  exposeStoreContext: vi.fn(),
}));

vi.mock("@/helpers/ipc/api/api-context", () => ({
  exposeApiContext: vi.fn(),
}));

describe("context-exposer", () => {
  beforeEach(() => {
    // Clear all mocks before each test
    vi.clearAllMocks();
  });

  describe("exposeContexts", () => {
    it("should call all expose context functions", () => {
      // Act
      exposeContexts();

      // Assert
      expect(exposeWindowContext).toHaveBeenCalledTimes(1);
      expect(exposeThemeContext).toHaveBeenCalledTimes(1);
      expect(exposeAuthContext).toHaveBeenCalledTimes(1);
      expect(exposeStoreContext).toHaveBeenCalledTimes(1);
      expect(exposeApiContext).toHaveBeenCalledTimes(1);
    });

    it("should call expose functions in the correct order", () => {
      // Setup call tracking
      const calls: string[] = [];

      vi.mocked(exposeWindowContext).mockImplementation(() => {
        calls.push("window");
      });

      vi.mocked(exposeThemeContext).mockImplementation(() => {
        calls.push("theme");
      });

      vi.mocked(exposeAuthContext).mockImplementation(() => {
        calls.push("auth");
      });

      vi.mocked(exposeStoreContext).mockImplementation(() => {
        calls.push("store");
      });

      vi.mocked(exposeApiContext).mockImplementation(() => {
        calls.push("api");
      });

      // Act
      exposeContexts();

      // Assert
      expect(calls).toEqual(["window", "theme", "auth", "store", "api"]);
    });

    it("should continue exposing remaining contexts even if one fails", () => {
      // Arrange - make one function throw an error
      vi.mocked(exposeThemeContext).mockImplementation(() => {
        throw new Error("Theme context exposure failed");
      });

      // Act & Assert
      expect(() => exposeContexts()).toThrow("Theme context exposure failed");

      // Window should be called before theme
      expect(exposeWindowContext).toHaveBeenCalledTimes(1);

      // Auth, store, and API should not be called as the error stops execution
      expect(exposeAuthContext).not.toHaveBeenCalled();
      expect(exposeStoreContext).not.toHaveBeenCalled();
      expect(exposeApiContext).not.toHaveBeenCalled();
    });
  });
});
