import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  processKenmeiExport,
  prepareEntryForSync,
  extractReadingStats,
  processMangaInBatches,
  filterMangaEntries,
  DEFAULT_PROCESS_OPTIONS,
} from "@/api/kenmei/data-processor";
import { KenmeiManga, KenmeiStatus } from "@/api/kenmei/types";
import { AniListManga } from "@/api/anilist/types";
import * as statusMapper from "@/api/kenmei/status-mapper";
import * as parser from "@/api/kenmei/parser";

// Mock dependencies
vi.mock("@/api/kenmei/parser", () => ({
  parseKenmeiExport: vi.fn(() => {
    // Return a simple parsed structure for testing
    return {
      export_date: "2023-05-01",
      user: { username: "testuser", id: 123 },
      manga: [
        {
          id: 1,
          title: "Test Manga",
          status: "reading",
          score: 7,
          url: "https://example.com/manga/1",
          chapters_read: 42,
          created_at: "2023-01-01T00:00:00Z",
          updated_at: "2023-04-01T00:00:00Z",
        },
      ],
    };
  }),
  processKenmeiMangaBatches: vi.fn((mangaList) => {
    // Return simplified processing results
    return {
      processedEntries: mangaList,
      validationErrors: [],
      totalEntries: mangaList.length,
      successfulEntries: mangaList.length,
    };
  }),
}));

vi.mock("@/api/kenmei/status-mapper", () => ({
  mapKenmeiToAniListStatus: vi.fn((status, mapping) => {
    const defaultMap = {
      reading: "CURRENT",
      completed: "COMPLETED",
      on_hold: "PAUSED",
      dropped: "DROPPED",
      plan_to_read: "PLANNING",
    };

    // Use mapping if provided, otherwise use default
    if (mapping && mapping[status]) {
      return mapping[status];
    }

    return defaultMap[status as keyof typeof defaultMap] || "PLANNING";
  }),
}));

describe("data-processor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("processKenmeiExport", () => {
    it("should process export data successfully", () => {
      const fileContent = JSON.stringify({
        export_date: "2023-05-01",
        user: { username: "testuser", id: 123 },
        manga: [
          {
            id: 1,
            title: "Test Manga",
            status: "reading",
            score: 7,
            url: "https://example.com/manga/1",
            chapters_read: 42,
            created_at: "2023-01-01T00:00:00Z",
            updated_at: "2023-04-01T00:00:00Z",
          },
        ],
      });

      const result = processKenmeiExport(fileContent);

      expect(result.processedEntries).toHaveLength(1);
      expect(result.totalEntries).toBe(1);
      expect(result.successfulEntries).toBe(1);
      expect(result.validationErrors).toHaveLength(0);
    });

    it("should throw error when processing fails", () => {
      // Make the parser fail for this test only
      vi.mocked(parser.parseKenmeiExport).mockImplementationOnce(() => {
        throw new Error("Parser error");
      });

      expect(() => processKenmeiExport("invalid data")).toThrow(
        "Failed to process Kenmei data: Parser error",
      );
    });

    it("should use default options when none provided", () => {
      const fileContent = "{}"; // Minimal content

      // Reset the mock before this test
      vi.mocked(parser.parseKenmeiExport).mockClear();

      processKenmeiExport(fileContent);

      // Verify default options were used
      expect(parser.parseKenmeiExport).toHaveBeenCalledWith(
        fileContent,
        DEFAULT_PROCESS_OPTIONS.parseOptions,
      );
    });
  });

  describe("prepareEntryForSync", () => {
    const kenmeiManga: KenmeiManga = {
      id: 1,
      title: "Test Manga",
      status: "reading",
      score: 7,
      url: "https://example.com/manga/1",
      chapters_read: 42,
      volumes_read: 5,
      created_at: "2023-01-01T00:00:00Z",
      updated_at: "2023-04-01T00:00:00Z",
    };

    const anilistManga: AniListManga = {
      id: 101,
      title: {
        romaji: "Test Manga",
        english: "Test Manga",
        native: "テストマンガ",
      },
      format: "MANGA",
      status: "RELEASING",
      chapters: undefined,
      volumes: undefined,
      coverImage: { large: "https://example.com/cover.jpg" },
    };

    it("should prepare entry with correct mappings", () => {
      const result = prepareEntryForSync(kenmeiManga, anilistManga);

      expect(result.mediaId).toBe(101);
      expect(result.status).toBe("CURRENT"); // Mapped from "reading"
      expect(result.progress).toBe(42);
      expect(result.progressVolumes).toBe(5);
      expect(result.score).toBe(70); // Normalized from 7 to 70
    });

    it("should prefer volumes when option is enabled", () => {
      const result = prepareEntryForSync(kenmeiManga, anilistManga, {
        preferVolumes: true,
      });

      expect(result.progressVolumes).toBe(5);
    });

    it("should not normalize scores when disabled", () => {
      const result = prepareEntryForSync(kenmeiManga, anilistManga, {
        normalizeScores: false,
      });

      expect(result.score).toBe(7); // Not normalized
    });

    it("should omit score when it's zero", () => {
      const noScoreManga = { ...kenmeiManga, score: 0 };

      const result = prepareEntryForSync(noScoreManga, anilistManga);

      expect(result.score).toBeUndefined();
    });

    it("should use custom status mappings when provided", () => {
      // Set up custom mapping behavior for this test only
      vi.mocked(statusMapper.mapKenmeiToAniListStatus).mockReturnValueOnce(
        "REPEATING",
      );

      const result = prepareEntryForSync(kenmeiManga, anilistManga, {
        statusMapping: { reading: "REPEATING" },
      });

      expect(result.status).toBe("REPEATING");
    });
  });

  describe("extractReadingStats", () => {
    it("should extract correct statistics", () => {
      const mangaList: KenmeiManga[] = [
        {
          id: 1,
          title: "Reading Manga",
          status: "reading",
          score: 7,
          url: "https://example.com/manga/1",
          chapters_read: 42,
          volumes_read: 5,
          created_at: "2023-01-01T00:00:00Z",
          updated_at: "2023-04-01T00:00:00Z",
        },
        {
          id: 2,
          title: "Completed Manga",
          status: "completed",
          score: 8,
          url: "https://example.com/manga/2",
          chapters_read: 100,
          volumes_read: 10,
          created_at: "2023-01-01T00:00:00Z",
          updated_at: "2023-04-01T00:00:00Z",
        },
        {
          id: 3,
          title: "Plan to Read Manga",
          status: "plan_to_read",
          score: 0,
          url: "https://example.com/manga/3",
          chapters_read: 0,
          created_at: "2023-01-01T00:00:00Z",
          updated_at: "2023-04-01T00:00:00Z",
        },
      ];

      const stats = extractReadingStats(mangaList);

      expect(stats.totalChapters).toBe(142);
      expect(stats.totalVolumes).toBe(15);
      expect(stats.completedManga).toBe(1);
      expect(stats.inProgressManga).toBe(1);
      expect(stats.statusBreakdown).toEqual({
        reading: 1,
        completed: 1,
        plan_to_read: 1,
      });
    });

    it("should handle empty manga list", () => {
      const stats = extractReadingStats([]);

      expect(stats.totalChapters).toBe(0);
      expect(stats.totalVolumes).toBe(0);
      expect(stats.completedManga).toBe(0);
      expect(stats.inProgressManga).toBe(0);
      expect(stats.statusBreakdown).toEqual({});
    });

    it("should handle missing volume data", () => {
      const mangaList: KenmeiManga[] = [
        {
          id: 1,
          title: "No Volumes Manga",
          status: "reading",
          score: 7,
          url: "https://example.com/manga/1",
          chapters_read: 42,
          // No volumes_read
          created_at: "2023-01-01T00:00:00Z",
          updated_at: "2023-04-01T00:00:00Z",
        },
      ];

      const stats = extractReadingStats(mangaList);

      expect(stats.totalVolumes).toBe(0);
    });
  });

  describe("processMangaInBatches", () => {
    it("should process manga in batches", async () => {
      const mangaList: KenmeiManga[] = Array(10)
        .fill(null)
        .map((_, i) => ({
          id: i + 1,
          title: `Manga ${i + 1}`,
          status: "reading" as KenmeiStatus,
          score: 7,
          url: `https://example.com/manga/${i + 1}`,
          chapters_read: 42,
          created_at: "2023-01-01T00:00:00Z",
          updated_at: "2023-04-01T00:00:00Z",
        }));

      const processFn = vi.fn(async (batch: KenmeiManga[]) => {
        return batch.map((manga) => ({
          processed: true,
          id: manga.id,
        }));
      });

      const results = await processMangaInBatches(mangaList, processFn, 3);

      // Should have 10 results (one for each manga)
      expect(results).toHaveLength(10);

      // Should have called the process function 4 times (3 batches of 3, 1 batch of 1)
      expect(processFn).toHaveBeenCalledTimes(4);

      // Check the first call got 3 items
      expect(processFn.mock.calls[0][0]).toHaveLength(3);

      // Verify all items were processed
      expect(results.every((item) => item.processed)).toBe(true);
    });

    it("should handle empty manga list", async () => {
      const processFn = vi.fn(async () => {
        return [];
      });

      const results = await processMangaInBatches([], processFn);

      expect(results).toHaveLength(0);
      expect(processFn).not.toHaveBeenCalled();
    });
  });

  describe("filterMangaEntries", () => {
    const mangaList: KenmeiManga[] = [
      {
        id: 1,
        title: "Reading Manga",
        status: "reading",
        score: 7,
        url: "https://example.com/manga/1",
        chapters_read: 42,
        created_at: "2023-01-01T00:00:00Z",
        updated_at: "2023-04-01T00:00:00Z",
      },
      {
        id: 2,
        title: "Completed Manga",
        status: "completed",
        score: 8,
        url: "https://example.com/manga/2",
        chapters_read: 100,
        created_at: "2023-01-01T00:00:00Z",
        updated_at: "2023-04-01T00:00:00Z",
      },
      {
        id: 3,
        title: "Plan to Read Manga",
        status: "plan_to_read",
        score: 0,
        url: "https://example.com/manga/3",
        chapters_read: 0,
        created_at: "2023-01-01T00:00:00Z",
        updated_at: "2023-04-01T00:00:00Z",
      },
    ];

    it("should filter by status", () => {
      const filtered = filterMangaEntries(mangaList, {
        status: ["reading", "completed"],
      });

      expect(filtered).toHaveLength(2);
      expect(filtered[0].status).toBe("reading");
      expect(filtered[1].status).toBe("completed");
    });

    it("should filter by minimum chapters", () => {
      const filtered = filterMangaEntries(mangaList, {
        minChapters: 50,
      });

      expect(filtered).toHaveLength(1);
      expect(filtered[0].chapters_read).toBe(100);
    });

    it("should filter by having progress", () => {
      const filtered = filterMangaEntries(mangaList, {
        hasProgress: true,
      });

      expect(filtered).toHaveLength(2);
      expect(filtered.every((manga) => manga.chapters_read > 0)).toBe(true);
    });

    it("should filter by having score", () => {
      const filtered = filterMangaEntries(mangaList, {
        hasScore: true,
      });

      expect(filtered).toHaveLength(2);
      expect(filtered.every((manga) => manga.score > 0)).toBe(true);
    });

    it("should apply multiple filters together", () => {
      const filtered = filterMangaEntries(mangaList, {
        status: ["reading", "completed"],
        minChapters: 50,
        hasScore: true,
      });

      expect(filtered).toHaveLength(1);
      expect(filtered[0].title).toBe("Completed Manga");
    });

    it("should return all entries when no filters provided", () => {
      const filtered = filterMangaEntries(mangaList, {});

      expect(filtered).toHaveLength(3);
    });
  });
});
