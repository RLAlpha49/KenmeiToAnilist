import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the electron module before imports
vi.mock("electron", () => {
  return {
    contextBridge: {
      exposeInMainWorld: vi.fn(),
    },
    ipcRenderer: {
      invoke: vi.fn(),
    },
  };
});

// Import after mocks are set up
import { exposeStoreContext } from "@/helpers/ipc/store/store-context";
import { contextBridge, ipcRenderer } from "electron";

beforeEach(() => {
  // Clear mocks before each test
  vi.clearAllMocks();
});

describe("store-context", () => {
  describe("exposeStoreContext", () => {
    it("should expose the electronStore object correctly", () => {
      // Act
      exposeStoreContext();

      // Assert
      // Check if exposeInMainWorld was called with the right name
      expect(contextBridge.exposeInMainWorld).toHaveBeenCalledWith(
        "electronStore",
        expect.any(Object),
      );

      // Get the exposed API object
      const exposedApi = vi.mocked(contextBridge.exposeInMainWorld).mock
        .calls[0][1];

      // Check that the API object has all the required properties
      expect(exposedApi).toHaveProperty("getItem");
      expect(exposedApi).toHaveProperty("setItem");
      expect(exposedApi).toHaveProperty("removeItem");
      expect(exposedApi).toHaveProperty("clear");
    });

    it("should invoke the correct IPC channels when store methods are called", () => {
      // Arrange
      exposeStoreContext();

      // Get the exposed API object
      const exposedApi = vi.mocked(contextBridge.exposeInMainWorld).mock
        .calls[0][1];

      const testKey = "testKey";
      const testValue = "testValue";

      // Act & Assert - Test each method
      // Test getItem
      exposedApi.getItem(testKey);
      expect(ipcRenderer.invoke).toHaveBeenCalledWith("store:getItem", testKey);

      vi.clearAllMocks();
      // Test setItem
      exposedApi.setItem(testKey, testValue);
      expect(ipcRenderer.invoke).toHaveBeenCalledWith(
        "store:setItem",
        testKey,
        testValue,
      );

      vi.clearAllMocks();
      // Test removeItem
      exposedApi.removeItem(testKey);
      expect(ipcRenderer.invoke).toHaveBeenCalledWith(
        "store:removeItem",
        testKey,
      );

      vi.clearAllMocks();
      // Test clear
      exposedApi.clear();
      expect(ipcRenderer.invoke).toHaveBeenCalledWith("store:clear");
    });

    it("should return the result of ipcRenderer.invoke", async () => {
      // Arrange
      const expectedResult = true;
      vi.mocked(ipcRenderer.invoke).mockResolvedValue(expectedResult);
      exposeStoreContext();

      // Get the exposed API object
      const exposedApi = vi.mocked(contextBridge.exposeInMainWorld).mock
        .calls[0][1];

      // Act
      const result = await exposedApi.getItem("testKey");

      // Assert
      expect(result).toBe(expectedResult);
      expect(ipcRenderer.invoke).toHaveBeenCalledWith(
        "store:getItem",
        "testKey",
      );
    });
  });
});
