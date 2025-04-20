import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, act, screen, waitFor } from "@testing-library/react";
import { ThemeProvider, useTheme } from "@/contexts/ThemeContext";
import React from "react";
import * as themeHelpers from "@/helpers/theme_helpers";
import {
  setupBrowserMocks,
  resetBrowserMocks,
} from "../../mocks/browser-globals";

// Mock theme helpers right at the top - before any other code
vi.mock("@/helpers/theme_helpers", () => ({
  getCurrentTheme: vi.fn().mockResolvedValue({
    system: "light",
    local: null,
  }),
  setTheme: vi
    .fn()
    .mockImplementation((mode) => Promise.resolve(mode === "dark")),
  updateDocumentTheme: vi.fn(),
}));

// Test component to access theme context
const TestThemeConsumer = () => {
  const { isDarkMode, toggleTheme } = useTheme();
  return (
    <div>
      <span data-testid="dark-mode-status">
        {isDarkMode ? "dark" : "light"}
      </span>
      <button data-testid="toggle-button" onClick={() => toggleTheme()}>
        Toggle Theme
      </button>
    </div>
  );
};

describe("ThemeContext", () => {
  let addClassMock: any;
  let removeClassMock: any;
  let addEventListenerMock: any;
  let removeEventListenerMock: any;

  beforeEach(() => {
    setupBrowserMocks();
    vi.clearAllMocks();

    // Setup document mocks
    addClassMock = vi.fn();
    removeClassMock = vi.fn();
    addEventListenerMock = vi.fn();
    removeEventListenerMock = vi.fn();

    Object.defineProperty(document.documentElement, "classList", {
      value: {
        add: addClassMock,
        remove: removeClassMock,
      },
      configurable: true,
    });

    document.addEventListener = addEventListenerMock;
    document.removeEventListener = removeEventListenerMock;
  });

  afterEach(() => {
    resetBrowserMocks();
    vi.restoreAllMocks();
  });

  it("provides theme context to children", async () => {
    let rendered;

    await act(async () => {
      rendered = render(
        <ThemeProvider>
          <div data-testid="theme-test">Theme Test</div>
        </ThemeProvider>,
      );
    });

    expect(rendered.getByTestId("theme-test")).toBeInTheDocument();
  });

  it("sets up event listeners", async () => {
    await act(async () => {
      render(
        <ThemeProvider>
          <div>Test</div>
        </ThemeProvider>,
      );
    });

    expect(addEventListenerMock).toHaveBeenCalledWith(
      "themeToggled",
      expect.any(Function),
    );
  });

  it("applies theme to document", async () => {
    // Mock updateDocumentTheme function directly
    const updateDocumentThemeMock = vi.fn();
    vi.mocked(themeHelpers.updateDocumentTheme).mockImplementation(
      updateDocumentThemeMock,
    );

    // Mock getCurrentTheme to return a dark theme
    vi.mocked(themeHelpers.getCurrentTheme).mockResolvedValueOnce({
      system: "dark",
      local: "dark",
    });

    await act(async () => {
      render(
        <ThemeProvider>
          <div>Test</div>
        </ThemeProvider>,
      );
    });

    // Wait for the useEffect to complete
    await waitFor(() => {
      expect(themeHelpers.getCurrentTheme).toHaveBeenCalled();
      expect(themeHelpers.updateDocumentTheme).toHaveBeenCalledWith(true);
    });
  });

  it("initializes with correct theme state and can toggle theme", async () => {
    // Mock the implementation of getCurrentTheme and setTheme
    const themeHelpers = await import("@/helpers/theme_helpers");

    // Initial theme state
    vi.mocked(themeHelpers.getCurrentTheme)
      .mockResolvedValueOnce({
        system: "light",
        local: null,
      })
      // After toggle
      .mockResolvedValueOnce({
        system: "light",
        local: "dark",
      });

    // Mock setTheme to return true (dark mode)
    vi.mocked(themeHelpers.setTheme).mockResolvedValueOnce(true);

    // Render the component with our test consumer
    await act(async () => {
      render(
        <ThemeProvider>
          <TestThemeConsumer />
        </ThemeProvider>,
      );
    });

    // Initially light mode
    await waitFor(() => {
      expect(screen.getByTestId("dark-mode-status")).toHaveTextContent("light");
    });

    // Click the toggle button
    await act(async () => {
      const button = screen.getByTestId("toggle-button");
      button.click();
    });

    // Verify setTheme was called
    await waitFor(() => {
      expect(themeHelpers.setTheme).toHaveBeenCalledWith("dark");
    });
  });
});
