import { describe, it, expect, vi, beforeEach } from "vitest";
import { APICredentials } from "@/types/auth";

// Mock the electron module before imports
vi.mock("electron", () => {
  return {
    contextBridge: {
      exposeInMainWorld: vi.fn(),
    },
    ipcRenderer: {
      invoke: vi.fn(),
      on: vi.fn(),
      removeAllListeners: vi.fn(),
    },
  };
});

// Import after mocks are set up
import { exposeAuthContext } from "@/helpers/ipc/auth/auth-context";
import { contextBridge, ipcRenderer } from "electron";

beforeEach(() => {
  // Clear mocks before each test
  vi.clearAllMocks();
  // Spy on console.log to suppress logs during tests
  vi.spyOn(console, "log").mockImplementation(() => {});
});

describe("auth-context", () => {
  describe("exposeAuthContext", () => {
    it("should expose the electronAuth object correctly", () => {
      // Act
      exposeAuthContext();

      // Assert
      // Check if exposeInMainWorld was called with the right name
      expect(contextBridge.exposeInMainWorld).toHaveBeenCalledWith(
        "electronAuth",
        expect.any(Object),
      );

      // Get the exposed API object
      const exposedApi = vi.mocked(contextBridge.exposeInMainWorld).mock
        .calls[0][1];

      // Check that the API object has all the required properties
      expect(exposedApi).toHaveProperty("openOAuthWindow");
      expect(exposedApi).toHaveProperty("storeCredentials");
      expect(exposedApi).toHaveProperty("getCredentials");
      expect(exposedApi).toHaveProperty("cancelAuth");
      expect(exposedApi).toHaveProperty("exchangeToken");
      expect(exposedApi).toHaveProperty("onCodeReceived");
      expect(exposedApi).toHaveProperty("onCancelled");
      expect(exposedApi).toHaveProperty("onStatus");
    });

    it("should invoke the correct IPC channels when auth methods are called", () => {
      // Arrange
      exposeAuthContext();

      // Get the exposed API object
      const exposedApi = vi.mocked(contextBridge.exposeInMainWorld).mock
        .calls[0][1];

      // Test parameters
      const oauthUrl = "https://example.com/oauth";
      const redirectUri = "https://example.com/callback";
      const credentials: APICredentials = {
        clientId: "testId",
        clientSecret: "testSecret",
        source: "custom",
        redirectUri: "https://example.com/callback",
      };
      const source = "custom";
      const tokenParams = {
        clientId: "testId",
        clientSecret: "testSecret",
        redirectUri: "https://example.com/callback",
        code: "authcode",
      };

      // Act & Assert - Test each method
      // Test openOAuthWindow
      exposedApi.openOAuthWindow(oauthUrl, redirectUri);
      expect(ipcRenderer.invoke).toHaveBeenCalledWith(
        "auth:openOAuthWindow",
        oauthUrl,
        redirectUri,
      );

      vi.clearAllMocks();
      // Test storeCredentials
      exposedApi.storeCredentials(credentials);
      expect(ipcRenderer.invoke).toHaveBeenCalledWith(
        "auth:storeCredentials",
        credentials,
      );

      vi.clearAllMocks();
      // Test getCredentials
      exposedApi.getCredentials(source);
      expect(ipcRenderer.invoke).toHaveBeenCalledWith(
        "auth:getCredentials",
        source,
      );

      vi.clearAllMocks();
      // Test cancelAuth
      exposedApi.cancelAuth();
      expect(ipcRenderer.invoke).toHaveBeenCalledWith("auth:cancel");

      vi.clearAllMocks();
      // Test exchangeToken
      exposedApi.exchangeToken(tokenParams);
      expect(ipcRenderer.invoke).toHaveBeenCalledWith(
        "auth:exchangeToken",
        tokenParams,
      );
    });

    it("should return the result of ipcRenderer.invoke", async () => {
      // Arrange
      const expectedResult = { success: true };
      vi.mocked(ipcRenderer.invoke).mockResolvedValue(expectedResult);
      exposeAuthContext();

      // Get the exposed API object
      const exposedApi = vi.mocked(contextBridge.exposeInMainWorld).mock
        .calls[0][1];

      // Act
      const result = await exposedApi.cancelAuth();

      // Assert
      expect(result).toBe(expectedResult);
      expect(ipcRenderer.invoke).toHaveBeenCalledWith("auth:cancel");
    });

    it("should set up event listeners correctly with onCodeReceived", () => {
      // Arrange
      exposeAuthContext();
      const mockCallback = vi.fn();

      // Get the exposed API object
      const exposedApi = vi.mocked(contextBridge.exposeInMainWorld).mock
        .calls[0][1];

      // Act
      const cleanup = exposedApi.onCodeReceived(mockCallback);

      // Assert
      expect(ipcRenderer.removeAllListeners).toHaveBeenCalledWith(
        "auth:codeReceived",
      );
      expect(ipcRenderer.on).toHaveBeenCalledWith(
        "auth:codeReceived",
        expect.any(Function),
      );

      // Test the callback by simulating an event
      const eventHandler = vi.mocked(ipcRenderer.on).mock.calls[0][1];
      const testData = { code: "testCode" };
      eventHandler({} as any, testData);
      expect(mockCallback).toHaveBeenCalledWith(testData);

      // Test cleanup function
      cleanup();
      expect(ipcRenderer.removeAllListeners).toHaveBeenCalledWith(
        "auth:codeReceived",
      );
    });

    it("should set up event listeners correctly with onCancelled", () => {
      // Arrange
      exposeAuthContext();
      const mockCallback = vi.fn();

      // Get the exposed API object
      const exposedApi = vi.mocked(contextBridge.exposeInMainWorld).mock
        .calls[0][1];

      // Act
      const cleanup = exposedApi.onCancelled(mockCallback);

      // Assert
      expect(ipcRenderer.removeAllListeners).toHaveBeenCalledWith(
        "auth:cancelled",
      );
      expect(ipcRenderer.on).toHaveBeenCalledWith(
        "auth:cancelled",
        expect.any(Function),
      );

      // Test the callback by simulating an event
      const eventHandler = vi.mocked(ipcRenderer.on).mock.calls[0][1];
      eventHandler({} as any);
      expect(mockCallback).toHaveBeenCalled();

      // Test cleanup function
      cleanup();
      expect(ipcRenderer.removeAllListeners).toHaveBeenCalledWith(
        "auth:cancelled",
      );
    });

    it("should set up event listeners correctly with onStatus", () => {
      // Arrange
      exposeAuthContext();
      const mockCallback = vi.fn();

      // Get the exposed API object
      const exposedApi = vi.mocked(contextBridge.exposeInMainWorld).mock
        .calls[0][1];

      // Act
      const cleanup = exposedApi.onStatus(mockCallback);

      // Assert
      expect(ipcRenderer.removeAllListeners).toHaveBeenCalledWith(
        "auth:status",
      );
      expect(ipcRenderer.on).toHaveBeenCalledWith(
        "auth:status",
        expect.any(Function),
      );

      // Test the callback by simulating an event
      const eventHandler = vi.mocked(ipcRenderer.on).mock.calls[0][1];
      const testMessage = "Auth in progress";
      eventHandler({} as any, testMessage);
      expect(mockCallback).toHaveBeenCalledWith(testMessage);

      // Test cleanup function
      cleanup();
      expect(ipcRenderer.removeAllListeners).toHaveBeenCalledWith(
        "auth:status",
      );
    });
  });
});
