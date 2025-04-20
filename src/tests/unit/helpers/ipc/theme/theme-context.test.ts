import { describe, it, expect, vi, beforeEach } from "vitest";
import { exposeThemeContext } from "@/helpers/ipc/theme/theme-context";
import {
  THEME_MODE_CURRENT_CHANNEL,
  THEME_MODE_DARK_CHANNEL,
  THEME_MODE_LIGHT_CHANNEL,
  THEME_MODE_SYSTEM_CHANNEL,
  THEME_MODE_TOGGLE_CHANNEL,
} from "@/helpers/ipc/theme/theme-channels";

// Mock Electron's contextBridge and ipcRenderer
const mockIpcRenderer = {
  invoke: vi.fn(),
};

const mockContextBridge = {
  exposeInMainWorld: vi.fn(),
};

// Setup window.require mock
beforeEach(() => {
  // Clear mocks before each test
  vi.clearAllMocks();

  // Create mock for window.require
  (window as any).require = vi.fn().mockReturnValue({
    contextBridge: mockContextBridge,
    ipcRenderer: mockIpcRenderer,
  });
});

describe("theme-context", () => {
  describe("exposeThemeContext", () => {
    it("should expose the themeMode API correctly", () => {
      // Act
      exposeThemeContext();

      // Assert
      // Check if exposeInMainWorld was called with the right name
      expect(mockContextBridge.exposeInMainWorld).toHaveBeenCalledWith(
        "themeMode",
        expect.any(Object),
      );

      // Get the exposed API object
      const exposedApi = mockContextBridge.exposeInMainWorld.mock.calls[0][1];

      // Check that the API object has all the required methods
      expect(exposedApi).toHaveProperty("current");
      expect(exposedApi).toHaveProperty("toggle");
      expect(exposedApi).toHaveProperty("dark");
      expect(exposedApi).toHaveProperty("light");
      expect(exposedApi).toHaveProperty("system");
    });

    it("should invoke the correct IPC channels when APIs are called", () => {
      // Arrange
      exposeThemeContext();

      // Get the exposed API object
      const exposedApi = mockContextBridge.exposeInMainWorld.mock.calls[0][1];

      // Act & Assert - Test each method
      exposedApi.current();
      expect(mockIpcRenderer.invoke).toHaveBeenCalledWith(
        THEME_MODE_CURRENT_CHANNEL,
      );

      vi.clearAllMocks();
      exposedApi.toggle();
      expect(mockIpcRenderer.invoke).toHaveBeenCalledWith(
        THEME_MODE_TOGGLE_CHANNEL,
      );

      vi.clearAllMocks();
      exposedApi.dark();
      expect(mockIpcRenderer.invoke).toHaveBeenCalledWith(
        THEME_MODE_DARK_CHANNEL,
      );

      vi.clearAllMocks();
      exposedApi.light();
      expect(mockIpcRenderer.invoke).toHaveBeenCalledWith(
        THEME_MODE_LIGHT_CHANNEL,
      );

      vi.clearAllMocks();
      exposedApi.system();
      expect(mockIpcRenderer.invoke).toHaveBeenCalledWith(
        THEME_MODE_SYSTEM_CHANNEL,
      );
    });

    it("should return the result of ipcRenderer.invoke", async () => {
      // Arrange
      const expectedResult = "dark";
      mockIpcRenderer.invoke.mockResolvedValue(expectedResult);
      exposeThemeContext();

      // Get the exposed API object
      const exposedApi = mockContextBridge.exposeInMainWorld.mock.calls[0][1];

      // Act
      const result = await exposedApi.current();

      // Assert
      expect(result).toBe(expectedResult);
      expect(mockIpcRenderer.invoke).toHaveBeenCalledWith(
        THEME_MODE_CURRENT_CHANNEL,
      );
    });
  });
});
