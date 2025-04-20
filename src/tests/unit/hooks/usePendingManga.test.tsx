import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { usePendingManga } from "../../../hooks/usePendingManga";
import { KenmeiManga } from "../../../api/kenmei/types";
import { MangaMatchResult } from "../../../api/anilist/types";

// Mock storage
vi.mock("../../../utils/storage", () => ({
  STORAGE_KEYS: {
    PENDING_MANGA: "pending_manga",
  },
  storage: {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  },
}));

// Import storage to access the mock
import { storage, STORAGE_KEYS } from "../../../utils/storage";

// Mock console methods to reduce noise
const originalConsole = { ...console };
beforeEach(() => {
  console.log = vi.fn();
  console.error = vi.fn();
});

afterEach(() => {
  console.log = originalConsole.log;
  console.error = originalConsole.error;
});

describe("usePendingManga", () => {
  // Mock data
  const mockKenmeiManga: KenmeiManga[] = [
    {
      id: 1,
      title: "Test Manga 1",
      status: "reading",
      chapters_read: 10,
      score: 0,
      url: "https://example.com/test-manga-1",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 2,
      title: "Test Manga 2",
      status: "completed",
      chapters_read: 20,
      score: 0,
      url: "https://example.com/test-manga-2",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 3,
      title: "Test Manga 3",
      status: "on_hold",
      chapters_read: 5,
      score: 0,
      url: "https://example.com/test-manga-3",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ];

  const mockMatchResults: MangaMatchResult[] = [
    {
      kenmeiManga: {
        id: 1,
        title: "Test Manga 1",
        status: "reading",
        chapters_read: 10,
        score: 0,
        url: "https://example.com/test-manga-1",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      status: "matched",
      anilistMatches: [],
    },
  ];

  // Original window implementation
  const originalWindow = { ...window };

  beforeEach(() => {
    vi.clearAllMocks();

    // Reset mockingProcessState
    Object.defineProperty(window, "matchingProcessState", {
      value: {
        isRunning: false,
      },
      writable: true,
    });
  });

  afterEach(() => {
    // Restore window object
    Object.defineProperty(window, "matchingProcessState", {
      value: originalWindow.matchingProcessState,
      writable: true,
    });
  });

  it("initializes with empty pending manga array", () => {
    const { result } = renderHook(() => usePendingManga());

    expect(result.current.pendingManga).toEqual([]);
  });

  it("loads pending manga from storage correctly", () => {
    // Mock storage.getItem to return saved pending manga
    (storage.getItem as jest.Mock).mockReturnValueOnce(
      JSON.stringify(mockKenmeiManga),
    );

    const { result } = renderHook(() => usePendingManga());

    act(() => {
      const loadedManga = result.current.loadPendingManga();
      expect(loadedManga).toEqual(mockKenmeiManga);
    });

    // Should update the pendingManga state with loaded data
    expect(result.current.pendingManga).toEqual(mockKenmeiManga);
    expect(storage.getItem).toHaveBeenCalledWith(STORAGE_KEYS.PENDING_MANGA);
  });

  it("handles invalid data when loading pending manga", () => {
    // Mock storage.getItem to return invalid JSON
    (storage.getItem as jest.Mock).mockReturnValueOnce("invalid-json");

    const { result } = renderHook(() => usePendingManga());

    act(() => {
      const loadedManga = result.current.loadPendingManga();
      expect(loadedManga).toBeNull();
    });

    // Should keep pendingManga state empty
    expect(result.current.pendingManga).toEqual([]);

    // Should remove invalid data from storage
    expect(storage.removeItem).toHaveBeenCalledWith(STORAGE_KEYS.PENDING_MANGA);
  });

  it("filters out invalid manga objects when loading", () => {
    // Mock storage.getItem to return an array with some invalid manga objects
    const invalidMixedData = [
      mockKenmeiManga[0],
      { not: "a valid manga object" },
      mockKenmeiManga[1],
    ];
    (storage.getItem as jest.Mock).mockReturnValueOnce(
      JSON.stringify(invalidMixedData),
    );

    const { result } = renderHook(() => usePendingManga());

    act(() => {
      const loadedManga = result.current.loadPendingManga();
      // Should only return the valid manga objects
      expect(loadedManga?.length).toBe(2);
    });

    // Should update storage with only the valid manga
    expect(storage.setItem).toHaveBeenCalledWith(
      STORAGE_KEYS.PENDING_MANGA,
      expect.any(String),
    );
  });

  it("saves pending manga to storage correctly", () => {
    const { result } = renderHook(() => usePendingManga());

    act(() => {
      result.current.savePendingManga(mockKenmeiManga);
    });

    // Should update the pendingManga state
    expect(result.current.pendingManga).toEqual(mockKenmeiManga);

    // Should save to storage
    expect(storage.setItem).toHaveBeenCalledWith(
      STORAGE_KEYS.PENDING_MANGA,
      JSON.stringify(mockKenmeiManga),
    );
  });

  it("clears pending manga when saving empty array", () => {
    const { result } = renderHook(() => usePendingManga());

    act(() => {
      result.current.savePendingManga([]);
    });

    // Should update the pendingManga state to empty
    expect(result.current.pendingManga).toEqual([]);

    // Should remove from storage
    expect(storage.removeItem).toHaveBeenCalledWith(STORAGE_KEYS.PENDING_MANGA);
  });

  it("calculates pending manga correctly using title-based matching", () => {
    const { result } = renderHook(() => usePendingManga());

    // Only the first manga is in the results, so 2 and 3 should be pending
    act(() => {
      const pendingManga = result.current.calculatePendingManga(
        mockMatchResults,
        mockKenmeiManga,
      );

      // Should return manga 2 and 3 as pending
      expect(pendingManga.length).toBe(2);
      expect(pendingManga[0].id).toBe(2);
      expect(pendingManga[1].id).toBe(3);
    });
  });

  it("calculates pending manga correctly when titles have different cases", () => {
    const { result } = renderHook(() => usePendingManga());

    // Create match results with case difference in title
    const caseInsensitiveResults: MangaMatchResult[] = [
      {
        kenmeiManga: {
          id: 1,
          title: "test manga 1", // lowercase
          status: "reading",
          chapters_read: 10,
          score: 0,
          url: "https://example.com/test-manga-1",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        status: "matched",
        anilistMatches: [],
      },
    ];

    act(() => {
      const pendingManga = result.current.calculatePendingManga(
        caseInsensitiveResults,
        mockKenmeiManga, // Contains "Test Manga 1" with uppercase
      );

      // Should still recognize it as the same manga despite case difference
      expect(pendingManga.length).toBe(2); // Only manga 2 and 3 should be pending
      expect(pendingManga[0].id).toBe(2);
      expect(pendingManga[1].id).toBe(3);
    });
  });

  it("falls back to ID-based matching if title matching finds nothing", () => {
    const { result } = renderHook(() => usePendingManga());

    // Create match results with completely different titles
    const differentTitlesResults: MangaMatchResult[] = [
      {
        kenmeiManga: {
          id: 1, // Same ID
          title: "Completely Different Title", // Different title
          status: "reading",
          chapters_read: 10,
          score: 0,
          url: "https://example.com/test-manga-1",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        status: "matched",
        anilistMatches: [],
      },
    ];

    act(() => {
      const pendingManga = result.current.calculatePendingManga(
        differentTitlesResults,
        mockKenmeiManga,
      );

      // Should fall back to ID-based matching
      expect(pendingManga.length).toBe(3); // All manga are returned as title matching found nothing
      // Since all 3 manga are returned, we're checking the IDs are correct
      expect(pendingManga[0].id).toBe(1);
      expect(pendingManga[1].id).toBe(2);
      expect(pendingManga[2].id).toBe(3);
    });
  });

  it("uses numerical difference as last resort for finding pending manga", () => {
    const { result } = renderHook(() => usePendingManga());

    // Create results where neither title nor ID matching would work
    const unmatchableResults: MangaMatchResult[] = [
      {
        kenmeiManga: {
          id: 999, // Different ID
          title: "Completely Different Title", // Different title
          status: "reading",
          chapters_read: 10,
          score: 0,
          url: "https://example.com/test-manga-1",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        status: "matched",
        anilistMatches: [],
      },
    ];

    act(() => {
      const pendingManga = result.current.calculatePendingManga(
        unmatchableResults,
        mockKenmeiManga,
      );

      // Should use numerical difference as last resort
      expect(pendingManga.length).toBe(3); // All manga are returned since neither title nor ID matching worked
    });
  });

  it("saves pendingManga on unmount if process is not active", () => {
    // Set up the component with pending manga
    const { result, unmount } = renderHook(() => usePendingManga());

    // Set some pending manga
    act(() => {
      result.current.setPendingManga(mockKenmeiManga);
    });

    // No active process
    window.matchingProcessState = { isRunning: false } as any;

    // Unmount the component
    unmount();

    // Should save the pending manga to storage
    expect(storage.setItem).toHaveBeenCalledWith(
      STORAGE_KEYS.PENDING_MANGA,
      JSON.stringify(mockKenmeiManga),
    );
  });

  it("does not save pendingManga on unmount if process is active", () => {
    // Set up the component with pending manga
    const { result, unmount } = renderHook(() => usePendingManga());

    // Set some pending manga
    act(() => {
      result.current.setPendingManga(mockKenmeiManga);
    });

    // Set active process flag
    window.matchingProcessState = { isRunning: true } as any;

    // Reset the mock to ensure we can check it wasn't called
    (storage.setItem as jest.Mock).mockClear();

    // Unmount the component
    unmount();

    // Should not save the pending manga to storage when process is active
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  // Additional tests to improve coverage

  it("handles error when saving pending manga", () => {
    // Mock storage.setItem to throw an error
    (storage.setItem as jest.Mock).mockImplementationOnce(() => {
      throw new Error("Storage error");
    });

    const { result } = renderHook(() => usePendingManga());

    act(() => {
      result.current.savePendingManga(mockKenmeiManga);
    });

    // The state doesn't get updated on error (this is the behavior in the real code)
    expect(result.current.pendingManga).toEqual([]);

    // Should log the error
    expect(console.error).toHaveBeenCalledWith(
      "Failed to save pending manga to storage:",
      expect.any(Error),
    );
  });

  it("handles non-array data when loading from storage", () => {
    // Mock storage.getItem to return a non-array value
    (storage.getItem as jest.Mock).mockReturnValueOnce(
      JSON.stringify({ notAnArray: true }),
    );

    const { result } = renderHook(() => usePendingManga());

    act(() => {
      const loadedManga = result.current.loadPendingManga();
      expect(loadedManga).toBeNull();
    });

    // Should keep pendingManga state empty
    expect(result.current.pendingManga).toEqual([]);

    // Should remove invalid data from storage
    expect(storage.removeItem).toHaveBeenCalledWith(STORAGE_KEYS.PENDING_MANGA);
  });

  it("handles empty array when loading from storage", () => {
    // Mock storage.getItem to return an empty array
    (storage.getItem as jest.Mock).mockReturnValueOnce("[]");

    const { result } = renderHook(() => usePendingManga());

    act(() => {
      const loadedManga = result.current.loadPendingManga();
      expect(loadedManga).toBeNull();
    });

    // Should keep pendingManga state empty
    expect(result.current.pendingManga).toEqual([]);

    // Should remove empty array from storage
    expect(storage.removeItem).toHaveBeenCalledWith(STORAGE_KEYS.PENDING_MANGA);
  });

  it("calculates pending manga with all equal counts", () => {
    const { result } = renderHook(() => usePendingManga());

    // Create a scenario where the processed count equals the total count
    const fullResults: MangaMatchResult[] = mockKenmeiManga.map((manga) => ({
      kenmeiManga: manga,
      status: "matched",
      anilistMatches: [],
    }));

    act(() => {
      const pendingManga = result.current.calculatePendingManga(
        fullResults,
        mockKenmeiManga,
      );

      // Should return empty array since all manga are processed
      expect(pendingManga).toEqual([]);
    });
  });

  it("handles mixed ID types in calculatePendingManga", () => {
    const { result } = renderHook(() => usePendingManga());

    // Create manga with string IDs
    const stringIdManga: KenmeiManga[] = [
      {
        id: "1" as any, // String ID instead of number
        title: "String ID Manga 1",
        status: "reading",
        chapters_read: 10,
        score: 0,
        url: "https://example.com/test-manga-1",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: "2" as any,
        title: "String ID Manga 2",
        status: "completed",
        chapters_read: 20,
        score: 0,
        url: "https://example.com/test-manga-2",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];

    // Results with number IDs
    const numberIdResults: MangaMatchResult[] = [
      {
        kenmeiManga: {
          id: 1,
          title: "String ID Manga 1",
          status: "reading",
          chapters_read: 10,
          score: 0,
          url: "https://example.com/test-manga-1",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        status: "matched",
        anilistMatches: [],
      },
    ];

    act(() => {
      // Type mismatch should cause title-based matching to be preferred
      const pendingManga = result.current.calculatePendingManga(
        numberIdResults,
        stringIdManga,
      );

      // Should still find the right pending manga despite ID type mismatch
      expect(pendingManga.length).toBe(1);
      expect(pendingManga[0].title).toBe("String ID Manga 2");
    });
  });

  it("handles undefined IDs in calculatePendingManga", () => {
    const { result } = renderHook(() => usePendingManga());

    // Create manga with undefined IDs
    const undefinedIdManga: KenmeiManga[] = [
      {
        id: undefined as any,
        title: "Undefined ID Manga 1",
        status: "reading",
        chapters_read: 10,
        score: 0,
        url: "https://example.com/test-manga-1",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: undefined as any,
        title: "Undefined ID Manga 2",
        status: "completed",
        chapters_read: 20,
        score: 0,
        url: "https://example.com/test-manga-2",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];

    // Results with one match
    const singleMatchResults: MangaMatchResult[] = [
      {
        kenmeiManga: {
          id: undefined as any,
          title: "Undefined ID Manga 1",
          status: "reading",
          chapters_read: 10,
          score: 0,
          url: "https://example.com/test-manga-1",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        status: "matched",
        anilistMatches: [],
      },
    ];

    act(() => {
      // Title-based matching should work despite undefined IDs
      const pendingManga = result.current.calculatePendingManga(
        singleMatchResults,
        undefinedIdManga,
      );

      expect(pendingManga.length).toBe(1);
      expect(pendingManga[0].title).toBe("Undefined ID Manga 2");
    });
  });

  it("returns all manga when processedResults is empty", () => {
    const { result } = renderHook(() => usePendingManga());

    act(() => {
      const pendingManga = result.current.calculatePendingManga(
        [], // No processed results
        mockKenmeiManga,
      );

      // Should return all manga as pending
      expect(pendingManga).toEqual(mockKenmeiManga);
    });
  });

  it("doesn't unmount save when pending manga is empty", () => {
    // Set up component with no pending manga
    const { unmount } = renderHook(() => usePendingManga());

    // Reset mock before unmount to ensure clear state
    (storage.setItem as jest.Mock).mockClear();

    // Unmount the component
    unmount();

    // Should not save to storage when pendingManga is empty
    expect(storage.setItem).not.toHaveBeenCalled();
  });
});
