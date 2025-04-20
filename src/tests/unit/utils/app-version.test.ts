import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getAppVersion, getFormattedAppVersion } from "@/utils/app-version";
import { checkForUpdates } from "@/utils/app-version";

// Mock fetch
global.fetch = vi.fn();

describe("app-version utility", () => {
  // Store original import.meta.env
  const originalEnv = { ...import.meta.env };

  beforeEach(() => {
    // Reset the environment variable before each test
    vi.resetModules();
    // Reset mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Restore original env after each test
    (import.meta.env as any) = originalEnv;
  });

  describe("getAppVersion", () => {
    it("returns version from environment variable if available", () => {
      // Set up mock environment variable
      (import.meta.env as any).VITE_APP_VERSION = "2.3.4";

      // Check that the function returns the expected version
      expect(getAppVersion()).toBe("2.3.4");
    });

    it("returns default version when environment variable is not set", () => {
      // Remove environment variable
      (import.meta.env as any).VITE_APP_VERSION = undefined;

      // Get the actual value returned by the function
      const result = getAppVersion();

      // Check that it returns a string with a version format
      expect(typeof result).toBe("string");
      expect(result).toMatch(/\d+\.\d+\.\d+/);
    });
  });

  describe("getFormattedAppVersion", () => {
    it("returns version with v prefix", () => {
      // Set up mock environment variable
      (import.meta.env as any).VITE_APP_VERSION = "2.3.4";

      // Check that the function returns the expected formatted version
      expect(getFormattedAppVersion()).toBe("v2.3.4");
    });

    it("works with default version when environment variable is not set", () => {
      // Remove environment variable
      (import.meta.env as any).VITE_APP_VERSION = undefined;

      // Get the formatted version
      const result = getFormattedAppVersion();

      // Check that it has the v prefix and a version format
      expect(result.startsWith("v")).toBe(true);
      expect(result).toMatch(/v\d+\.\d+\.\d+/);
    });
  });

  describe("checkForUpdates", () => {
    it("fetches version info from GitHub and returns result when newer version exists", async () => {
      // Save original env
      const originalEnv = process.env.VITE_APP_VERSION;

      // Mock environment variable for current version
      process.env.VITE_APP_VERSION = "1.0.0";

      // Mock fetch response
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          tag_name: "v2.0.0",
          html_url:
            "https://github.com/RLAlpha49/kenmei-to-anilist/releases/tag/v2.0.0",
        }),
      };

      (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

      const result = await checkForUpdates();

      expect(global.fetch).toHaveBeenCalledWith(
        "https://api.github.com/repos/RLAlpha49/kenmei-to-anilist/releases/latest",
      );

      // Verify the structure of the result
      expect(result).toHaveProperty("hasUpdate");
      expect(result).toHaveProperty("latestVersion");
      expect(result).toHaveProperty("releaseUrl");

      // Restore original env
      process.env.VITE_APP_VERSION = originalEnv;
    });

    it("returns no update when current version is the same as latest", async () => {
      // Save original env
      const originalEnv = process.env.VITE_APP_VERSION;

      // Mock environment variable for current version
      process.env.VITE_APP_VERSION = "2.0.0";

      // Mock fetch response
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          tag_name: "v2.0.0",
          html_url:
            "https://github.com/RLAlpha49/kenmei-to-anilist/releases/tag/v2.0.0",
        }),
      };

      (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

      const result = await checkForUpdates();

      // Verify the hasUpdate property is false
      expect(result.hasUpdate).toBe(false);

      // Restore original env
      process.env.VITE_APP_VERSION = originalEnv;
    });

    it("handles fetch errors gracefully", async () => {
      // Mock fetch to throw an error
      (global.fetch as jest.Mock).mockRejectedValue(new Error("Network error"));

      const result = await checkForUpdates();

      // Verify error handling result
      expect(result).toEqual({
        hasUpdate: false,
        latestVersion: "",
        releaseUrl: "",
      });
    });

    it("handles non-200 responses gracefully", async () => {
      // Mock fetch to return non-200 response
      const mockResponse = {
        ok: false,
        status: 404,
      };

      (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

      const result = await checkForUpdates();

      // Verify error handling result
      expect(result).toEqual({
        hasUpdate: false,
        latestVersion: "",
        releaseUrl: "",
      });
    });

    it("handles malformed version strings", async () => {
      // Save original env
      const originalEnv = process.env.VITE_APP_VERSION;

      // Mock environment variable for current version
      process.env.VITE_APP_VERSION = "1.0.0";

      // Mock fetch to return malformed version string
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          tag_name: "latest",
          html_url:
            "https://github.com/RLAlpha49/kenmei-to-anilist/releases/tag/latest",
        }),
      };

      (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

      const result = await checkForUpdates();

      // Verify the handling of malformed version strings
      expect(result.hasUpdate).toBe(false);

      // Restore original env
      process.env.VITE_APP_VERSION = originalEnv;
    });
  });
});
