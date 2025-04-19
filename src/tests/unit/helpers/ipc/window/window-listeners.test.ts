import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  WIN_MINIMIZE_CHANNEL,
  WIN_MAXIMIZE_CHANNEL,
  WIN_CLOSE_CHANNEL,
} from "@/helpers/ipc/window/window-channels";

// Mock the electron module before any imports
vi.mock("electron", () => ({
  ipcMain: {
    handle: vi.fn((channel, handler) => {
      // Store in the handlers object
      (globalThis as any).__mockHandlers =
        (globalThis as any).__mockHandlers || {};
      (globalThis as any).__mockHandlers[channel] = handler;
    }),
  },
  BrowserWindow: vi.fn(),
}));

// Import modules after mocks are set up
import { ipcMain } from "electron";
import { addWindowEventListeners } from "@/helpers/ipc/window/window-listeners";

describe("window-listeners", () => {
  // Mock mainWindow object
  const mockMainWindow = {
    minimize: vi.fn(),
    maximize: vi.fn(),
    isMaximized: vi.fn(),
    unmaximize: vi.fn(),
    close: vi.fn(),
  };

  // Store handlers that ipcMain.handle registers
  let mockHandlers: Record<
    string,
    (event: unknown, ...args: unknown[]) => unknown
  >;

  beforeEach(() => {
    // Clear all mocks before each test
    vi.clearAllMocks();

    // Initialize handlers storage
    mockHandlers = (globalThis as any).__mockHandlers || {};
    (globalThis as any).__mockHandlers = {};
  });

  describe("addWindowEventListeners", () => {
    it("should register listeners for window events", () => {
      // Act
      addWindowEventListeners(mockMainWindow as any);

      // Assert - check event registration
      expect(ipcMain.handle).toHaveBeenCalledWith(
        WIN_MINIMIZE_CHANNEL,
        expect.any(Function),
      );
      expect(ipcMain.handle).toHaveBeenCalledWith(
        WIN_MAXIMIZE_CHANNEL,
        expect.any(Function),
      );
      expect(ipcMain.handle).toHaveBeenCalledWith(
        WIN_CLOSE_CHANNEL,
        expect.any(Function),
      );
    });

    it("should minimize window when minimize handler is called", async () => {
      // Arrange
      addWindowEventListeners(mockMainWindow as any);

      // Act - call the handler directly from our mockHandlers
      await mockHandlers[WIN_MINIMIZE_CHANNEL]({} as any);

      // Assert
      expect(mockMainWindow.minimize).toHaveBeenCalledTimes(1);
    });

    it("should maximize window when maximize handler is called and window is not maximized", async () => {
      // Arrange
      mockMainWindow.isMaximized.mockReturnValue(false);
      addWindowEventListeners(mockMainWindow as any);

      // Act - call the handler directly
      await mockHandlers[WIN_MAXIMIZE_CHANNEL]({} as any);

      // Assert
      expect(mockMainWindow.isMaximized).toHaveBeenCalledTimes(1);
      expect(mockMainWindow.maximize).toHaveBeenCalledTimes(1);
      expect(mockMainWindow.unmaximize).not.toHaveBeenCalled();
    });

    it("should unmaximize window when maximize handler is called and window is already maximized", async () => {
      // Arrange
      mockMainWindow.isMaximized.mockReturnValue(true);
      addWindowEventListeners(mockMainWindow as any);

      // Act - call the handler directly
      await mockHandlers[WIN_MAXIMIZE_CHANNEL]({} as any);

      // Assert
      expect(mockMainWindow.isMaximized).toHaveBeenCalledTimes(1);
      expect(mockMainWindow.unmaximize).toHaveBeenCalledTimes(1);
      expect(mockMainWindow.maximize).not.toHaveBeenCalled();
    });

    it("should close window when close handler is called", async () => {
      // Arrange
      addWindowEventListeners(mockMainWindow as any);

      // Act - call the handler directly
      await mockHandlers[WIN_CLOSE_CHANNEL]({} as any);

      // Assert
      expect(mockMainWindow.close).toHaveBeenCalledTimes(1);
    });
  });
});
