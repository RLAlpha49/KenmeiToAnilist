import { describe, it, expect } from "vitest";
import {
  GET_VIEWER,
  GET_USER_MANGA_LIST,
  SEARCH_MANGA,
  ADVANCED_SEARCH_MANGA,
  GET_MANGA_BY_ID,
  GET_MANGA_BY_IDS,
} from "@/api/anilist/queries";

describe("AniList GraphQL Queries", () => {
  describe("GET_VIEWER", () => {
    it("should be a valid GraphQL query string", () => {
      expect(typeof GET_VIEWER).toBe("string");
      expect(GET_VIEWER).toContain("query");
      expect(GET_VIEWER).toContain("Viewer");
      expect(GET_VIEWER).toContain("id");
      expect(GET_VIEWER).toContain("name");
    });

    it("should include avatar information", () => {
      expect(GET_VIEWER).toContain("avatar");
    });
  });

  describe("GET_USER_MANGA_LIST", () => {
    it("should be a valid GraphQL query string", () => {
      expect(typeof GET_USER_MANGA_LIST).toBe("string");
      expect(GET_USER_MANGA_LIST).toContain("query");
      expect(GET_USER_MANGA_LIST).toContain("MediaListCollection");
      expect(GET_USER_MANGA_LIST).toContain("userId");
    });

    it("should specify MANGA as the type", () => {
      expect(GET_USER_MANGA_LIST).toContain("type: MANGA");
    });

    it("should include list entries and media details", () => {
      expect(GET_USER_MANGA_LIST).toContain("lists");
      expect(GET_USER_MANGA_LIST).toContain("entries");
      expect(GET_USER_MANGA_LIST).toContain("progress");
      expect(GET_USER_MANGA_LIST).toContain("media");
    });
  });

  describe("SEARCH_MANGA", () => {
    it("should be a valid GraphQL query string", () => {
      expect(typeof SEARCH_MANGA).toBe("string");
      expect(SEARCH_MANGA).toContain("query");
      expect(SEARCH_MANGA).toContain("media");
      expect(SEARCH_MANGA).toContain("search");
      expect(SEARCH_MANGA).toContain("title");
    });

    it("should specify MANGA as the type", () => {
      expect(SEARCH_MANGA).toContain("type: MANGA");
    });

    it("should include pagination parameters", () => {
      expect(SEARCH_MANGA).toContain("$page");
      expect(SEARCH_MANGA).toContain("$perPage");
    });
  });

  describe("ADVANCED_SEARCH_MANGA", () => {
    it("should be a valid GraphQL query string", () => {
      expect(typeof ADVANCED_SEARCH_MANGA).toBe("string");
      expect(ADVANCED_SEARCH_MANGA).toContain("query");
      expect(ADVANCED_SEARCH_MANGA).toContain("Media");
      expect(ADVANCED_SEARCH_MANGA).toContain("search");
    });

    it("should specify MANGA as the type", () => {
      expect(ADVANCED_SEARCH_MANGA).toContain("type: MANGA");
    });

    it("should include advanced search parameters", () => {
      expect(ADVANCED_SEARCH_MANGA).toContain("$genre_in");
      expect(ADVANCED_SEARCH_MANGA).toContain("$tag_in");
      expect(ADVANCED_SEARCH_MANGA).toContain("$format_in");
    });
  });

  describe("GET_MANGA_BY_ID", () => {
    it("should be a valid GraphQL query string", () => {
      expect(typeof GET_MANGA_BY_ID).toBe("string");
      expect(GET_MANGA_BY_ID).toContain("query");
      expect(GET_MANGA_BY_ID).toContain("Media");
      expect(GET_MANGA_BY_ID).toContain("id");
    });

    it("should specify MANGA as the type", () => {
      expect(GET_MANGA_BY_ID).toContain("type: MANGA");
    });

    it("should include detailed manga fields", () => {
      expect(GET_MANGA_BY_ID).toContain("chapters");
      expect(GET_MANGA_BY_ID).toContain("volumes");
      expect(GET_MANGA_BY_ID).toContain("status");
      expect(GET_MANGA_BY_ID).toContain("coverImage");
    });
  });

  describe("GET_MANGA_BY_IDS", () => {
    it("should be a valid GraphQL query string", () => {
      expect(typeof GET_MANGA_BY_IDS).toBe("string");
      expect(GET_MANGA_BY_IDS).toContain("query");
      expect(GET_MANGA_BY_IDS).toContain("Page");
      expect(GET_MANGA_BY_IDS).toContain("$ids");
    });

    it("should include ID array parameter", () => {
      expect(GET_MANGA_BY_IDS).toContain("id_in: $ids");
    });

    it("should specify MANGA as the type", () => {
      expect(GET_MANGA_BY_IDS).toContain("type: MANGA");
    });
  });
});
