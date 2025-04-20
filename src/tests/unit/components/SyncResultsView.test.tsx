import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import SyncResultsView from "../../../components/sync/SyncResultsView";
import { SyncReport } from "../../../api/anilist/sync-service";

describe("SyncResultsView", () => {
  // Mock data
  const mockTimestamp = new Date("2023-01-01T12:00:00Z").getTime();

  const createMockReport = (
    successfulUpdates = 5,
    failedUpdates = 2,
    skippedEntries = 1,
  ): SyncReport => ({
    timestamp: mockTimestamp as unknown as Date,
    totalEntries: successfulUpdates + failedUpdates + skippedEntries,
    successfulUpdates,
    failedUpdates,
    skippedEntries,
    errors: Array(failedUpdates)
      .fill(0)
      .map((_, i) => ({
        mediaId: i + 1,
        error: `Error message ${i + 1}`,
      })),
  });

  it("renders the sync results with correct statistics", () => {
    // Arrange
    const mockReport = createMockReport();
    const onClose = vi.fn();

    // Act
    render(<SyncResultsView report={mockReport} onClose={onClose} />);

    // Assert
    expect(screen.getByText("Synchronization Results")).toBeInTheDocument();
    // Using a regex to match "Completed at" followed by any text
    expect(screen.getByText(/Completed at/)).toBeInTheDocument();

    // Check statistics
    expect(screen.getAllByText("5").length).toBeGreaterThan(0); // Successful updates
    expect(screen.getAllByText("2").length).toBeGreaterThan(0); // Failed updates
    expect(screen.getAllByText("1").length).toBeGreaterThan(0); // Skipped entries

    // Success rate might be shown as "62%" or with a space between the number and percent
    const successRateElement = screen.getByText(/63\s*%/);
    expect(successRateElement).toBeInTheDocument();

    // Check progress bar exists
    const progressBar = document.querySelector(".bg-gradient-to-r");
    expect(progressBar).toBeInTheDocument();
    // Check width is exactly "63%" as that's what's in the DOM
    expect(progressBar).toHaveStyle("width: 63%");
  });

  it("displays error details when there are failed updates", () => {
    // Arrange
    const mockReport = createMockReport(5, 3, 1);
    const onClose = vi.fn();

    // Act
    render(<SyncResultsView report={mockReport} onClose={onClose} />);

    // Assert
    expect(screen.getByText(/Failed Updates \(3\)/)).toBeInTheDocument();
    // Use getAllByText for numbers, since they appear in both stats and table
    expect(screen.getAllByText("1").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Error message 1").length).toBeGreaterThan(0);
    expect(screen.getAllByText("2").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Error message 2").length).toBeGreaterThan(0);
    expect(screen.getAllByText("3").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Error message 3").length).toBeGreaterThan(0);
  });

  it("shows truncated error list with 'more errors' text when there are many errors", () => {
    // Arrange
    const mockReport = createMockReport(5, 15, 1);
    const onClose = vi.fn();

    // Act
    render(<SyncResultsView report={mockReport} onClose={onClose} />);

    // Assert
    expect(screen.getByText(/Failed Updates \(15\)/)).toBeInTheDocument();
    expect(screen.getByText(/and 5 more errors/)).toBeInTheDocument();
  });

  it("does not display error section when there are no errors", () => {
    // Arrange
    const mockReport = createMockReport(5, 0, 1);
    const onClose = vi.fn();

    // Act
    render(<SyncResultsView report={mockReport} onClose={onClose} />);

    // Assert
    // Check that the error section with the full text "Failed Updates (0)" is not present
    expect(
      screen.queryByText(/Failed Updates \(\d+\)/),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("calls onClose when Close button is clicked", () => {
    // Arrange
    const mockReport = createMockReport();
    const onClose = vi.fn();

    // Act
    render(<SyncResultsView report={mockReport} onClose={onClose} />);
    fireEvent.click(screen.getByText("Close"));

    // Assert
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("shows Export Error Log button when there are errors and onExportErrors is provided", () => {
    // Arrange
    const mockReport = createMockReport(5, 2, 1);
    const onClose = vi.fn();
    const onExportErrors = vi.fn();

    // Act
    render(
      <SyncResultsView
        report={mockReport}
        onClose={onClose}
        onExportErrors={onExportErrors}
      />,
    );

    // Assert
    const exportButton = screen.getByText("Export Error Log");
    expect(exportButton).toBeInTheDocument();

    // Click export button
    fireEvent.click(exportButton);
    expect(onExportErrors).toHaveBeenCalledTimes(1);
  });

  it("does not show Export Error Log button when there are no errors", () => {
    // Arrange
    const mockReport = createMockReport(5, 0, 1);
    const onClose = vi.fn();
    const onExportErrors = vi.fn();

    // Act
    render(
      <SyncResultsView
        report={mockReport}
        onClose={onClose}
        onExportErrors={onExportErrors}
      />,
    );

    // Assert
    expect(screen.queryByText("Export Error Log")).not.toBeInTheDocument();
  });

  it("handles a 100% success rate correctly", () => {
    // Arrange
    const mockReport = createMockReport(10, 0, 0);
    const onClose = vi.fn();

    // Act
    render(<SyncResultsView report={mockReport} onClose={onClose} />);

    // Assert
    // Use getAllByText and check the first one (the one in the stats section)
    const successRateElements = screen.getAllByText(/100\s*%/);
    expect(successRateElements.length).toBeGreaterThan(0);

    const progressBar = document.querySelector(".bg-gradient-to-r");
    expect(progressBar).toHaveStyle({ width: "100%" });
  });
});
