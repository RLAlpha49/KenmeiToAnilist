import { describe, it, expect } from "vitest";
import {
  generateUpdateMangaEntryMutation,
  DELETE_MANGA_ENTRY,
} from "@/api/anilist/mutations";

describe("AniList GraphQL Mutations", () => {
  describe("generateUpdateMangaEntryMutation", () => {
    it("should generate a valid GraphQL mutation string", () => {
      const variables = { mediaId: 123, status: "CURRENT", progress: 42 };
      const mutation = generateUpdateMangaEntryMutation(variables);

      expect(typeof mutation).toBe("string");
      expect(mutation).toContain("mutation");
      expect(mutation).toContain("SaveMediaListEntry");
    });

    it("should include manga-specific fields", () => {
      const variables = { mediaId: 123, status: "CURRENT", progress: 42 };
      const mutation = generateUpdateMangaEntryMutation(variables);

      expect(mutation).toContain("mediaId");
      expect(mutation).toContain("status");
      expect(mutation).toContain("progress");
    });

    it("should include only necessary variables in the mutation", () => {
      const variables = { mediaId: 123 };
      const mutation = generateUpdateMangaEntryMutation(variables);

      expect(mutation).toContain("$mediaId: Int!");
      expect(mutation).not.toContain("$status");
      expect(mutation).not.toContain("$progress");

      // Add status and check if it's included now
      const variablesWithStatus = { mediaId: 123, status: "CURRENT" };
      const mutationWithStatus =
        generateUpdateMangaEntryMutation(variablesWithStatus);

      expect(mutationWithStatus).toContain("$status: MediaListStatus");
      expect(mutationWithStatus).not.toContain("$progress");
    });
  });

  describe("DELETE_MANGA_ENTRY", () => {
    it("should be a valid GraphQL mutation string", () => {
      expect(typeof DELETE_MANGA_ENTRY).toBe("string");
      expect(DELETE_MANGA_ENTRY).toContain("mutation");
      expect(DELETE_MANGA_ENTRY).toContain("DeleteMediaListEntry");
    });

    it("should include id parameter", () => {
      expect(DELETE_MANGA_ENTRY).toContain("id");
    });

    it("should accept variable for entry id", () => {
      expect(DELETE_MANGA_ENTRY).toContain("$id");
    });
  });
});
