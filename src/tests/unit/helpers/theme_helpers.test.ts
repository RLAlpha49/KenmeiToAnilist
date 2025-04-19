import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  getCurrentTheme,
  setTheme,
  toggleTheme,
  syncThemeWithLocal,
  updateDocumentTheme,
} from "@/helpers/theme_helpers";
import { storage } from "@/utils/storage";

// Mock the storage module
vi.mock("@/utils/storage", () => ({
  storage: {
    getItem: vi.fn(),
    setItem: vi.fn(),
  },
}));

describe("theme_helpers", () => {
  let addClassMock: any;
  let removeClassMock: any;
  let documentDispatchEventMock: any;
  let originalConsoleError: typeof console.error;

  beforeEach(() => {
    // Save original console.error
    originalConsoleError = console.error;

    // Mock console.error
    console.error = vi.fn();

    // Mock window.themeMode
    (window as any).themeMode = {
      current: vi.fn().mockResolvedValue("light"),
      dark: vi.fn().mockResolvedValue(undefined),
      light: vi.fn().mockResolvedValue(undefined),
      system: vi.fn().mockResolvedValue(false),
    };

    // Mock document methods
    addClassMock = vi.fn();
    removeClassMock = vi.fn();
    documentDispatchEventMock = vi.fn();

    // Set up document.documentElement.classList
    Object.defineProperty(document.documentElement, "classList", {
      value: {
        add: addClassMock,
        remove: removeClassMock,
      },
      configurable: true,
    });

    // Set up document.dispatchEvent
    document.dispatchEvent = documentDispatchEventMock;

    // Clear mock calls
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Restore console.error
    console.error = originalConsoleError;
    vi.resetAllMocks();
  });

  describe("getCurrentTheme", () => {
    it("should return system and local theme", async () => {
      // Arrange
      (window as any).themeMode.current.mockResolvedValueOnce("dark");
      vi.mocked(storage.getItem).mockReturnValueOnce("light");

      // Act
      const result = await getCurrentTheme();

      // Assert
      expect(result).toEqual({
        system: "dark",
        local: "light",
      });
      expect(window.themeMode.current).toHaveBeenCalledTimes(1);
      expect(storage.getItem).toHaveBeenCalledWith("theme");
    });

    it("should handle null local theme", async () => {
      // Arrange
      (window as any).themeMode.current.mockResolvedValueOnce("light");
      vi.mocked(storage.getItem).mockReturnValueOnce(null);

      // Act
      const result = await getCurrentTheme();

      // Assert
      expect(result).toEqual({
        system: "light",
        local: null,
      });
    });
  });

  describe("setTheme", () => {
    it("should set dark theme", async () => {
      // Act
      const result = await setTheme("dark");

      // Assert
      expect(result).toBe(true);
      expect(window.themeMode.dark).toHaveBeenCalledTimes(1);
      expect(storage.setItem).toHaveBeenCalledWith("theme", "dark");
      expect(documentDispatchEventMock).toHaveBeenCalledTimes(1);
      expect(addClassMock).toHaveBeenCalledWith("dark");
    });

    it("should set light theme", async () => {
      // Act
      const result = await setTheme("light");

      // Assert
      expect(result).toBe(false);
      expect(window.themeMode.light).toHaveBeenCalledTimes(1);
      expect(storage.setItem).toHaveBeenCalledWith("theme", "light");
      expect(documentDispatchEventMock).toHaveBeenCalledTimes(1);
      expect(removeClassMock).toHaveBeenCalledWith("dark");
    });

    it("should set system theme (dark)", async () => {
      // Arrange
      (window as any).themeMode.system.mockResolvedValueOnce(true);

      // Act
      const result = await setTheme("system");

      // Assert
      expect(result).toBe(true);
      expect(window.themeMode.system).toHaveBeenCalledTimes(1);
      expect(storage.setItem).toHaveBeenCalledWith("theme", "system");
      expect(documentDispatchEventMock).toHaveBeenCalledTimes(1);
      expect(addClassMock).toHaveBeenCalledWith("dark");
    });

    it("should set system theme (light)", async () => {
      // Arrange
      (window as any).themeMode.system.mockResolvedValueOnce(false);

      // Act
      const result = await setTheme("system");

      // Assert
      expect(result).toBe(false);
      expect(window.themeMode.system).toHaveBeenCalledTimes(1);
      expect(storage.setItem).toHaveBeenCalledWith("theme", "system");
      expect(documentDispatchEventMock).toHaveBeenCalledTimes(1);
      expect(removeClassMock).toHaveBeenCalledWith("dark");
    });
  });

  describe("updateDocumentTheme", () => {
    it("should add dark class when isDarkMode is true", () => {
      // Act
      updateDocumentTheme(true);

      // Assert
      expect(addClassMock).toHaveBeenCalledWith("dark");
      expect(removeClassMock).not.toHaveBeenCalled();
    });

    it("should remove dark class when isDarkMode is false", () => {
      // Act
      updateDocumentTheme(false);

      // Assert
      expect(removeClassMock).toHaveBeenCalledWith("dark");
      expect(addClassMock).not.toHaveBeenCalled();
    });
  });

  describe("toggleTheme", () => {
    it("should toggle from dark to light", async () => {
      // Arrange
      // Mock the dependencies used by toggleTheme
      (window as any).themeMode.current.mockResolvedValueOnce("dark");
      vi.mocked(storage.getItem).mockReturnValueOnce("dark");

      // Since toggleTheme uses setTheme internally, we need to mock window.themeMode.light for it
      (window as any).themeMode.light.mockResolvedValueOnce(undefined);

      // Act
      const result = await toggleTheme();

      // Assert
      expect(window.themeMode.current).toHaveBeenCalledTimes(1);
      expect(storage.getItem).toHaveBeenCalledWith("theme");
      expect(window.themeMode.light).toHaveBeenCalledTimes(1);
      expect(storage.setItem).toHaveBeenCalledWith("theme", "light");
      expect(result).toBe(false);
    });

    it("should toggle from light to dark", async () => {
      // Arrange
      (window as any).themeMode.current.mockResolvedValueOnce("light");
      vi.mocked(storage.getItem).mockReturnValueOnce("light");

      // Since toggleTheme uses setTheme internally, we need to mock window.themeMode.dark for it
      (window as any).themeMode.dark.mockResolvedValueOnce(undefined);

      // Act
      const result = await toggleTheme();

      // Assert
      expect(window.themeMode.current).toHaveBeenCalledTimes(1);
      expect(storage.getItem).toHaveBeenCalledWith("theme");
      expect(window.themeMode.dark).toHaveBeenCalledTimes(1);
      expect(storage.setItem).toHaveBeenCalledWith("theme", "dark");
      expect(result).toBe(true);
    });

    it("should default to dark if local theme is null", async () => {
      // Arrange
      (window as any).themeMode.current.mockResolvedValueOnce("light");
      vi.mocked(storage.getItem).mockReturnValueOnce(null);

      // Since toggleTheme uses setTheme internally, we need to mock window.themeMode.dark for it
      (window as any).themeMode.dark.mockResolvedValueOnce(undefined);

      // Act
      const result = await toggleTheme();

      // Assert
      expect(window.themeMode.current).toHaveBeenCalledTimes(1);
      expect(storage.getItem).toHaveBeenCalledWith("theme");
      expect(window.themeMode.dark).toHaveBeenCalledTimes(1);
      expect(storage.setItem).toHaveBeenCalledWith("theme", "dark");
      expect(result).toBe(true);
    });
  });

  describe("syncThemeWithLocal", () => {
    it("should use local theme if available", async () => {
      // Arrange
      (window as any).themeMode.current.mockResolvedValueOnce("light");
      vi.mocked(storage.getItem).mockReturnValueOnce("dark");

      // Since syncThemeWithLocal uses setTheme internally, we need to mock window.themeMode.dark for it
      (window as any).themeMode.dark.mockResolvedValueOnce(undefined);

      // Act
      await syncThemeWithLocal();

      // Assert
      expect(window.themeMode.current).toHaveBeenCalledTimes(1);
      expect(storage.getItem).toHaveBeenCalledWith("theme");
      expect(window.themeMode.dark).toHaveBeenCalledTimes(1);
      expect(storage.setItem).toHaveBeenCalledWith("theme", "dark");
    });

    it("should use system theme if no local theme", async () => {
      // Arrange
      (window as any).themeMode.current.mockResolvedValueOnce("dark");
      vi.mocked(storage.getItem).mockReturnValueOnce(null);

      // Since syncThemeWithLocal uses setTheme internally, we need to mock window.themeMode.dark for it
      (window as any).themeMode.dark.mockResolvedValueOnce(undefined);

      // Act
      await syncThemeWithLocal();

      // Assert
      expect(window.themeMode.current).toHaveBeenCalledTimes(1);
      expect(storage.getItem).toHaveBeenCalledWith("theme");
      expect(window.themeMode.dark).toHaveBeenCalledTimes(1);
      expect(storage.setItem).toHaveBeenCalledWith("theme", "dark");
    });

    it("should fallback to light theme if system theme is null", async () => {
      // Arrange
      (window as any).themeMode.current.mockResolvedValueOnce(null);
      vi.mocked(storage.getItem).mockReturnValueOnce(null);

      // Since syncThemeWithLocal uses setTheme internally, we need to mock window.themeMode.light for it
      (window as any).themeMode.light.mockResolvedValueOnce(undefined);

      // Act
      await syncThemeWithLocal();

      // Assert
      expect(window.themeMode.current).toHaveBeenCalledTimes(1);
      expect(storage.getItem).toHaveBeenCalledWith("theme");
      expect(window.themeMode.light).toHaveBeenCalledTimes(1);
      expect(storage.setItem).toHaveBeenCalledWith("theme", "light");
    });

    it("should handle errors and fallback to light theme", async () => {
      // Arrange
      const error = new Error("Theme sync error");
      (window as any).themeMode.current.mockRejectedValueOnce(error);

      // Since syncThemeWithLocal uses setTheme internally, we need to mock window.themeMode.light for it
      (window as any).themeMode.light.mockResolvedValueOnce(undefined);

      // Act
      await syncThemeWithLocal();

      // Assert
      expect(window.themeMode.current).toHaveBeenCalledTimes(1);
      expect(console.error).toHaveBeenCalledWith(
        "Failed to sync theme:",
        error,
      );
      expect(window.themeMode.light).toHaveBeenCalledTimes(1);
      expect(storage.setItem).toHaveBeenCalledWith("theme", "light");
    });
  });
});
