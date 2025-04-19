import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { RematchOptions } from "../../../components/matching/RematchOptions";
import { MangaMatchResult } from "@/api/anilist/types";

// Mock framer-motion to prevent animation issues in tests
vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children, ...props }: any) => (
      <div data-testid="motion-div" {...props}>
        {children}
      </div>
    ),
  },
}));

describe("RematchOptions", () => {
  // Mock data
  const mockSelectedStatuses = {
    pending: true,
    skipped: true,
    matched: false,
    manual: false,
    unmatched: false,
  };

  const mockMatchResults: MangaMatchResult[] = [
    {
      status: "pending",
      kenmeiManga: {
        id: 1,
        title: "Manga 1",
        status: "reading",
        score: 8,
        url: "https://example.com/manga-1",
        chapters_read: 10,
        volumes_read: 2,
        notes: "Test notes",
        created_at: "2023-01-01T00:00:00Z",
        updated_at: "2023-05-10T00:00:00Z",
      },
      anilistMatches: [],
      selectedMatch: undefined,
      matchDate: new Date().toISOString() as unknown as Date,
    },
    {
      status: "pending",
      kenmeiManga: {
        id: 2,
        title: "Manga 2",
        status: "reading",
        score: 8,
        url: "https://example.com/manga-2",
        chapters_read: 10,
        volumes_read: 2,
        notes: "Test notes",
        created_at: "2023-01-01T00:00:00Z",
        updated_at: "2023-05-10T00:00:00Z",
      },
      anilistMatches: [],
      selectedMatch: undefined,
      matchDate: new Date().toISOString() as unknown as Date,
    },
    {
      status: "skipped",
      kenmeiManga: {
        id: 3,
        title: "Manga 3",
        status: "reading",
        score: 8,
        url: "https://example.com/manga-3",
        chapters_read: 10,
        volumes_read: 2,
        notes: "Test notes",
        created_at: "2023-01-01T00:00:00Z",
        updated_at: "2023-05-10T00:00:00Z",
      },
      anilistMatches: [],
      selectedMatch: undefined,
      matchDate: new Date().toISOString() as unknown as Date,
    },
    {
      status: "matched",
      kenmeiManga: {
        id: 4,
        title: "Manga 4",
        status: "reading",
        score: 8,
        url: "https://example.com/manga-4",
        chapters_read: 10,
        volumes_read: 2,
        notes: "Test notes",
        created_at: "2023-01-01T00:00:00Z",
        updated_at: "2023-05-10T00:00:00Z",
      },
      anilistMatches: [],
      selectedMatch: {
        id: 100,
        title: {
          romaji: "Test title",
          english: "Test title",
          native: "Test title",
        },
        format: "MANGA",
        status: "reading",
      },
      matchDate: new Date().toISOString() as unknown as Date,
    },
    {
      status: "manual",
      kenmeiManga: {
        id: 5,
        title: "Manga 5",
        status: "reading",
        score: 8,
        url: "https://example.com/manga-5",
        chapters_read: 10,
        volumes_read: 2,
        notes: "Test notes",
        created_at: "2023-01-01T00:00:00Z",
        updated_at: "2023-05-10T00:00:00Z",
      },
      anilistMatches: [],
      selectedMatch: {
        id: 200,
        title: {
          romaji: "Test title",
          english: "Test title",
          native: "Test title",
        },
        format: "MANGA",
        status: "reading",
      },
      matchDate: new Date().toISOString() as unknown as Date,
    },
  ];

  // Mock functions
  const mockOnChangeSelectedStatuses = vi.fn();
  const mockOnRematchByStatus = vi.fn();
  const mockOnCloseOptions = vi.fn();

  // Common render function
  const renderComponent = (warning: string | null = null) => {
    return render(
      <RematchOptions
        selectedStatuses={mockSelectedStatuses}
        onChangeSelectedStatuses={mockOnChangeSelectedStatuses}
        matchResults={mockMatchResults}
        rematchWarning={warning}
        onRematchByStatus={mockOnRematchByStatus}
        onCloseOptions={mockOnCloseOptions}
      />,
    );
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders with correct status counts", () => {
    // Arrange & Act
    renderComponent();

    // Assert
    expect(screen.getByText("Rematch Options")).toBeInTheDocument();

    // Find the badges by their container divs and verify the text content
    const pendingBadge = screen
      .getByLabelText("Pending")
      .closest(".bg-background")
      ?.querySelector(".bg-muted\\/80");
    expect(pendingBadge).toHaveTextContent("2");

    const skippedBadge = screen
      .getByLabelText("Skipped")
      .closest(".bg-background")
      ?.querySelector("[class*='bg-red-50']");
    expect(skippedBadge).toHaveTextContent("1");

    const matchedBadge = screen
      .getByLabelText("Matched")
      .closest(".bg-background")
      ?.querySelector("[class*='bg-green-50']");
    expect(matchedBadge).toHaveTextContent("1");

    const manualBadge = screen
      .getByLabelText("Manual")
      .closest(".bg-background")
      ?.querySelector("[class*='bg-blue-50']");
    expect(manualBadge).toHaveTextContent("1");

    // Check the total count (2 pending + 1 skipped = 3)
    const totalCountContainer = screen.getByText(/manga to rematch/, {
      exact: false,
    });
    expect(totalCountContainer).toHaveTextContent("3");
  });

  it("displays warning when provided", () => {
    // Arrange & Act
    const warningMessage = "This will clear all existing matches";
    renderComponent(warningMessage);

    // Assert
    expect(screen.getByText("Warning")).toBeInTheDocument();
    expect(screen.getByText(warningMessage)).toBeInTheDocument();
  });

  it("toggles status checkboxes correctly", () => {
    // Arrange
    renderComponent();

    // Act - toggle "pending" status
    const pendingCheckbox = screen.getByLabelText("Pending");
    fireEvent.click(pendingCheckbox);

    // Assert
    expect(mockOnChangeSelectedStatuses).toHaveBeenCalledWith({
      ...mockSelectedStatuses,
      pending: false,
    });

    // Act - toggle "matched" status
    const matchedCheckbox = screen.getByLabelText("Matched");
    fireEvent.click(matchedCheckbox);

    // Assert
    expect(mockOnChangeSelectedStatuses).toHaveBeenCalledWith({
      ...mockSelectedStatuses,
      matched: true,
    });
  });

  it("calls reset function with default values", () => {
    // Arrange
    renderComponent();

    // Act
    const resetButton = screen.getByText("Reset");
    fireEvent.click(resetButton);

    // Assert
    expect(mockOnChangeSelectedStatuses).toHaveBeenCalledWith({
      pending: true,
      skipped: true,
      matched: false,
      manual: false,
      unmatched: false,
    });
  });

  it("calls close function when X button is clicked", () => {
    // Arrange
    renderComponent();

    // Find the close button by its SVG icon
    const closeButton = document
      .querySelector("button svg.lucide-x")
      ?.closest("button");
    expect(closeButton).toBeInTheDocument();

    // Act
    if (closeButton) {
      fireEvent.click(closeButton);
    }

    // Assert
    expect(mockOnCloseOptions).toHaveBeenCalledTimes(1);
  });

  it("calls rematch function when rematch button is clicked", () => {
    // Arrange
    renderComponent();

    // Act
    const rematchButton = screen.getByText(/Fresh Search Selected/);
    fireEvent.click(rematchButton);

    // Assert
    expect(mockOnRematchByStatus).toHaveBeenCalledTimes(1);
  });

  it("disables rematch button when no items are selected", () => {
    // Arrange
    const noSelectionStatus = {
      pending: false,
      skipped: false,
      matched: false,
      manual: false,
      unmatched: false,
    };

    render(
      <RematchOptions
        selectedStatuses={noSelectionStatus}
        onChangeSelectedStatuses={mockOnChangeSelectedStatuses}
        matchResults={mockMatchResults}
        rematchWarning={null}
        onRematchByStatus={mockOnRematchByStatus}
        onCloseOptions={mockOnCloseOptions}
      />,
    );

    // Assert
    const rematchButton = screen.getByText(/Fresh Search Selected \(0\)/);
    expect(rematchButton).toBeDisabled();
  });
});
