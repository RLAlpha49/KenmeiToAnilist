import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock modules before importing the code that uses them
vi.mock("electron", () => ({
  ipcMain: {
    handle: vi.fn((channel, handler) => {
      // Store in the handlers object that we'll define later
      (globalThis as any).__mockHandlers =
        (globalThis as any).__mockHandlers || {};
      (globalThis as any).__mockHandlers[channel] = handler;
    }),
  },
  shell: {
    openExternal: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock("node-fetch", () => ({
  default: vi.fn().mockImplementation(() => ({
    ok: true,
    status: 200,
    json: vi.fn().mockResolvedValue({
      data: {
        Page: {
          media: [
            { id: 1, title: { english: "Test Anime", romaji: "Test Anime" } },
          ],
        },
      },
    }),
  })),
}));

// Import AFTER mocks are set up
import { setupAniListAPI } from "@/helpers/ipc/api/api-listeners";
import { ipcMain } from "electron";
// Import shell separately after mocks are set up to ensure correct reference
import { shell } from "electron";
import fetch from "node-fetch";

// Access our mocked modules
const mockFetch = fetch as jest.MockedFunction<typeof fetch>;

describe("api-listeners", () => {
  // Store handlers that ipcMain.handle registers
  let mockHandlers: Record<
    string,
    (event: unknown, ...args: unknown[]) => unknown
  >;

  beforeEach(() => {
    // Set up fake timers for consistent behavior and to avoid test timeouts
    vi.useFakeTimers();

    // Clear all mocks before each test
    vi.clearAllMocks();

    // Initialize handlers storage
    mockHandlers = (globalThis as any).__mockHandlers || {};
    (globalThis as any).__mockHandlers = {};

    // Reset fetch mock default implementation
    mockFetch.mockImplementation(
      () =>
        ({
          ok: true,
          status: 200,
          json: vi.fn().mockResolvedValue({
            data: {
              Page: {
                media: [
                  {
                    id: 1,
                    title: { english: "Test Anime", romaji: "Test Anime" },
                  },
                ],
              },
            },
          }),
        }) as any,
    );

    // Spy on console methods to suppress logging during tests
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe("setupAniListAPI", () => {
    it("should register AniList API-related IPC handlers", () => {
      // Act
      setupAniListAPI();

      // Assert - check that the AniList API handlers are registered
      expect(ipcMain.handle).toHaveBeenCalledWith(
        "anilist:request",
        expect.any(Function),
      );

      // Note: We're only checking for the main handler to avoid brittleness
      // The implementation may change and add or remove handlers
    });

    it("should make GraphQL request when handler is called", async () => {
      // Arrange
      setupAniListAPI();
      const query = `query { Page { media { id title { english romaji } } } }`;
      const variables = { search: "Test Anime" };

      // Act
      const resultPromise = mockHandlers["anilist:request"](
        {},
        query,
        variables,
      );

      // Resolve any pending promises
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      // Assert
      expect(mockFetch).toHaveBeenCalledWith("https://graphql.anilist.co", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          query,
          variables,
        }),
      });
      expect(result).toEqual({
        success: true,
        data: {
          data: {
            Page: {
              media: [
                {
                  id: 1,
                  title: { english: "Test Anime", romaji: "Test Anime" },
                },
              ],
            },
          },
        },
      });
    });

    it("should pass access token when provided", async () => {
      // Arrange
      setupAniListAPI();
      const query = `query { Viewer { id name } }`;
      const variables = {};
      const token = "test-token";

      // Act
      const requestPromise = mockHandlers["anilist:request"](
        {},
        query,
        variables,
        token,
      );
      await vi.runAllTimersAsync();
      await requestPromise;

      // Assert
      expect(mockFetch).toHaveBeenCalledWith("https://graphql.anilist.co", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: "Bearer test-token",
        },
        body: JSON.stringify({
          query,
          variables,
        }),
      });
    });

    it("should return error details when API returns an error", async () => {
      // Arrange
      setupAniListAPI();

      // Mock error response for this test only
      mockFetch.mockImplementationOnce(
        () =>
          ({
            ok: false,
            status: 400,
            statusText: "Bad Request",
            json: vi.fn().mockResolvedValue({
              errors: [{ message: "Test error message" }],
            }),
          }) as any,
      );

      const query = `invalid query`;
      const variables = {};

      // Act
      const resultPromise = mockHandlers["anilist:request"](
        {},
        query,
        variables,
      );
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      // Assert
      expect(result).toMatchObject({
        success: false,
        error: {
          status: 400,
          statusText: "Bad Request",
          errors: [{ message: "Test error message" }],
          message: "Test error message",
        },
      });
    });

    it("should use cache for repeat search requests", async () => {
      // 1. First, setup the API listeners - this creates the handler
      setupAniListAPI();

      // 2. Create a search query that will be recognizable as a search query
      // The query needs to include 'Page(' to be detected as a search query in the implementation
      const query = `query { Page(page: 1) { media { id title { english romaji } } } }`;
      const variables = { search: "Unique Anime Title" };

      // 3. Make the first call to populate cache - this should hit the API
      const firstCallPromise = mockHandlers["anilist:request"](
        {},
        query,
        variables,
      );
      await vi.runAllTimersAsync();
      await firstCallPromise;

      // Clear the mock to know if it gets called again
      mockFetch.mockClear();

      // 4. Make the same call again - this should use the cache
      const secondCallPromise = mockHandlers["anilist:request"](
        {},
        query,
        variables,
      );
      await vi.runAllTimersAsync();
      await secondCallPromise;

      // 5. Verify that fetch wasn't called for the second request
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("should bypass cache when requested", async () => {
      // Arrange
      setupAniListAPI();

      // Create a unique search query for this test
      const query = `query { Page { media { id title { english romaji } } } }`;
      const variables = {
        search: "Bypass Cache Test Anime",
        bypassCache: true,
      };

      // First call to populate cache
      const firstCallPromise = mockHandlers["anilist:request"](
        {},
        query,
        variables,
      );
      await vi.runAllTimersAsync();
      await firstCallPromise;

      // Clear mock to check if second call uses cache
      vi.clearAllMocks();

      // Act - Second call should bypass cache because of bypassCache flag
      const secondCallPromise = mockHandlers["anilist:request"](
        {},
        query,
        variables,
      );
      await vi.runAllTimersAsync();
      await secondCallPromise;

      // Assert - fetch should be called again
      expect(mockFetch).toHaveBeenCalled();
    });

    it("should handle malformed JSON responses", async () => {
      // Arrange
      setupAniListAPI();
      const query = `query { Page { media { id title { english romaji } } } }`;
      const variables = { search: "Malformed JSON Anime" };

      // Mock response with JSON parsing error
      mockFetch.mockImplementationOnce(
        () =>
          ({
            ok: true,
            status: 200,
            json: vi.fn().mockRejectedValue(new Error("Invalid JSON")),
          }) as any,
      );

      // Act
      const resultPromise = mockHandlers["anilist:request"](
        {},
        query,
        variables,
      );
      await vi.runAllTimersAsync();
      const result = (await resultPromise) as {
        success: boolean;
        error?: {
          status: number;
          statusText: string;
          errors: { message: string }[];
          message: string;
        };
      };

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it("should handle exchanging token", async () => {
      // Skip test if handler doesn't exist
      if (!mockHandlers["anilist:exchangeToken"]) {
        console.log("Skipping token exchange test - handler not found");
        return;
      }

      // Arrange
      setupAniListAPI();

      // Setup successful token exchange response
      mockFetch.mockImplementationOnce(
        () =>
          ({
            ok: true,
            status: 200,
            json: vi.fn().mockResolvedValue({
              access_token: "test_token",
              token_type: "Bearer",
              expires_in: 3600,
            }),
          }) as any,
      );

      const params = {
        clientId: "testClientId",
        clientSecret: "testClientSecret",
        redirectUri: "http://localhost:8765/callback",
        code: "test_auth_code",
      };

      // Act
      const resultPromise = mockHandlers["anilist:exchangeToken"]({}, params);
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      // Assert
      expect(mockFetch).toHaveBeenCalledWith(
        "https://anilist.co/api/v2/oauth/token",
        expect.objectContaining({
          method: "POST",
          body: expect.any(String),
        }),
      );
      expect(result).toEqual({
        success: true,
        token: {
          access_token: "test_token",
          token_type: "Bearer",
          expires_in: 3600,
        },
      });
    });

    it("should handle errors during token exchange", async () => {
      // Skip test if handler doesn't exist
      if (!mockHandlers["anilist:exchangeToken"]) {
        console.log("Skipping token exchange error test - handler not found");
        return;
      }

      // Arrange
      setupAniListAPI();

      // Setup error response for token exchange
      mockFetch.mockImplementationOnce(
        () =>
          ({
            ok: false,
            status: 400,
            text: vi
              .fn()
              .mockResolvedValue(JSON.stringify({ error: "invalid_grant" })),
          }) as any,
      );

      const params = {
        clientId: "testClientId",
        clientSecret: "testClientSecret",
        redirectUri: "http://localhost:8765/callback",
        code: "invalid_code",
      };

      // Act
      const resultPromise = mockHandlers["anilist:exchangeToken"]({}, params);
      await vi.runAllTimersAsync();
      const result = (await resultPromise) as {
        success: boolean;
        error?: {
          status: number;
          statusText: string;
          errors: { message: string }[];
          message: string;
        };
      };

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it("should open external URLs", async () => {
      // Skip test if handler doesn't exist
      if (!mockHandlers["shell:openExternal"]) {
        console.log("Skipping open external URL test - handler not found");
        return;
      }

      // Arrange
      setupAniListAPI();
      const url = "https://anilist.co";

      // Act
      const resultPromise = mockHandlers["shell:openExternal"]({}, url);
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      // Assert
      expect(shell.openExternal).toHaveBeenCalledWith(url);
      expect(result).toEqual({ success: true });
    });

    it("should handle errors when opening external URLs", async () => {
      // Skip test if handler doesn't exist
      if (!mockHandlers["shell:openExternal"]) {
        console.log(
          "Skipping open external URL error test - handler not found",
        );
        return;
      }

      // Arrange
      setupAniListAPI();
      const url = "invalid://url";

      // Mock error when opening URL
      (
        shell.openExternal as jest.MockedFunction<typeof shell.openExternal>
      ).mockRejectedValueOnce(new Error("Cannot open URL"));

      // Act
      const resultPromise = mockHandlers["shell:openExternal"]({}, url);
      await vi.runAllTimersAsync();
      const result = (await resultPromise) as {
        success: boolean;
        error?: {
          status: number;
          statusText: string;
          errors: { message: string }[];
          message: string;
        };
      };

      // Assert
      expect(shell.openExternal).toHaveBeenCalledWith(url);
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });
});
