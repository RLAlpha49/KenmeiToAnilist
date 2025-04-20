import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { MatchingProgressPanel } from "../../../components/matching/MatchingProgress";

describe("MatchingProgressPanel", () => {
  // Mock data
  const mockProgress = {
    current: 5,
    total: 20,
    currentTitle: "Test Manga",
  };

  const mockTimeEstimate = {
    estimatedRemainingSeconds: 120,
    averageProcessingTimeMs: 500,
    startTime: new Date().getTime(),
    averageTimePerManga: 500,
  };

  it("renders basic progress correctly", () => {
    // Arrange
    const onCancelProcess = vi.fn();

    // Act
    render(
      <MatchingProgressPanel
        isCancelling={false}
        progress={mockProgress}
        statusMessage="Processing manga collection"
        detailMessage="Looking up titles in AniList"
        timeEstimate={mockTimeEstimate}
        onCancelProcess={onCancelProcess}
      />,
    );

    // Assert
    expect(screen.getByText("Processing manga collection")).toBeInTheDocument();
    expect(
      screen.getByText("Looking up titles in AniList"),
    ).toBeInTheDocument();
    expect(screen.getByText(/5 of 20/)).toBeInTheDocument();
    expect(screen.getByText(/25%/)).toBeInTheDocument(); // 5/20 = 25%
    expect(screen.getByText(/Estimated time remaining:/)).toBeInTheDocument();
    // Get formatted time string - could be "2 minutes 0 seconds"
    expect(screen.getByText(/2 minutes.*seconds/)).toBeInTheDocument();
    expect(screen.getByText(/Currently processing:/)).toBeInTheDocument();
    expect(screen.getByText("Test Manga")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Cancel Process" }),
    ).toBeInTheDocument();
  });

  it("shows cancelling state correctly", () => {
    // Arrange
    const onCancelProcess = vi.fn();

    // Act
    const { container } = render(
      <MatchingProgressPanel
        isCancelling={true}
        progress={mockProgress}
        statusMessage="Processing manga collection"
        detailMessage="Looking up titles in AniList"
        timeEstimate={mockTimeEstimate}
        onCancelProcess={onCancelProcess}
      />,
    );

    // Assert
    // Find the title div containing "Cancelling..."
    const titleDiv = container.querySelector('[data-slot="card-title"]');
    expect(titleDiv).toBeInTheDocument();
    expect(titleDiv).toHaveTextContent("Cancelling...");

    // Button should be disabled and show different text
    const cancelButton = screen.getByRole("button", { name: "Cancelling..." });
    expect(cancelButton).toBeInTheDocument();
    expect(cancelButton).toBeDisabled();
  });

  it("shows cache bypass indicator when bypassCache is true", () => {
    // Arrange
    const onCancelProcess = vi.fn();

    // Act
    render(
      <MatchingProgressPanel
        isCancelling={false}
        progress={mockProgress}
        statusMessage="Processing manga collection"
        detailMessage="Looking up titles in AniList"
        timeEstimate={mockTimeEstimate}
        onCancelProcess={onCancelProcess}
        bypassCache={true}
      />,
    );

    // Assert
    expect(
      screen.getByText("Performing fresh searches from AniList"),
    ).toBeInTheDocument();
  });

  it("shows cache bypass indicator when freshSearch is true", () => {
    // Arrange
    const onCancelProcess = vi.fn();

    // Act
    render(
      <MatchingProgressPanel
        isCancelling={false}
        progress={mockProgress}
        statusMessage="Processing manga collection"
        detailMessage="Looking up titles in AniList"
        timeEstimate={mockTimeEstimate}
        onCancelProcess={onCancelProcess}
        freshSearch={true}
      />,
    );

    // Assert
    expect(
      screen.getByText("Performing fresh searches from AniList"),
    ).toBeInTheDocument();
  });

  it("calls onCancelProcess when cancel button is clicked", () => {
    // Arrange
    const onCancelProcess = vi.fn();

    // Act
    render(
      <MatchingProgressPanel
        isCancelling={false}
        progress={mockProgress}
        statusMessage="Processing manga collection"
        detailMessage="Looking up titles in AniList"
        timeEstimate={mockTimeEstimate}
        onCancelProcess={onCancelProcess}
      />,
    );

    // Click the cancel button
    fireEvent.click(screen.getByRole("button", { name: "Cancel Process" }));

    // Assert
    expect(onCancelProcess).toHaveBeenCalledTimes(1);
  });

  it("disables controls when disableControls is true", () => {
    // Arrange
    const onCancelProcess = vi.fn();

    // Act
    render(
      <MatchingProgressPanel
        isCancelling={false}
        progress={mockProgress}
        statusMessage="Processing manga collection"
        detailMessage="Looking up titles in AniList"
        timeEstimate={mockTimeEstimate}
        onCancelProcess={onCancelProcess}
        disableControls={true}
      />,
    );

    // Assert
    expect(
      screen.getByRole("button", { name: "Cancel Process" }),
    ).toBeDisabled();
  });

  it("shows default status message when none is provided", () => {
    // Arrange
    const onCancelProcess = vi.fn();

    // Act
    render(
      <MatchingProgressPanel
        isCancelling={false}
        progress={mockProgress}
        statusMessage=""
        detailMessage="Looking up titles in AniList"
        timeEstimate={mockTimeEstimate}
        onCancelProcess={onCancelProcess}
      />,
    );

    // Assert
    expect(screen.getByText("Matching your manga...")).toBeInTheDocument();
  });
});
