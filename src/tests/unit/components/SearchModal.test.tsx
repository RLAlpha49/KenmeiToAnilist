import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { SearchModal } from "../../../components/matching/SearchModal";
import { KenmeiStatus } from "@/api/kenmei/types";

// We need to mock the MangaSearchPanel component since it's a complex component
vi.mock("../../../components/matching/MangaSearchPanel", () => ({
  MangaSearchPanel: vi.fn(({ onClose, onSelectMatch }) => (
    <div data-testid="mock-search-panel">
      <button onClick={onClose} data-testid="mock-close-button">
        Close
      </button>
      <button
        onClick={() =>
          onSelectMatch({ id: 123, title: { english: "Test Manga" } })
        }
        data-testid="mock-select-button"
      >
        Select
      </button>
    </div>
  )),
}));

describe("SearchModal", () => {
  // Sample test data
  const mockSearchTarget = {
    id: 1,
    title: "Test Manga",
    status: "reading" as KenmeiStatus,
    chapters_read: 10,
    volume: 2,
    score: 8,
    reading_status: "reading",
    times_reread: 0,
    start_date: "2023-01-01",
    end_date: null,
    notes: "",
    created_at: "2023-01-01T00:00:00Z",
    updated_at: "2023-05-10T00:00:00Z",
    url: "https://example.com/test-manga",
  };

  it("renders when isOpen is true and searchTarget exists", () => {
    // Arrange
    const onClose = vi.fn();
    const onSelectMatch = vi.fn();

    // Act
    render(
      <SearchModal
        isOpen={true}
        searchTarget={mockSearchTarget}
        accessToken="test-token"
        bypassCache={false}
        onClose={onClose}
        onSelectMatch={onSelectMatch}
      />,
    );

    // Assert
    expect(screen.getByTestId("mock-search-panel")).toBeInTheDocument();
  });

  it("does not render when isOpen is false", () => {
    // Arrange
    const onClose = vi.fn();
    const onSelectMatch = vi.fn();

    // Act
    render(
      <SearchModal
        isOpen={false}
        searchTarget={mockSearchTarget}
        accessToken="test-token"
        bypassCache={false}
        onClose={onClose}
        onSelectMatch={onSelectMatch}
      />,
    );

    // Assert - AnimatePresence will not render anything
    expect(screen.queryByTestId("mock-search-panel")).not.toBeInTheDocument();
  });

  it("does not render when searchTarget is undefined", () => {
    // Arrange
    const onClose = vi.fn();
    const onSelectMatch = vi.fn();

    // Act
    render(
      <SearchModal
        isOpen={true}
        searchTarget={undefined}
        accessToken="test-token"
        bypassCache={false}
        onClose={onClose}
        onSelectMatch={onSelectMatch}
      />,
    );

    // Assert
    expect(screen.queryByTestId("mock-search-panel")).not.toBeInTheDocument();
  });

  it("calls onClose when backdrop is clicked", () => {
    // Arrange
    const onClose = vi.fn();
    const onSelectMatch = vi.fn();

    // Act
    render(
      <SearchModal
        isOpen={true}
        searchTarget={mockSearchTarget}
        accessToken="test-token"
        bypassCache={false}
        onClose={onClose}
        onSelectMatch={onSelectMatch}
      />,
    );

    // Find the backdrop div and click it
    const backdrop = document.querySelector(".fixed.inset-0.bg-white\\/10");
    if (backdrop) {
      fireEvent.click(backdrop);
    }

    // Assert
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("passes correct props to MangaSearchPanel", () => {
    // Arrange
    const onClose = vi.fn();
    const onSelectMatch = vi.fn();

    // Act
    render(
      <SearchModal
        isOpen={true}
        searchTarget={mockSearchTarget}
        accessToken="test-token"
        bypassCache={true}
        onClose={onClose}
        onSelectMatch={onSelectMatch}
      />,
    );

    // Click the mock close button (which simulates the MangaSearchPanel onClose)
    fireEvent.click(screen.getByTestId("mock-close-button"));
    expect(onClose).toHaveBeenCalledTimes(1);

    // Click the mock select button (which simulates the MangaSearchPanel onSelectMatch)
    fireEvent.click(screen.getByTestId("mock-select-button"));
    expect(onSelectMatch).toHaveBeenCalledTimes(1);
    expect(onSelectMatch).toHaveBeenCalledWith({
      id: 123,
      title: { english: "Test Manga" },
    });
  });
});
