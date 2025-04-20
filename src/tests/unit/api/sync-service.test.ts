import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockKenmeiManga, mockAniListManga } from "@/tests/fixtures/manga";

// Mock AniList client
const mockAnilistClient = {
  search: vi.fn(),
  updateEntry: vi.fn(),
  getUserMangaList: vi.fn(),
  getUser: vi.fn(),
};

// Create a mock manga list for testing
const mockMangaList = [
  { ...mockKenmeiManga[0], id: "1" },
  { ...mockKenmeiManga[1], id: "2" },
];

// Create a mock sync service
const syncService = {
  search: async (title: string) => {
    const results = await mockAnilistClient.search(title);
    if (!results || results.length === 0) {
      throw new Error("No results found for " + title);
    }
    return results;
  },
  update: async (kenmeiManga: any, anilistManga: any) => {
    try {
      return await mockAnilistClient.updateEntry(kenmeiManga, anilistManga);
    } catch (error: any) {
      if (error.name === "RateLimitError") {
        return { status: "error", rateLimited: true };
      }
      throw error;
    }
  },
  batchSync: async (
    mangaList: any[],
    progressCallback: (current: number, total: number) => void,
  ) => {
    const results = [];
    for (let i = 0; i < mangaList.length; i++) {
      progressCallback(i + 1, mangaList.length);
      try {
        const result = await mockAnilistClient.updateEntry(mangaList[i]);
        results.push({ status: "success", manga: mangaList[i], result });
      } catch (error: any) {
        const rateLimited = error.message.includes("Rate limited");
        results.push({
          status: "error",
          manga: mangaList[i],
          error,
          rateLimited,
        });
      }
    }
    return results;
  },
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("search", () => {
  it("handles no search results", async () => {
    // Setup mock to return empty results
    mockAnilistClient.search.mockResolvedValue([]);

    // Test the function
    await expect(syncService.search("non-existent manga")).rejects.toThrow(
      /no results found/i,
    );
  });
});

describe("update", () => {
  it("handles network errors during update", async () => {
    // Setup client to throw network error
    const networkError = new Error("Network failure");
    mockAnilistClient.updateEntry.mockRejectedValue(networkError);

    // Test the update function
    await expect(
      syncService.update(mockKenmeiManga[0], mockAniListManga[0]),
    ).rejects.toThrow(/network failure/i);
  });

  it("handles rate limiting during update", async () => {
    // Setup client to throw rate limit error
    const rateLimitError = new Error("Rate limited");
    rateLimitError.name = "RateLimitError";
    mockAnilistClient.updateEntry.mockRejectedValue(rateLimitError);

    // Test the update with rate limiting
    const result = await syncService.update(
      mockKenmeiManga[0],
      mockAniListManga[0],
    );
    expect(result.status).toBe("error");
    expect(result.rateLimited).toBe(true);
  });
});

describe("batchSync", () => {
  it("processes all entries and reports progress", async () => {
    // Setup spies and mocks
    const progressCallback = vi.fn();

    // Mock successful updates
    mockAnilistClient.updateEntry.mockResolvedValue({ id: 1 });

    // Run the batch sync
    const results = await syncService.batchSync(
      mockMangaList,
      progressCallback,
    );

    // Verify all manga were processed
    expect(results.length).toBe(mockMangaList.length);
    expect(mockAnilistClient.updateEntry).toHaveBeenCalledTimes(
      mockMangaList.length,
    );

    // Verify progress callback was called for each item
    expect(progressCallback).toHaveBeenCalledTimes(mockMangaList.length);
    // Check the first call has the right parameters (item 1 of total)
    expect(progressCallback).toHaveBeenNthCalledWith(
      1,
      1,
      mockMangaList.length,
    );
  });

  it("handles rate limiting during batch sync", async () => {
    // Setup test data with more entries
    const largerList = [
      { ...mockMangaList[0], id: "1" },
      { ...mockMangaList[0], id: "2" },
      { ...mockMangaList[0], id: "3" },
    ];

    // Mock the first call to succeed, second to be rate limited
    mockAnilistClient.updateEntry
      .mockResolvedValueOnce({ id: 1 })
      .mockRejectedValueOnce(new Error("Rate limited"))
      .mockResolvedValueOnce({ id: 3 });

    // Run batch sync
    const results = await syncService.batchSync(largerList, vi.fn());

    // Should have tried to update all entries
    expect(mockAnilistClient.updateEntry).toHaveBeenCalledTimes(3);

    // Should have 2 successful updates and 1 error
    const successfulUpdates = results.filter((r) => r.status === "success");
    expect(successfulUpdates.length).toBe(2);

    // Should have one rate limited error
    const rateLimitedErrors = results.filter(
      (r) => r.status === "error" && r.rateLimited,
    );
    expect(rateLimitedErrors.length).toBe(1);
  });
});
