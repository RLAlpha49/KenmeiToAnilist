import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ErrorDisplay } from "../../../components/matching/ErrorDisplay";
import * as router from "@tanstack/react-router";

// Mock dependencies
vi.mock("@tanstack/react-router", async () => {
  const actual = (await vi.importActual("@tanstack/react-router")) as object;
  return {
    ...actual,
    useNavigate: vi.fn().mockReturnValue(vi.fn()),
  };
});

vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children, ...props }: any) => (
      <div data-testid="motion-div" {...props}>
        {children}
      </div>
    ),
  },
}));

// Mock dynamic imports
vi.mock("../../../api/matching/manga-search-service", async () => {
  const cacheDebugger = {
    getCacheStatus: vi.fn().mockReturnValue({
      inMemoryCache: 10,
      localStorage: {
        mangaCache: 20,
        searchCache: 30,
      },
    }),
    resetAllCaches: vi.fn(),
  };
  return { cacheDebugger };
});

describe("ErrorDisplay", () => {
  const mockError = "Failed to match manga";
  const mockDetailedError = {
    status: 401,
    message: "Authentication failed",
    data: { error: "Invalid token" },
  };

  const mockOnRetry = vi.fn();
  const mockOnClearPendingManga = vi.fn();
  const mockNavigate = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(router, "useNavigate").mockReturnValue(mockNavigate);

    // Mock window.alert and window.confirm
    window.alert = vi.fn();
    window.confirm = vi.fn().mockReturnValue(true);
  });

  it("renders with basic error message", () => {
    // Arrange & Act
    render(
      <ErrorDisplay
        error={mockError}
        detailedError={null}
        onRetry={mockOnRetry}
        onClearPendingManga={mockOnClearPendingManga}
      />,
    );

    // Assert
    expect(screen.getByText("Error Matching Manga")).toBeInTheDocument();
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    expect(screen.getByText(mockError)).toBeInTheDocument();

    // Technical details section should not be present
    expect(screen.queryByText("Technical Details")).not.toBeInTheDocument();
  });

  it("renders with detailed error information", () => {
    // Arrange & Act
    render(
      <ErrorDisplay
        error={mockError}
        detailedError={mockDetailedError}
        onRetry={mockOnRetry}
        onClearPendingManga={mockOnClearPendingManga}
      />,
    );

    // Assert
    expect(screen.getByText("Technical Details")).toBeInTheDocument();

    // Detailed error JSON should be in the pre element
    const preElement = screen.getByText(/"status": 401/);
    expect(preElement).toBeInTheDocument();
    expect(preElement.textContent).toContain("Authentication failed");
  });

  it("calls onRetry when retry button is clicked", () => {
    // Arrange
    render(
      <ErrorDisplay
        error={mockError}
        detailedError={null}
        onRetry={mockOnRetry}
        onClearPendingManga={mockOnClearPendingManga}
      />,
    );

    // Act
    const retryButton = screen.getByText("Retry Matching");
    fireEvent.click(retryButton);

    // Assert
    expect(mockOnRetry).toHaveBeenCalledTimes(1);
  });

  it("navigates to import page and clears pending manga", () => {
    // Arrange
    render(
      <ErrorDisplay
        error={mockError}
        detailedError={null}
        onRetry={mockOnRetry}
        onClearPendingManga={mockOnClearPendingManga}
      />,
    );

    // Act
    const backButton = screen.getByText("Back to Import");
    fireEvent.click(backButton);

    // Assert
    expect(mockOnClearPendingManga).toHaveBeenCalledTimes(1);
    expect(mockNavigate).toHaveBeenCalledWith({ to: "/import" });
  });

  it("navigates to settings page when settings button is clicked", () => {
    // Arrange
    render(
      <ErrorDisplay
        error={mockError}
        detailedError={null}
        onRetry={mockOnRetry}
        onClearPendingManga={mockOnClearPendingManga}
      />,
    );

    // Act
    const settingsButton = screen.getByText("Go to Settings");
    fireEvent.click(settingsButton);

    // Assert
    expect(mockNavigate).toHaveBeenCalledWith({ to: "/settings" });
  });

  it("displays cache status when check cache button is clicked", async () => {
    // Arrange
    render(
      <ErrorDisplay
        error={mockError}
        detailedError={null}
        onRetry={mockOnRetry}
        onClearPendingManga={mockOnClearPendingManga}
      />,
    );

    // Act
    const cacheButton = screen.getByText("Check Cache Status");
    fireEvent.click(cacheButton);

    // Need to wait for the async import and alert to be called
    await waitFor(() => {
      expect(window.alert).toHaveBeenCalledWith(
        "Cache Status:\n- In Memory: 10 entries\n- LocalStorage: 20 manga entries, 30 search entries",
      );
    });
  });

  it("resets caches and clears pending manga when reset caches button is clicked", async () => {
    // Arrange
    render(
      <ErrorDisplay
        error={mockError}
        detailedError={null}
        onRetry={mockOnRetry}
        onClearPendingManga={mockOnClearPendingManga}
      />,
    );

    // Act
    const resetButton = screen.getByText("Reset Caches");
    fireEvent.click(resetButton);

    // Need to wait for the async import and confirm dialog
    await waitFor(() => {
      expect(window.confirm).toHaveBeenCalled();
    });

    // After confirm is called and returns true, the rest should happen
    await waitFor(() => {
      expect(mockOnClearPendingManga).toHaveBeenCalledTimes(1);
      expect(window.alert).toHaveBeenCalledWith(
        "All caches have been cleared.",
      );
    });
  });
});
