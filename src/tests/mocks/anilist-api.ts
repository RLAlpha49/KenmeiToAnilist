/**
 * Mock for AniList API
 */
import { mockAniListManga, mockAniListUser } from "../fixtures/manga";
import { MediaListStatus } from "@/api/anilist/types";

/**
 * Mock AniList API service
 */
export class MockAniListApi {
  private user = { ...mockAniListUser };
  private mangaList = [...mockAniListManga];

  /**
   * Mock authentication
   */
  async authenticate(): Promise<boolean> {
    return true;
  }

  /**
   * Mock getUser
   */
  async getUser() {
    return this.user;
  }

  /**
   * Mock getUserMangaList
   */
  async getUserMangaList() {
    return this.mangaList;
  }

  /**
   * Mock getMangaDetails
   */
  async getMangaDetails(id: number) {
    const manga = this.mangaList.find((m) => m.id === id);
    if (!manga) {
      throw new Error(`Manga with ID ${id} not found`);
    }
    return manga;
  }

  /**
   * Mock updateMangaEntry
   */
  async updateMangaEntry(
    mediaId: number,
    status: MediaListStatus,
    progress: number,
    isPrivate: boolean = false,
  ) {
    const mangaIndex = this.mangaList.findIndex((m) => m.id === mediaId);
    if (mangaIndex === -1) {
      throw new Error(`Manga with ID ${mediaId} not found`);
    }

    // Update the manga
    this.mangaList[mangaIndex] = {
      ...this.mangaList[mangaIndex],
      status,
      progress,
      private: isPrivate,
      updatedAt: Math.floor(Date.now() / 1000),
    };

    return {
      id: mediaId,
      status,
      progress,
    };
  }

  /**
   * Mock searchManga
   */
  async searchManga(query: string) {
    // Simple search mock that returns manga with titles containing the query
    return this.mangaList.filter(
      (manga) =>
        manga.title.english?.toLowerCase().includes(query.toLowerCase()) ||
        manga.title.romaji?.toLowerCase().includes(query.toLowerCase()) ||
        manga.title.native?.includes(query),
    );
  }

  /**
   * Reset the mock state
   */
  reset() {
    this.user = { ...mockAniListUser };
    this.mangaList = [...mockAniListManga];
  }
}
