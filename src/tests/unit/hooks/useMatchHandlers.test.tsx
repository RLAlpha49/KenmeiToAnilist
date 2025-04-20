import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useMatchHandlers } from "../../../hooks/useMatchHandlers";
import { KenmeiManga } from "../../../api/kenmei/types";
import { MangaMatchResult } from "../../../api/anilist/types";
import { STORAGE_KEYS } from "../../../utils/storage";

// Mock storage
vi.mock("../../../utils/storage", () => ({
  STORAGE_KEYS: {
    MATCH_RESULTS: "match_results",
  },
  storage: {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  },
}));

// Import storage to access the mock
import { storage } from "../../../utils/storage";

describe("useMatchHandlers", () => {
  // Mock data for tests
  const mockKenmeiManga: KenmeiManga = {
    id: 1,
    title: "Test Manga",
    status: "reading",
    chapters_read: 10,
    score: 8,
    notes: "",
    created_at: "2023-01-01T00:00:00Z",
    updated_at: "2023-05-10T00:00:00Z",
    url: "https://example.com/test-manga",
  };

  const mockMatchResult: MangaMatchResult = {
    kenmeiManga: mockKenmeiManga,
    status: "pending",
    anilistMatches: [
      {
        confidence: 90,
        manga: {
          id: 101,
          title: {
            english: "Test Manga English",
            romaji: "Test Manga Romaji",
            native: "テストマンガ",
          },
          description: "Test description",
          coverImage: {
            large: "https://example.com/image.jpg",
          },
          format: "MANGA",
          status: "RELEASING",
          chapters: 100,
          volumes: 10,
          startDate: {
            year: 2020,
            month: 1,
            day: 1,
          },
        },
      },
      {
        confidence: 80,
        manga: {
          id: 102,
          title: {
            english: "Test Manga 2",
            romaji: "Test Manga Romaji 2",
            native: "テストマンガ2",
          },
          description: "Test description 2",
          coverImage: {
            large: "https://example.com/image2.jpg",
          },
          format: "MANGA",
          status: "RELEASING",
          chapters: 50,
          volumes: 5,
          startDate: {
            year: 2019,
            month: 1,
            day: 1,
          },
        },
      },
    ],
  };

  // Mock state functions
  const setMatchResults = vi.fn();
  const setSearchTarget = vi.fn();
  const setIsSearchOpen = vi.fn();
  const setBypassCache = vi.fn();

  // Reset mocks before each test
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("initializes hook correctly", () => {
    const { result } = renderHook(() =>
      useMatchHandlers(
        [mockMatchResult],
        setMatchResults,
        setSearchTarget,
        setIsSearchOpen,
        setBypassCache,
      ),
    );

    // Check that hook returns all expected functions
    expect(result.current.handleManualSearch).toBeDefined();
    expect(result.current.handleAcceptMatch).toBeDefined();
    expect(result.current.handleRejectMatch).toBeDefined();
    expect(result.current.handleSelectAlternative).toBeDefined();
  });

  it("finds match index by ID correctly", () => {
    // This test requires direct access to the findMatchIndex function
    // We'll test this indirectly through other functions

    const { result } = renderHook(() =>
      useMatchHandlers(
        [mockMatchResult],
        setMatchResults,
        setSearchTarget,
        setIsSearchOpen,
        setBypassCache,
      ),
    );

    // Use handleAcceptMatch which uses findMatchIndex internally
    act(() => {
      result.current.handleAcceptMatch(mockMatchResult);
    });

    // Check that match was found and setMatchResults was called
    expect(setMatchResults).toHaveBeenCalled();
  });

  it("finds match index by title when ID fails", () => {
    // Create a different ID but same title to test title-based matching
    const differentIdManga = {
      ...mockMatchResult,
      kenmeiManga: {
        ...mockKenmeiManga,
        id: 999, // Different ID
      },
    };

    const { result } = renderHook(() =>
      useMatchHandlers(
        [mockMatchResult],
        setMatchResults,
        setSearchTarget,
        setIsSearchOpen,
        setBypassCache,
      ),
    );

    // Should find by title despite different ID
    act(() => {
      result.current.handleManualSearch(differentIdManga.kenmeiManga);
    });

    // After a small timeout (simulated by vi.runAllTimers), it should set search target
    vi.runAllTimers();
    expect(setSearchTarget).toHaveBeenCalledWith(differentIdManga.kenmeiManga);
    expect(setIsSearchOpen).toHaveBeenCalledWith(true);
  });

  it("handles manual search correctly", () => {
    const { result } = renderHook(() =>
      useMatchHandlers(
        [mockMatchResult],
        setMatchResults,
        setSearchTarget,
        setIsSearchOpen,
        setBypassCache,
      ),
    );

    // Trigger manual search
    act(() => {
      result.current.handleManualSearch(mockKenmeiManga);
    });

    // Check that search panel is first closed
    expect(setIsSearchOpen).toHaveBeenCalledWith(false);

    // Run all timers to simulate the setTimeout
    vi.runAllTimers();

    // After timeout, search should be opened with correct target
    expect(setSearchTarget).toHaveBeenCalledWith(mockKenmeiManga);
    expect(setIsSearchOpen).toHaveBeenCalledWith(true);
    expect(setBypassCache).toHaveBeenCalledWith(true);
  });

  it("handles accepting a match", () => {
    const { result } = renderHook(() =>
      useMatchHandlers(
        [mockMatchResult],
        setMatchResults,
        setSearchTarget,
        setIsSearchOpen,
        setBypassCache,
      ),
    );

    // Accept the match
    act(() => {
      result.current.handleAcceptMatch(mockMatchResult);
    });

    // Check that match results were updated
    expect(setMatchResults).toHaveBeenCalled();

    // Get the first argument of the first call
    const updatedResults = setMatchResults.mock.calls[0][0];

    // Verify the update
    expect(updatedResults.length).toBe(1);
    expect(updatedResults[0].status).toBe("matched");
    expect(updatedResults[0].selectedMatch).toEqual(
      mockMatchResult.anilistMatches?.[0]?.manga,
    );
    expect(updatedResults[0].matchDate).toBeInstanceOf(Date);

    // Check that it was saved to storage
    expect(storage.setItem).toHaveBeenCalledWith(
      STORAGE_KEYS.MATCH_RESULTS,
      expect.any(String),
    );
  });

  it("handles batch accept operations", () => {
    const batchMatches = [
      { ...mockMatchResult, status: "matched" },
      {
        ...mockMatchResult,
        kenmeiManga: { ...mockKenmeiManga, id: 2, title: "Test Manga 2" },
        status: "matched",
      },
    ];

    const { result } = renderHook(() =>
      useMatchHandlers(
        [mockMatchResult],
        setMatchResults,
        setSearchTarget,
        setIsSearchOpen,
        setBypassCache,
      ),
    );

    // Perform batch accept
    act(() => {
      result.current.handleAcceptMatch({
        isBatchOperation: true,
        matches: batchMatches as MangaMatchResult[],
      });
    });

    // Should update the entire results array with the batch matches
    expect(setMatchResults).toHaveBeenCalledWith(batchMatches);
    expect(storage.setItem).toHaveBeenCalledWith(
      STORAGE_KEYS.MATCH_RESULTS,
      JSON.stringify(batchMatches),
    );
  });

  it("handles rejecting a match", () => {
    const { result } = renderHook(() =>
      useMatchHandlers(
        [mockMatchResult],
        setMatchResults,
        setSearchTarget,
        setIsSearchOpen,
        setBypassCache,
      ),
    );

    // Reject the match
    act(() => {
      result.current.handleRejectMatch(mockMatchResult);
    });

    // Check that match results were updated
    expect(setMatchResults).toHaveBeenCalled();

    // Get the first argument of the first call
    const updatedResults = setMatchResults.mock.calls[0][0];

    // Verify the update
    expect(updatedResults.length).toBe(1);
    expect(updatedResults[0].status).toBe("skipped");
    expect(updatedResults[0].selectedMatch).toBeUndefined();
    expect(updatedResults[0].matchDate).toBeInstanceOf(Date);

    // Check that it was saved to storage
    expect(storage.setItem).toHaveBeenCalledWith(
      STORAGE_KEYS.MATCH_RESULTS,
      expect.any(String),
    );
  });

  it("handles batch reject operations", () => {
    const batchMatches = [
      { ...mockMatchResult, status: "skipped", selectedMatch: undefined },
      {
        ...mockMatchResult,
        kenmeiManga: { ...mockKenmeiManga, id: 2, title: "Test Manga 2" },
        status: "skipped",
        selectedMatch: undefined,
      },
    ];

    const { result } = renderHook(() =>
      useMatchHandlers(
        [mockMatchResult],
        setMatchResults,
        setSearchTarget,
        setIsSearchOpen,
        setBypassCache,
      ),
    );

    // Perform batch reject
    act(() => {
      result.current.handleRejectMatch({
        isBatchOperation: true,
        matches: batchMatches as MangaMatchResult[],
      });
    });

    // Should update the entire results array with the batch matches
    expect(setMatchResults).toHaveBeenCalledWith(batchMatches);
    expect(storage.setItem).toHaveBeenCalledWith(
      STORAGE_KEYS.MATCH_RESULTS,
      JSON.stringify(batchMatches),
    );
  });

  it("handles selecting an alternative match", () => {
    const { result } = renderHook(() =>
      useMatchHandlers(
        [mockMatchResult],
        setMatchResults,
        setSearchTarget,
        setIsSearchOpen,
        setBypassCache,
      ),
    );

    // Select alternative match (at index 1)
    act(() => {
      result.current.handleSelectAlternative(mockMatchResult, 1);
    });

    // Check that match results were updated with the alternative match
    expect(setMatchResults).toHaveBeenCalled();

    const updatedResults = setMatchResults.mock.calls[0][0];

    // Verify the update - should have selected the second match
    expect(updatedResults[0].selectedMatch).toEqual(
      mockMatchResult.anilistMatches?.[1]?.manga,
    );

    // Status should still be pending since we didn't auto-accept
    expect(updatedResults[0].status).toBe("pending");
  });

  it("handles selecting an alternative match with auto-accept", () => {
    const { result } = renderHook(() =>
      useMatchHandlers(
        [mockMatchResult],
        setMatchResults,
        setSearchTarget,
        setIsSearchOpen,
        setBypassCache,
      ),
    );

    // Select alternative match (at index 1) with auto-accept
    act(() => {
      result.current.handleSelectAlternative(mockMatchResult, 1, true);
    });

    // Check that match results were updated with the alternative match
    expect(setMatchResults).toHaveBeenCalled();

    const updatedResults = setMatchResults.mock.calls[0][0];

    // Verify the update - should have selected the second match
    expect(updatedResults[0].selectedMatch).toEqual(
      mockMatchResult.anilistMatches?.[1]?.manga,
    );

    // Status should be matched since we auto-accepted
    expect(updatedResults[0].status).toBe("matched");
  });
});
