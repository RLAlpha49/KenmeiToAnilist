import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock electron before imports
vi.mock("electron", () => ({
  ipcMain: {
    handle: vi.fn((channel, handler) => {
      // Store in the handlers object
      (globalThis as any).__mockHandlers =
        (globalThis as any).__mockHandlers || {};
      (globalThis as any).__mockHandlers[channel] = handler;
    }),
  },
}));

// Mock Store with inline mock functions
vi.mock("electron-store", () => {
  const mockGet = vi.fn();
  const mockSet = vi.fn();
  const mockDelete = vi.fn();
  const mockClear = vi.fn();

  // Expose the mock functions on the global object for access in tests
  (globalThis as any).__storeMocks = {
    get: mockGet,
    set: mockSet,
    delete: mockDelete,
    clear: mockClear,
  };

  return {
    default: vi.fn().mockImplementation(() => ({
      get: mockGet,
      set: mockSet,
      delete: mockDelete,
      clear: mockClear,
    })),
  };
});

// Import after mocks are set up
import { setupStoreIPC } from "@/helpers/ipc/store/store-setup";
import { ipcMain } from "electron";

describe("store-setup", () => {
  // Store handlers that ipcMain.handle registers
  let mockHandlers: Record<
    string,
    (event: unknown, ...args: unknown[]) => unknown
  >;
  // Get mock store functions
  let mockStoreFunctions: Record<string, ReturnType<typeof vi.fn>>;

  beforeEach(() => {
    // Clear all mocks before each test
    vi.clearAllMocks();

    // Initialize handlers storage
    mockHandlers = (globalThis as any).__mockHandlers || {};
    (globalThis as any).__mockHandlers = {};

    // Get the store mock functions
    mockStoreFunctions = (globalThis as any).__storeMocks;
  });

  describe("setupStoreIPC", () => {
    it("should register all store-related IPC handlers", () => {
      // Act
      setupStoreIPC();

      // Assert - check that the handlers are registered
      expect(ipcMain.handle).toHaveBeenCalledWith(
        "store:getItem",
        expect.any(Function),
      );
      expect(ipcMain.handle).toHaveBeenCalledWith(
        "store:setItem",
        expect.any(Function),
      );
      expect(ipcMain.handle).toHaveBeenCalledWith(
        "store:removeItem",
        expect.any(Function),
      );
      expect(ipcMain.handle).toHaveBeenCalledWith(
        "store:clear",
        expect.any(Function),
      );
    });

    it("should get item from store when getItem handler is called", async () => {
      // Arrange
      const testKey = "testKey";
      const testValue = "testValue";
      mockStoreFunctions.get.mockReturnValue(testValue);
      setupStoreIPC();

      // Act
      const result = await mockHandlers["store:getItem"]({}, testKey);

      // Assert
      expect(mockStoreFunctions.get).toHaveBeenCalledWith(testKey, null);
      expect(result).toBe(testValue);
    });

    it("should handle errors in getItem and return null", async () => {
      // Arrange
      const testKey = "testKey";
      mockStoreFunctions.get.mockImplementation(() => {
        throw new Error("Test error");
      });
      setupStoreIPC();

      // Spy on console.error
      const consoleErrorSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      // Act
      const result = await mockHandlers["store:getItem"]({}, testKey);

      // Assert
      expect(mockStoreFunctions.get).toHaveBeenCalledWith(testKey, null);
      expect(consoleErrorSpy).toHaveBeenCalled();
      expect(result).toBeNull();

      // Restore console.error
      consoleErrorSpy.mockRestore();
    });

    it("should set item in store when setItem handler is called", async () => {
      // Arrange
      const testKey = "testKey";
      const testValue = "testValue";
      setupStoreIPC();

      // Act
      const result = await mockHandlers["store:setItem"](
        {},
        testKey,
        testValue,
      );

      // Assert
      expect(mockStoreFunctions.set).toHaveBeenCalledWith(testKey, testValue);
      expect(result).toBe(true);
    });

    it("should handle errors in setItem and return false", async () => {
      // Arrange
      const testKey = "testKey";
      const testValue = "testValue";
      mockStoreFunctions.set.mockImplementation(() => {
        throw new Error("Test error");
      });
      setupStoreIPC();

      // Spy on console.error
      const consoleErrorSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      // Act
      const result = await mockHandlers["store:setItem"](
        {},
        testKey,
        testValue,
      );

      // Assert
      expect(mockStoreFunctions.set).toHaveBeenCalledWith(testKey, testValue);
      expect(consoleErrorSpy).toHaveBeenCalled();
      expect(result).toBe(false);

      // Restore console.error
      consoleErrorSpy.mockRestore();
    });

    it("should remove item from store when removeItem handler is called", async () => {
      // Arrange
      const testKey = "testKey";
      setupStoreIPC();

      // Act
      const result = await mockHandlers["store:removeItem"]({}, testKey);

      // Assert
      expect(mockStoreFunctions.delete).toHaveBeenCalledWith(testKey);
      expect(result).toBe(true);
    });

    it("should handle errors in removeItem and return false", async () => {
      // Arrange
      const testKey = "testKey";
      mockStoreFunctions.delete.mockImplementation(() => {
        throw new Error("Test error");
      });
      setupStoreIPC();

      // Spy on console.error
      const consoleErrorSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      // Act
      const result = await mockHandlers["store:removeItem"]({}, testKey);

      // Assert
      expect(mockStoreFunctions.delete).toHaveBeenCalledWith(testKey);
      expect(consoleErrorSpy).toHaveBeenCalled();
      expect(result).toBe(false);

      // Restore console.error
      consoleErrorSpy.mockRestore();
    });

    it("should clear store when clear handler is called", async () => {
      // Arrange
      setupStoreIPC();

      // Act
      const result = await mockHandlers["store:clear"]({});

      // Assert
      expect(mockStoreFunctions.clear).toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it("should handle errors in clear and return false", async () => {
      // Arrange
      mockStoreFunctions.clear.mockImplementation(() => {
        throw new Error("Test error");
      });
      setupStoreIPC();

      // Spy on console.error
      const consoleErrorSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      // Act
      const result = await mockHandlers["store:clear"]({});

      // Assert
      expect(mockStoreFunctions.clear).toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalled();
      expect(result).toBe(false);

      // Restore console.error
      consoleErrorSpy.mockRestore();
    });
  });
});
