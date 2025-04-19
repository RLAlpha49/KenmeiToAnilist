import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MangaMatchingPanel } from "../../../components/matching/MangaMatchingPanel";
import { MatchStatus } from "../../../api/anilist/types";
import { KenmeiStatus } from "@/api/kenmei/types";

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

// Mock electron API
vi.mock("electron", () => ({}));
if (typeof window !== "undefined") {
  window.electronAPI = {
    window: {
      minimize: vi.fn(),
      maximize: vi.fn(),
      close: vi.fn(),
    },
    theme: {
      setTheme: vi.fn(),
      getTheme: vi.fn(),
    },
    anilist: {
      getRateLimitStatus: vi.fn(),
      request: vi.fn(),
      exchangeToken: vi.fn(),
      clearCache: vi.fn(),
    },
    shell: {
      openExternal: vi.fn(),
    },
    electronStore: {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
    },
  };
}

describe("MangaMatchingPanel", () => {
  // Mock data
  const mockMatches = [
    {
      id: 1,
      status: "matched" as MatchStatus,
      kenmeiManga: {
        id: 1,
        title: "Manga 1",
        status: "reading" as KenmeiStatus,
        score: 8,
        url: "https://www.kenmei.co/series/manga-1",
        chapters_read: 10,
        volumes_read: 2,
        notes: "Test notes",
        created_at: "2023-01-01T00:00:00Z",
        updated_at: "2023-05-10T00:00:00Z",
      },
      anilistMatches: [
        {
          confidence: 0.9,
          manga: {
            id: 101,
            title: {
              english: "English Manga 1",
              romaji: "English Manga 1",
              native: "English Manga 1",
            },
            coverImage: { large: "https://example.com/image1.jpg" },
            format: "MANGA",
            status: "RELEASING",
            description: "Description 1",
          },
        },
      ],
      selectedMatch: {
        id: 101,
        title: {
          english: "English Manga 1",
          romaji: "English Manga 1",
          native: "English Manga 1",
        },
        coverImage: { large: "https://example.com/image1.jpg" },
        format: "MANGA",
        status: "RELEASING",
        description: "Description 1",
      },
      matchDate: new Date().toISOString() as unknown as Date,
    },
    {
      id: 2,
      status: "pending" as MatchStatus,
      kenmeiManga: {
        id: 2,
        title: "Manga 2",
        status: "reading" as KenmeiStatus,
        score: 8,
        url: "https://www.kenmei.co/series/manga-2",
        chapters_read: 5,
        volumes_read: 2,
        notes: "Test notes",
        created_at: "2023-01-01T00:00:00Z",
        updated_at: "2023-05-10T00:00:00Z",
      },
      anilistMatches: [
        {
          confidence: 0.8,
          manga: {
            id: 201,
            title: {
              english: "English Manga 2",
              romaji: "English Manga 2",
              native: "English Manga 2",
            },
            coverImage: { large: "https://example.com/image2.jpg" },
            format: "MANGA",
            status: "COMPLETED",
            description: "Description 2",
          },
        },
        {
          confidence: 0.7,
          manga: {
            id: 202,
            title: {
              english: "English Similar Manga 2",
              romaji: "English Similar Manga 2",
              native: "English Similar Manga 2",
            },
            coverImage: { large: "https://example.com/image2b.jpg" },
            format: "MANGA",
            status: "COMPLETED",
            description: "Description 2b",
          },
        },
      ],
      selectedMatch: undefined,
      matchDate: new Date().toISOString() as unknown as Date,
    },
    {
      id: 3,
      status: "skipped" as MatchStatus,
      kenmeiManga: {
        id: 3,
        title: "Manga 3",
        status: "reading" as KenmeiStatus,
        score: 8,
        url: "https://www.kenmei.co/series/manga-3",
        chapters_read: 0,
        volumes_read: 0,
        notes: "Test notes",
        created_at: "2023-01-01T00:00:00Z",
        updated_at: "2023-05-10T00:00:00Z",
      },
      anilistMatches: [],
      selectedMatch: undefined,
      matchDate: new Date().toISOString() as unknown as Date,
    },
    {
      id: 4,
      status: "manual" as MatchStatus,
      kenmeiManga: {
        id: 4,
        title: "Manga 4",
        status: "reading" as KenmeiStatus,
        score: 8,
        url: "https://www.kenmei.co/series/manga-4",
        chapters_read: 20,
        volumes_read: 0,
        notes: "Test notes",
        created_at: "2023-01-01T00:00:00Z",
        updated_at: "2023-05-10T00:00:00Z",
      },
      anilistMatches: [
        {
          confidence: 0.6,
          manga: {
            id: 401,
            title: {
              english: "English Manga 4",
              romaji: "English Manga 4",
              native: "English Manga 4",
            },
            coverImage: { large: "https://example.com/image4.jpg" },
            format: "MANGA",
            status: "RELEASING",
            description: "Description 4",
          },
        },
      ],
      selectedMatch: {
        id: 401,
        title: {
          english: "English Manga 4",
          romaji: "English Manga 4",
          native: "English Manga 4",
        },
        coverImage: { large: "https://example.com/image4.jpg" },
        format: "MANGA",
        status: "RELEASING",
        description: "Description 4",
      },
      matchDate: new Date().toISOString() as unknown as Date,
    },
  ];

  // Mock functions
  const mockOnManualSearch = vi.fn();
  const mockOnAcceptMatch = vi.fn();
  const mockOnRejectMatch = vi.fn();
  const mockOnSelectAlternative = vi.fn();
  const mockOnResetToPending = vi.fn();

  // Setup component rendering function
  const renderComponent = () => {
    return render(
      <MangaMatchingPanel
        matches={mockMatches}
        onManualSearch={mockOnManualSearch}
        onAcceptMatch={mockOnAcceptMatch}
        onRejectMatch={mockOnRejectMatch}
        onSelectAlternative={mockOnSelectAlternative}
        onResetToPending={mockOnResetToPending}
      />,
    );
  };

  // Clear mocks before each test
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the component with correct manga matches statistics", () => {
    // Arrange & Act
    renderComponent();

    // Assert - Check that the status counts display correctly
    expect(screen.getByText("Total: 4")).toBeInTheDocument();
    expect(screen.getByText("Pending: 1")).toBeInTheDocument();
    expect(screen.getByText("Matched: 1")).toBeInTheDocument();
    expect(screen.getByText("Manual: 1")).toBeInTheDocument();
    expect(screen.getByText("Skipped: 1")).toBeInTheDocument();

    // Check that we have the manga titles displayed
    expect(screen.getAllByText(/Manga 1/)[0]).toBeInTheDocument();
    expect(screen.getAllByText(/Manga 2/)[0]).toBeInTheDocument();
    expect(screen.getAllByText(/Manga 3/)[0]).toBeInTheDocument();
    expect(screen.getAllByText(/Manga 4/)[0]).toBeInTheDocument();
  });

  it("filters manga by status when clicking filter checkboxes", () => {
    // Arrange
    renderComponent();

    // Get all manga initially
    expect(screen.getAllByText(/Manga 1/)[0]).toBeInTheDocument();
    expect(screen.getAllByText(/Manga 2/)[0]).toBeInTheDocument();
    expect(screen.getAllByText(/Manga 3/)[0]).toBeInTheDocument();
    expect(screen.getAllByText(/Manga 4/)[0]).toBeInTheDocument();

    // Act - uncheck "matched" filter
    const matchedCheckbox = screen.getByRole("checkbox", {
      name: /Matched 1/i,
    });
    fireEvent.click(matchedCheckbox);

    // Assert - "Manga 1" (matched) should not be visible
    expect(screen.queryAllByText(/Manga 1/)).toHaveLength(0);
    expect(screen.getAllByText(/Manga 2/)[0]).toBeInTheDocument();
    expect(screen.getAllByText(/Manga 3/)[0]).toBeInTheDocument();
    expect(screen.getAllByText(/Manga 4/)[0]).toBeInTheDocument();

    // Act - uncheck "pending" filter
    const pendingCheckbox = screen.getByRole("checkbox", {
      name: /Pending 1/i,
    });
    fireEvent.click(pendingCheckbox);

    // Assert - now "Manga 2" (pending) should also not be visible
    expect(screen.queryAllByText(/Manga 1/)).toHaveLength(0);
    expect(screen.queryAllByText(/Manga 2/)).toHaveLength(0);
    expect(screen.getAllByText(/Manga 3/)[0]).toBeInTheDocument();
    expect(screen.getAllByText(/Manga 4/)[0]).toBeInTheDocument();
  });

  it("filters manga by title when searching", () => {
    // Arrange
    renderComponent();

    // Initial state - all manga visible
    expect(screen.getAllByText(/Manga 1/)[0]).toBeInTheDocument();
    expect(screen.getAllByText(/Manga 2/)[0]).toBeInTheDocument();

    // Act - search for "Manga 1"
    const searchInput = screen.getByRole("textbox", {
      name: /Search manga titles/i,
    });
    fireEvent.change(searchInput, { target: { value: "Manga 1" } });

    // Assert - only "Manga 1" should be visible
    expect(screen.getAllByText(/Manga 1/)[0]).toBeInTheDocument();
    expect(screen.queryAllByText(/Manga 2/)).toHaveLength(0);
    expect(screen.queryAllByText(/Manga 3/)).toHaveLength(0);
    expect(screen.queryAllByText(/Manga 4/)).toHaveLength(0);
  });

  it("sorts manga when clicking sort buttons", () => {
    // Arrange
    renderComponent();

    // Initial state - sorted by title ascending
    const mangaItems = screen.getAllByRole("region");

    // Act - sort by status
    const statusButton = screen.getByText("Status");
    fireEvent.click(statusButton);

    // Assert - re-query for the manga items after sorting
    const dataTestIds = screen
      .getAllByRole("region")
      .map((item) => item.getAttribute("aria-label"));

    // Check that the order has changed (specific order depends on implementation)
    expect(dataTestIds).not.toEqual(
      mangaItems.map((item) => item.getAttribute("aria-label")),
    );
  });

  it("calls onManualSearch when manual search button is clicked", () => {
    // Arrange
    renderComponent();

    // Act
    const manualSearchButton = screen.getByRole("button", {
      name: /Search manually for Manga 2/i,
    });
    fireEvent.click(manualSearchButton);

    // Assert
    expect(mockOnManualSearch).toHaveBeenCalledTimes(1);
    expect(mockOnManualSearch).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Manga 2" }),
    );
  });

  it("calls onAcceptMatch when accept button is clicked", () => {
    // Arrange
    renderComponent();

    // Act
    const acceptButton = screen.getByRole("button", {
      name: /Accept match for Manga 2/i,
    });
    fireEvent.click(acceptButton);

    // Assert
    expect(mockOnAcceptMatch).toHaveBeenCalledTimes(1);
    // We don't need to check the exact parameters as they depend on the implementation
  });

  it("calls onRejectMatch when reject button is clicked", () => {
    // Arrange
    renderComponent();

    // Act
    const rejectButton = screen.getByRole("button", {
      name: /Skip matching for Manga 2/i,
    });
    fireEvent.click(rejectButton);

    // Assert
    expect(mockOnRejectMatch).toHaveBeenCalledTimes(1);
    // We don't need to check the exact parameters as they depend on the implementation
  });

  it("calls onSelectAlternative when an alternative match is selected", () => {
    // Arrange
    renderComponent();

    // Act - find and click the alternative match
    const alternativeButton = screen.getByRole("button", {
      name: /Accept English Similar Manga 2 as match/i,
    });
    fireEvent.click(alternativeButton);

    // Assert
    expect(mockOnSelectAlternative).toHaveBeenCalledTimes(1);
    // We don't need to check the exact parameters as they depend on the implementation
  });

  it("enables 'Select All' and 'Clear All' filter buttons", () => {
    // Arrange
    renderComponent();

    // Act - click Clear All button
    const clearAllButton = screen.getByRole("button", { name: /Clear All/i });
    fireEvent.click(clearAllButton);

    // Assert - all manga should be filtered out
    expect(screen.queryAllByText(/Manga 1/)).toHaveLength(0);
    expect(screen.queryAllByText(/Manga 2/)).toHaveLength(0);
    expect(screen.queryAllByText(/Manga 3/)).toHaveLength(0);
    expect(screen.queryAllByText(/Manga 4/)).toHaveLength(0);

    // Act - click Select All button
    const selectAllButton = screen.getByRole("button", { name: /Select All/i });
    fireEvent.click(selectAllButton);

    // Assert - manga should be visible again
    expect(screen.getAllByText(/Manga 1/)[0]).toBeInTheDocument();
    expect(screen.getAllByText(/Manga 2/)[0]).toBeInTheDocument();
    expect(screen.getAllByText(/Manga 3/)[0]).toBeInTheDocument();
    expect(screen.getAllByText(/Manga 4/)[0]).toBeInTheDocument();
  });
});
