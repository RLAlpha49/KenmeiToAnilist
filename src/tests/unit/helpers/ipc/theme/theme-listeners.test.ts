import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the electron module before any imports
vi.mock("electron", () => ({
  ipcMain: {
    handle: vi.fn(),
  },
  nativeTheme: {
    themeSource: "system",
    shouldUseDarkColors: false,
    on: vi.fn(),
  },
}));

// Now import after mocks are set up
import { addThemeEventListeners } from "../../../../../helpers/ipc/theme/theme-listeners";
import { ipcMain, nativeTheme } from "electron";

describe("addThemeEventListeners", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset the theme source to default
    (nativeTheme as any).themeSource = "system";
    (nativeTheme as any).shouldUseDarkColors = false;
  });

  it("should register theme-related IPC handlers", () => {
    // Act
    addThemeEventListeners();

    // Assert - check that all handlers are registered
    expect(ipcMain.handle).toHaveBeenCalledWith(
      "theme-mode:current",
      expect.any(Function),
    );
    expect(ipcMain.handle).toHaveBeenCalledWith(
      "theme-mode:toggle",
      expect.any(Function),
    );
    expect(ipcMain.handle).toHaveBeenCalledWith(
      "theme-mode:dark",
      expect.any(Function),
    );
    expect(ipcMain.handle).toHaveBeenCalledWith(
      "theme-mode:light",
      expect.any(Function),
    );
    expect(ipcMain.handle).toHaveBeenCalledWith(
      "theme-mode:system",
      expect.any(Function),
    );
  });

  it("should return the current theme source when theme:current handler is called", async () => {
    // Arrange
    addThemeEventListeners();

    // Get the handler function using the mock.calls approach
    const currentHandlerCall = vi
      .mocked(ipcMain.handle)
      .mock.calls.find((call) => call[0] === "theme-mode:current");
    const currentHandler = currentHandlerCall?.[1];

    // Act
    if (!currentHandler) {
      throw new Error("Current handler not found");
    }
    // Use any type for the IPC event object
    const result = await currentHandler({} as any);

    // Assert
    expect(result).toBe("system");
  });

  it("should toggle theme when toggle handler is called", async () => {
    // Arrange
    (nativeTheme as any).themeSource = "system";
    (nativeTheme as any).shouldUseDarkColors = false;
    addThemeEventListeners();

    // Get the handler function
    const toggleHandlerCall = vi
      .mocked(ipcMain.handle)
      .mock.calls.find((call) => call[0] === "theme-mode:toggle");
    const toggleHandler = toggleHandlerCall?.[1];

    // Act & Assert
    if (!toggleHandler) {
      throw new Error("Toggle handler not found");
    }

    // First toggle - return value is the updated shouldUseDarkColors value
    let result = await toggleHandler({} as any);
    expect((nativeTheme as any).themeSource).toBe("dark");
    expect(result).toBe(false);

    // Set current value to true to simulate actual dark mode being active
    (nativeTheme as any).shouldUseDarkColors = true;

    // Second toggle - back to light
    result = await toggleHandler({} as any);
    expect((nativeTheme as any).themeSource).toBe("light");
    expect(result).toBe(true);
  });

  it("should set theme to dark when theme-mode:dark handler is called", async () => {
    // Arrange
    (nativeTheme as any).themeSource = "light";
    (nativeTheme as any).shouldUseDarkColors = false;
    addThemeEventListeners();

    // Get the handler function
    const darkHandlerCall = vi
      .mocked(ipcMain.handle)
      .mock.calls.find((call) => call[0] === "theme-mode:dark");
    const darkHandler = darkHandlerCall?.[1];

    // Act
    if (!darkHandler) {
      throw new Error("Dark handler not found");
    }
    const result = await darkHandler({} as any);

    // Assert
    expect((nativeTheme as any).themeSource).toBe("dark");
    expect(result).toBe("dark");
  });

  it("should set theme to light when theme-mode:light handler is called", async () => {
    // Arrange
    (nativeTheme as any).themeSource = "dark";
    (nativeTheme as any).shouldUseDarkColors = true;
    addThemeEventListeners();

    // Get the handler function
    const lightHandlerCall = vi
      .mocked(ipcMain.handle)
      .mock.calls.find((call) => call[0] === "theme-mode:light");
    const lightHandler = lightHandlerCall?.[1];

    // Act
    if (!lightHandler) {
      throw new Error("Light handler not found");
    }
    const result = await lightHandler({} as any);

    // Assert
    expect((nativeTheme as any).themeSource).toBe("light");
    expect(result).toBe("light");
  });

  it("should set theme to system and return shouldUseDarkColors when system handler is called", async () => {
    // Arrange
    (nativeTheme as any).shouldUseDarkColors = true;
    addThemeEventListeners();

    // Get the handler function
    const systemHandlerCall = vi
      .mocked(ipcMain.handle)
      .mock.calls.find((call) => call[0] === "theme-mode:system");
    const systemHandler = systemHandlerCall?.[1];

    // Act
    if (!systemHandler) {
      throw new Error("System handler not found");
    }
    // Use any type for the IPC event object
    const result = await systemHandler({} as any);

    // Assert
    expect((nativeTheme as any).themeSource).toBe("system");
    expect(result).toBe(true);
  });
});
