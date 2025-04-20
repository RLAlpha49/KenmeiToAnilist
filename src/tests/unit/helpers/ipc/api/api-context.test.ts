import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the electron module before imports - using inline mock functions
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
import { exposeApiContext } from "@/helpers/ipc/api/api-context";
import { TokenExchangeParams } from "@/types/api";
import { contextBridge, ipcRenderer } from "electron";

beforeEach(() => {
  // Clear mocks before each test
  vi.clearAllMocks();
});

describe("api-context", () => {
  describe("exposeApiContext", () => {
    it("should expose the electronAPI object correctly", () => {
      // Act
      exposeApiContext();

      // Assert
      // Check if exposeInMainWorld was called with the right name
      expect(contextBridge.exposeInMainWorld).toHaveBeenCalledWith(
        "electronAPI",
        expect.any(Object),
      );

      // Get the exposed API object
      const exposedApi = vi.mocked(contextBridge.exposeInMainWorld).mock
        .calls[0][1];

      // Check that the API object has all the required properties
      expect(exposedApi).toHaveProperty("anilist");
      expect(exposedApi.anilist).toHaveProperty("request");
      expect(exposedApi.anilist).toHaveProperty("exchangeToken");
      expect(exposedApi.anilist).toHaveProperty("clearCache");
      expect(exposedApi.anilist).toHaveProperty("getRateLimitStatus");
      expect(exposedApi).toHaveProperty("shell");
      expect(exposedApi.shell).toHaveProperty("openExternal");
    });

    it("should invoke the correct IPC channels when AniList API methods are called", () => {
      // Arrange
      exposeApiContext();

      // Get the exposed API object
      const exposedApi = vi.mocked(contextBridge.exposeInMainWorld).mock
        .calls[0][1];

      const query = "testQuery";
      const variables = { id: 123 };
      const token = "testToken";

      // Act & Assert - Test each method
      // Test request
      exposedApi.anilist.request(query, variables, token);
      expect(ipcRenderer.invoke).toHaveBeenCalledWith(
        "anilist:request",
        query,
        variables,
        token,
      );

      vi.clearAllMocks();
      // Test exchangeToken
      const params: TokenExchangeParams = {
        clientId: "testId",
        clientSecret: "testSecret",
        redirectUri: "testUri",
        code: "testCode",
      };
      exposedApi.anilist.exchangeToken(params);
      expect(ipcRenderer.invoke).toHaveBeenCalledWith(
        "anilist:exchangeToken",
        params,
      );

      vi.clearAllMocks();
      // Test clearCache
      const searchQuery = "testSearch";
      exposedApi.anilist.clearCache(searchQuery);
      expect(ipcRenderer.invoke).toHaveBeenCalledWith(
        "anilist:clearCache",
        searchQuery,
      );

      vi.clearAllMocks();
      // Test getRateLimitStatus
      exposedApi.anilist.getRateLimitStatus();
      expect(ipcRenderer.invoke).toHaveBeenCalledWith(
        "anilist:getRateLimitStatus",
      );

      vi.clearAllMocks();
      // Test shell.openExternal
      const url = "https://example.com";
      exposedApi.shell.openExternal(url);
      expect(ipcRenderer.invoke).toHaveBeenCalledWith(
        "shell:openExternal",
        url,
      );
    });

    it("should return the result of ipcRenderer.invoke", async () => {
      // Arrange
      const expectedResult = { success: true, data: "test" };
      vi.mocked(ipcRenderer.invoke).mockResolvedValue(expectedResult);
      exposeApiContext();

      // Get the exposed API object
      const exposedApi = vi.mocked(contextBridge.exposeInMainWorld).mock
        .calls[0][1];

      // Act
      const result = await exposedApi.anilist.request("query");

      // Assert
      expect(result).toBe(expectedResult);
      expect(ipcRenderer.invoke).toHaveBeenCalledWith(
        "anilist:request",
        "query",
        undefined,
        undefined,
      );
    });
  });
});
