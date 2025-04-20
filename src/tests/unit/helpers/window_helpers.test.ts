import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  minimizeWindow,
  maximizeWindow,
  closeWindow,
} from "@/helpers/window_helpers";

// Mock the window.electronWindow object
beforeEach(() => {
  // Create mock for electronWindow
  (window as any).electronWindow = {
    minimize: vi.fn().mockResolvedValue(undefined),
    maximize: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
  };
});

afterEach(() => {
  // Clear mocks between tests
  vi.clearAllMocks();

  // Cleanup the mock
  (window as any).electronWindow = undefined;
});

describe("window_helpers", () => {
  describe("minimizeWindow", () => {
    it("should call window.electronWindow.minimize", async () => {
      // Act
      await minimizeWindow();

      // Assert
      expect(window.electronWindow.minimize).toHaveBeenCalledTimes(1);
    });
  });

  describe("maximizeWindow", () => {
    it("should call window.electronWindow.maximize", async () => {
      // Act
      await maximizeWindow();

      // Assert
      expect(window.electronWindow.maximize).toHaveBeenCalledTimes(1);
    });
  });

  describe("closeWindow", () => {
    it("should call window.electronWindow.close", async () => {
      // Act
      await closeWindow();

      // Assert
      expect(window.electronWindow.close).toHaveBeenCalledTimes(1);
    });
  });

  describe("error handling", () => {
    it("should propagate errors from window.electronWindow.minimize", async () => {
      // Arrange
      const error = new Error("Minimize error");
      (window as any).electronWindow.minimize = vi
        .fn()
        .mockRejectedValue(error);

      // Act & Assert
      await expect(minimizeWindow()).rejects.toThrow("Minimize error");
    });

    it("should propagate errors from window.electronWindow.maximize", async () => {
      // Arrange
      const error = new Error("Maximize error");
      (window as any).electronWindow.maximize = vi
        .fn()
        .mockRejectedValue(error);

      // Act & Assert
      await expect(maximizeWindow()).rejects.toThrow("Maximize error");
    });

    it("should propagate errors from window.electronWindow.close", async () => {
      // Arrange
      const error = new Error("Close error");
      (window as any).electronWindow.close = vi.fn().mockRejectedValue(error);

      // Act & Assert
      await expect(closeWindow()).rejects.toThrow("Close error");
    });
  });
});
