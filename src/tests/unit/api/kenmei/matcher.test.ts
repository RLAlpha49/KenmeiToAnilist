import { describe, it, expect } from "vitest";
import {
  calculateSimilarity,
  scoreMatch,
  findBestMatch,
} from "@/api/kenmei/matcher";
import { KenmeiManga } from "@/api/kenmei/types";
import { AniListManga } from "@/api/anilist/types";

describe("matcher", () => {
  describe("calculateSimilarity", () => {
    it("should return high similarity for identical strings", () => {
      const similarity = calculateSimilarity("One Piece", "One Piece");
      expect(similarity).toBe(1);
    });

    it("should return high similarity for case-insensitive identical strings", () => {
      const similarity = calculateSimilarity("One Piece", "one piece");
      expect(similarity).toBe(1);
    });

    it("should return lower similarity for different strings", () => {
      const similarity = calculateSimilarity("One Piece", "Two Piece");
      expect(similarity).toBeGreaterThan(0);
      expect(similarity).toBeLessThan(1);
    });

    it("should return 0 for completely different strings", () => {
      const similarity = calculateSimilarity("One Piece", "Attack on Titan");
      expect(similarity).toBeLessThan(0.5);
    });

    it("should handle empty strings", () => {
      expect(calculateSimilarity("", "")).toBe(0);
      expect(calculateSimilarity("One Piece", "")).toBe(0);
      expect(calculateSimilarity("", "One Piece")).toBe(0);
    });

    it("should handle null or undefined values", () => {
      expect(calculateSimilarity("One Piece", null as any)).toBe(0);
      expect(calculateSimilarity(undefined as any, "One Piece")).toBe(0);
      expect(calculateSimilarity(null as any, null as any)).toBe(0);
    });
  });

  describe("scoreMatch", () => {
    const kenmeiManga: KenmeiManga = {
      id: 1,
      title: "One Piece",
      status: "reading",
      score: 8,
      url: "https://example.com/manga/1",
      chapters_read: 1000,
      created_at: "2023-01-01T00:00:00Z",
      updated_at: "2023-04-01T00:00:00Z",
    };

    it("should return high score for exact title match", () => {
      const anilistManga: AniListManga = {
        id: 101,
        title: {
          romaji: "One Piece",
          english: "One Piece",
          native: "ワンピース",
        },
        type: "MANGA",
        format: "MANGA",
        status: "RELEASING",
        startYear: 1999,
        chapters: null,
        volumes: null,
        coverImage: { large: "https://example.com/cover.jpg" },
      };

      const score = scoreMatch(kenmeiManga, anilistManga);
      expect(score).toBe(1);
    });

    it("should match against any of the available titles", () => {
      const anilistManga: AniListManga = {
        id: 101,
        title: {
          romaji: "Wan Pisu",
          english: "One Piece",
          native: "ワンピース",
        },
        type: "MANGA",
        format: "MANGA",
        status: "RELEASING",
        startYear: 1999,
        chapters: null,
        volumes: null,
        coverImage: { large: "https://example.com/cover.jpg" },
      };

      const score = scoreMatch(kenmeiManga, anilistManga);
      expect(score).toBe(1);
    });

    it("should return the highest match score from all available titles", () => {
      const anilistManga: AniListManga = {
        id: 101,
        title: {
          romaji: "Wan Pisu",
          english: "One Piece",
          native: null,
        },
        type: "MANGA",
        format: "MANGA",
        status: "RELEASING",
        startYear: 1999,
        chapters: null,
        volumes: null,
        coverImage: { large: "https://example.com/cover.jpg" },
      };

      const score = scoreMatch(kenmeiManga, anilistManga);
      // Should return the highest score (1.0 for "One Piece")
      expect(score).toBe(1);
    });

    it("should handle missing title values", () => {
      const anilistManga: AniListManga = {
        id: 101,
        title: {
          romaji: null,
          english: "One Piece",
          native: null,
        },
        type: "MANGA",
        format: "MANGA",
        status: "RELEASING",
        startYear: 1999,
        chapters: null,
        volumes: null,
        coverImage: { large: "https://example.com/cover.jpg" },
      };

      const score = scoreMatch(kenmeiManga, anilistManga);
      expect(score).toBe(1);
    });

    it("should return 0 if no titles available", () => {
      const anilistManga: AniListManga = {
        id: 101,
        title: {
          romaji: null,
          english: null,
          native: null,
        },
        type: "MANGA",
        format: "MANGA",
        status: "RELEASING",
        startYear: 1999,
        chapters: null,
        volumes: null,
        coverImage: { large: "https://example.com/cover.jpg" },
      };

      const score = scoreMatch(kenmeiManga, anilistManga);
      expect(score).toBe(0);
    });
  });

  describe("findBestMatch", () => {
    const kenmeiManga: KenmeiManga = {
      id: 1,
      title: "One Piece",
      status: "reading",
      score: 8,
      url: "https://example.com/manga/1",
      chapters_read: 1000,
      created_at: "2023-01-01T00:00:00Z",
      updated_at: "2023-04-01T00:00:00Z",
    };

    const anilistMangaList: AniListManga[] = [
      {
        id: 101,
        title: {
          romaji: "Naruto",
          english: "Naruto",
          native: "ナルト",
        },
        type: "MANGA",
        format: "MANGA",
        status: "FINISHED",
        startYear: 1999,
        chapters: 700,
        volumes: 72,
        coverImage: { large: "https://example.com/naruto.jpg" },
      },
      {
        id: 102,
        title: {
          romaji: "One Piece",
          english: "One Piece",
          native: "ワンピース",
        },
        type: "MANGA",
        format: "MANGA",
        status: "RELEASING",
        startYear: 1999,
        chapters: null,
        volumes: null,
        coverImage: { large: "https://example.com/onepiece.jpg" },
      },
      {
        id: 103,
        title: {
          romaji: "One Punch Man",
          english: "One-Punch Man",
          native: "ワンパンマン",
        },
        type: "MANGA",
        format: "MANGA",
        status: "RELEASING",
        startYear: 2012,
        chapters: null,
        volumes: null,
        coverImage: { large: "https://example.com/onepunchman.jpg" },
      },
    ];

    it("should find the exact match with highest score", () => {
      const match = findBestMatch(kenmeiManga, anilistMangaList);
      expect(match).not.toBeNull();
      expect(match?.manga.id).toBe(102);
      expect(match?.score).toBe(1);
    });

    it("should return null for empty AniList manga list", () => {
      const match = findBestMatch(kenmeiManga, []);
      expect(match).toBeNull();
    });

    it("should return null if no match meets the threshold", () => {
      const noMatch = findBestMatch(
        { ...kenmeiManga, title: "Unique Title With No Match" },
        anilistMangaList,
        0.9,
      );
      expect(noMatch).toBeNull();
    });

    it("should find a match with a lower threshold", () => {
      const similarTitle: KenmeiManga = {
        ...kenmeiManga,
        title: "One Punch-Man", // Similar to "One Punch Man"
      };

      const match = findBestMatch(similarTitle, anilistMangaList, 0.6);
      expect(match).not.toBeNull();
      expect(match?.manga.id).toBe(103);
      expect(match?.score).toBeGreaterThan(0.6);
    });

    it("should return the best match when multiple potential matches exist", () => {
      const ambiguousTitle: KenmeiManga = {
        ...kenmeiManga,
        title: "One", // Could match with "One Piece" or "One Punch Man"
      };

      const match = findBestMatch(ambiguousTitle, anilistMangaList, 0.1);
      expect(match).not.toBeNull();
      // Should pick the best match based on score
      expect(["102", "103"]).toContain(match?.manga.id.toString());
    });
  });
});
