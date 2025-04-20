import React from "react";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ImportSummary } from "../../../components/import/ImportSummary";
import { KenmeiManga, KenmeiExport } from "../../../api/kenmei/types";

// Mock framer-motion to prevent animation issues in tests
vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children, ...props }: any) => (
      <div data-testid="motion-div" {...props}>
        {children}
      </div>
    ),
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}));

describe("ImportSummary", () => {
  // Mock data for testing
  const mockMangaData: KenmeiManga[] = [
    {
      id: 1,
      title: "Manga 1",
      status: "reading",
      chapters_read: 10,
      score: 8,
      created_at: "2023-01-01",
      updated_at: "2023-01-01",
      url: "",
    },
    {
      id: 2,
      title: "Manga 2",
      status: "completed",
      chapters_read: 25,
      score: 9,
      created_at: "2023-01-01",
      updated_at: "2023-01-01",
      url: "",
    },
    {
      id: 3,
      title: "Manga 3",
      status: "plan_to_read",
      chapters_read: 0,
      score: 0,
      created_at: "2023-01-01",
      updated_at: "2023-01-01",
      url: "",
    },
    {
      id: 4,
      title: "Manga 4",
      status: "dropped",
      chapters_read: 5,
      score: 6,
      created_at: "2023-01-01",
      updated_at: "2023-01-01",
      url: "",
    },
    {
      id: 5,
      title: "Manga 5",
      status: "on_hold",
      chapters_read: 15,
      score: 7,
      created_at: "2023-01-01",
      updated_at: "2023-01-01",
      url: "",
    },
  ];

  // Create KenmeiExport object
  const createMockData = (
    manga: KenmeiManga[] = mockMangaData,
  ): KenmeiExport => ({
    export_date: "2023-01-01",
    user: {
      username: "testuser",
      id: 1,
    },
    manga: manga,
  });

  // Mock callback functions
  const mockOnProceed = vi.fn();
  const mockOnCancel = vi.fn();

  // Setup component rendering function
  const renderComponent = (mangaData: KenmeiManga[] = mockMangaData) => {
    return render(
      <ImportSummary
        data={createMockData(mangaData)}
        onProceed={mockOnProceed}
        onCancel={mockOnCancel}
      />,
    );
  };

  // Clear mocks before each test
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the summary with correct statistics", () => {
    // Arrange & Act
    renderComponent();

    // Assert - Check total count
    const totalEntriesSection = screen
      .getByText("Total entries to import")
      .closest(".space-y-1") as HTMLElement;
    expect(within(totalEntriesSection).getByText("5")).toBeInTheDocument();
    expect(screen.getByText("manga")).toBeInTheDocument();

    // Check status counts - find by containing status text, then check the corresponding count
    const readingCard = screen
      .getByText("Reading")
      .closest(".flex.flex-col") as HTMLElement;
    const completedCard = screen
      .getByText("Completed")
      .closest(".flex.flex-col") as HTMLElement;
    const planToReadCard = screen
      .getByText("Plan to Read")
      .closest(".flex.flex-col") as HTMLElement;
    const droppedCard = screen
      .getByText("Dropped")
      .closest(".flex.flex-col") as HTMLElement;
    const onHoldCard = screen
      .getByText("On Hold")
      .closest(".flex.flex-col") as HTMLElement;

    expect(within(readingCard).getByText("1")).toBeInTheDocument();
    expect(within(completedCard).getByText("1")).toBeInTheDocument();
    expect(within(planToReadCard).getByText("1")).toBeInTheDocument();
    expect(within(droppedCard).getByText("1")).toBeInTheDocument();
    expect(within(onHoldCard).getByText("1")).toBeInTheDocument();
  });

  it("shows empty state when no data is provided", () => {
    // Arrange & Act
    renderComponent([]);

    // Assert - Check total count shows 0
    const totalEntriesSection = screen
      .getByText("Total entries to import")
      .closest(".space-y-1") as HTMLElement;
    expect(within(totalEntriesSection).getByText("0")).toBeInTheDocument();
  });

  it("calls onProceed when Continue button is clicked", () => {
    // Arrange
    renderComponent();

    // Act
    const continueButton = screen.getByRole("button", { name: /continue/i });
    fireEvent.click(continueButton);

    // Assert
    expect(mockOnProceed).toHaveBeenCalledTimes(1);
  });

  it("calls onCancel when Cancel button is clicked", () => {
    // Arrange
    renderComponent();

    // Act
    const cancelButton = screen.getByRole("button", { name: /cancel/i });
    fireEvent.click(cancelButton);

    // Assert
    expect(mockOnCancel).toHaveBeenCalledTimes(1);
  });

  it("displays correct status breakdown", () => {
    // Arrange & Act
    renderComponent();

    // Assert
    expect(screen.getByText("Reading")).toBeInTheDocument();
    expect(screen.getByText("Completed")).toBeInTheDocument();
    expect(screen.getByText("Plan to Read")).toBeInTheDocument();
    expect(screen.getByText("Dropped")).toBeInTheDocument();
    expect(screen.getByText("On Hold")).toBeInTheDocument();
  });
});
