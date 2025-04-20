import { describe, it, expect, vi, beforeEach } from "vitest";
import registerListeners from "@/helpers/ipc/listeners-register";
import { addWindowEventListeners } from "@/helpers/ipc/window/window-listeners";
import { addThemeEventListeners } from "@/helpers/ipc/theme/theme-listeners";
import { addAuthEventListeners } from "@/helpers/ipc/auth/auth-listeners";
import { setupStoreIPC } from "@/helpers/ipc/store/store-setup";
import { setupAniListAPI } from "@/helpers/ipc/api/api-listeners";

// Mock all the listener setup functions
vi.mock("@/helpers/ipc/window/window-listeners", () => ({
  addWindowEventListeners: vi.fn(),
}));

vi.mock("@/helpers/ipc/theme/theme-listeners", () => ({
  addThemeEventListeners: vi.fn(),
}));

vi.mock("@/helpers/ipc/auth/auth-listeners", () => ({
  addAuthEventListeners: vi.fn(),
}));

vi.mock("@/helpers/ipc/store/store-setup", () => ({
  setupStoreIPC: vi.fn(),
}));

vi.mock("@/helpers/ipc/api/api-listeners", () => ({
  setupAniListAPI: vi.fn(),
}));

describe("listeners-register", () => {
  // Mock BrowserWindow object
  const mockMainWindow = {
    id: 1,
    webContents: {
      id: 1,
    },
  };

  beforeEach(() => {
    // Clear all mocks before each test
    vi.clearAllMocks();
  });

  describe("registerListeners", () => {
    it("should call all listener setup functions", () => {
      // Act
      registerListeners(mockMainWindow as any);

      // Assert
      expect(addWindowEventListeners).toHaveBeenCalledTimes(1);
      expect(addThemeEventListeners).toHaveBeenCalledTimes(1);
      expect(addAuthEventListeners).toHaveBeenCalledTimes(1);
      expect(setupStoreIPC).toHaveBeenCalledTimes(1);
      expect(setupAniListAPI).toHaveBeenCalledTimes(1);
    });

    it("should pass the main window to the appropriate listeners", () => {
      // Act
      registerListeners(mockMainWindow as any);

      // Assert
      expect(addWindowEventListeners).toHaveBeenCalledWith(mockMainWindow);
      expect(addAuthEventListeners).toHaveBeenCalledWith(mockMainWindow);
    });

    it("should not pass main window to listeners that don't need it", () => {
      // Act
      registerListeners(mockMainWindow as any);

      // Assert
      expect(addThemeEventListeners).toHaveBeenCalledWith();
      expect(setupStoreIPC).toHaveBeenCalledWith();
      expect(setupAniListAPI).toHaveBeenCalledWith();
    });

    it("should call listener functions in the correct order", () => {
      // Setup call tracking
      const calls: string[] = [];

      vi.mocked(addWindowEventListeners).mockImplementation(() => {
        calls.push("window");
      });

      vi.mocked(addThemeEventListeners).mockImplementation(() => {
        calls.push("theme");
      });

      vi.mocked(addAuthEventListeners).mockImplementation(() => {
        calls.push("auth");
      });

      vi.mocked(setupStoreIPC).mockImplementation(() => {
        calls.push("store");
      });

      vi.mocked(setupAniListAPI).mockImplementation(() => {
        calls.push("api");
      });

      // Act
      registerListeners(mockMainWindow as any);

      // Assert
      expect(calls).toEqual(["window", "theme", "auth", "store", "api"]);
    });

    it("should continue registering remaining listeners even if one fails", () => {
      // Arrange - make one function throw an error
      vi.mocked(addThemeEventListeners).mockImplementation(() => {
        throw new Error("Theme event listeners setup failed");
      });

      // Act & Assert
      expect(() => registerListeners(mockMainWindow as any)).toThrow(
        "Theme event listeners setup failed",
      );

      // Window should be called before theme
      expect(addWindowEventListeners).toHaveBeenCalledTimes(1);

      // Auth, store, and API should not be called as the error stops execution
      expect(addAuthEventListeners).not.toHaveBeenCalled();
      expect(setupStoreIPC).not.toHaveBeenCalled();
      expect(setupAniListAPI).not.toHaveBeenCalled();
    });
  });
});
