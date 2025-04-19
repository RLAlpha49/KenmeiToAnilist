import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { DataTable } from "../../../components/import/DataTable";
import { KenmeiMangaItem } from "../../../types/kenmei";

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

describe("DataTable", () => {
  // Mock data for testing
  const mockData: KenmeiMangaItem[] = [
    { title: "Manga A", status: "reading", score: 8, chapters_read: 10 },
    { title: "Manga B", status: "completed", score: 9, chapters_read: 25 },
    { title: "Manga C", status: "plan_to_read", score: 0, chapters_read: 0 },
    { title: "Manga D", status: "dropped", score: 6, chapters_read: 5 },
  ];

  // Setup component rendering function
  const renderComponent = (data = mockData) => {
    return render(<DataTable data={data} />);
  };

  it("renders the table with all data rows", () => {
    // Arrange & Act
    renderComponent();

    // Assert - Check table headers
    expect(
      screen.getByRole("columnheader", { name: "Title" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("columnheader", { name: "Status" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("columnheader", { name: "Ch" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("columnheader", { name: "Score" }),
    ).toBeInTheDocument();

    // Check that all data rows are displayed
    expect(screen.getByText("Manga A")).toBeInTheDocument();
    expect(screen.getByText("Manga B")).toBeInTheDocument();
    expect(screen.getByText("Manga C")).toBeInTheDocument();
    expect(screen.getByText("Manga D")).toBeInTheDocument();
  });

  it("formats status values correctly with badges", () => {
    // Arrange & Act
    renderComponent();

    // Get all badge elements - the component replaces underscores with spaces
    const badges = screen.getAllByText(
      /reading|completed|plan to read|dropped/i,
    );

    // Check status values are displayed correctly (with spaces instead of underscores)
    expect(
      badges.some((badge) => badge.textContent === "reading"),
    ).toBeTruthy();
    expect(
      badges.some((badge) => badge.textContent === "completed"),
    ).toBeTruthy();
    expect(
      badges.some((badge) => badge.textContent === "plan to read"),
    ).toBeTruthy();
    expect(
      badges.some((badge) => badge.textContent === "dropped"),
    ).toBeTruthy();
  });

  it("displays chapter counts correctly", () => {
    // Arrange & Act
    renderComponent();

    // Check chapter counts
    expect(screen.getByText("10")).toBeInTheDocument();
    expect(screen.getByText("25")).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
  });

  it("formats scores correctly", () => {
    // Arrange & Act
    renderComponent();

    // Check scores are formatted with one decimal place
    expect(screen.getByText("8.0")).toBeInTheDocument();
    expect(screen.getByText("9.0")).toBeInTheDocument();
    expect(screen.getByText("6.0")).toBeInTheDocument();
  });

  it("displays empty state when no data is provided", () => {
    // Arrange & Act
    render(<DataTable data={[]} />);

    // Assert
    expect(screen.getByText("No manga entries found")).toBeInTheDocument();
  });

  it("shows correct count in caption", () => {
    // Arrange & Act
    renderComponent();

    // Assert
    expect(screen.getByText("Showing 4 of 4 entries")).toBeInTheDocument();
  });

  it("displays load more button when there are more items than default display count", () => {
    // Create data with more items than the default page size
    const manyItems: KenmeiMangaItem[] = Array.from(
      { length: 100 },
      (_, i) => ({
        title: `Manga ${String.fromCharCode(65 + (i % 26))}${Math.floor(i / 26)}`,
        status: "reading",
        score: 8,
        chapters_read: 10,
      }),
    );

    // Render with smaller itemsPerPage to force pagination
    render(<DataTable data={manyItems} itemsPerPage={25} />);

    // Check for load more button
    expect(screen.getByText(/Load More/)).toBeInTheDocument();
    expect(screen.getByText(/75 remaining/)).toBeInTheDocument();
  });

  it("loads more items when clicking the load more button", async () => {
    // Create data with more items than the default page size
    const manyItems: KenmeiMangaItem[] = Array.from({ length: 60 }, (_, i) => ({
      title: `Manga ${String.fromCharCode(65 + (i % 26))}${Math.floor(i / 26)}`,
      status: "reading",
      score: 8,
      chapters_read: 10,
    }));

    // Render with smaller itemsPerPage to force pagination
    render(<DataTable data={manyItems} itemsPerPage={20} />);

    // Check initial state
    expect(screen.getByText("Showing 20 of 60 entries")).toBeInTheDocument();

    // Click load more button wrapped in act
    await act(async () => {
      fireEvent.click(screen.getByText(/Load More/));
      // Wait for the setTimeout in the component
      await new Promise((resolve) => setTimeout(resolve, 400));
    });

    // Check updated state (should now show 40 items)
    expect(screen.getByText("Showing 40 of 60 entries")).toBeInTheDocument();
  });
});
