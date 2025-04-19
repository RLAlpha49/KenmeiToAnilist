import { describe, it, expect, vi, beforeEach } from "vitest";
import { exposeWindowContext } from "@/helpers/ipc/window/window-context";
import {
  WIN_MINIMIZE_CHANNEL,
  WIN_MAXIMIZE_CHANNEL,
  WIN_CLOSE_CHANNEL,
} from "@/helpers/ipc/window/window-channels";

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

describe("window-context", () => {
  describe("exposeWindowContext", () => {
    it("should expose the electronWindow API correctly", () => {
      // Act
      exposeWindowContext();

      // Assert
      // Check if exposeInMainWorld was called with the right name
      expect(mockContextBridge.exposeInMainWorld).toHaveBeenCalledWith(
        "electronWindow",
        expect.any(Object),
      );

      // Get the exposed API object
      const exposedApi = mockContextBridge.exposeInMainWorld.mock.calls[0][1];

      // Check that the API object has the required methods
      expect(exposedApi).toHaveProperty("minimize");
      expect(exposedApi).toHaveProperty("maximize");
      expect(exposedApi).toHaveProperty("close");

      // Simulate calling those methods
      exposedApi.minimize();
      expect(mockIpcRenderer.invoke).toHaveBeenCalledWith(WIN_MINIMIZE_CHANNEL);

      exposedApi.maximize();
      expect(mockIpcRenderer.invoke).toHaveBeenCalledWith(WIN_MAXIMIZE_CHANNEL);

      exposedApi.close();
      expect(mockIpcRenderer.invoke).toHaveBeenCalledWith(WIN_CLOSE_CHANNEL);
    });
  });
});
