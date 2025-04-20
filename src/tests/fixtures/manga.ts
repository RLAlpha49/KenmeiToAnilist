/**
 * Test fixtures for manga data
 */

import { KenmeiStatus } from "@/api/kenmei/types";
import { MediaListStatus } from "@/api/anilist/types";

/**
 * Mock Kenmei manga entries for testing
 */
export const mockKenmeiManga = [
  {
    id: 1,
    title: "One Piece",
    status: "reading" as KenmeiStatus,
    chapters_read: 1050,
    updated_at: "2024-04-01T12:00:00Z",
  },
  {
    id: 2,
    title: "Naruto",
    status: "completed" as KenmeiStatus,
    chapters_read: 700,
    updated_at: "2023-10-15T14:30:00Z",
  },
  {
    id: 3,
    title: "Bleach",
    status: "on_hold" as KenmeiStatus,
    chapters_read: 300,
    updated_at: "2023-09-20T09:45:00Z",
  },
  {
    id: 4,
    title: "Death Note",
    status: "completed" as KenmeiStatus,
    chapters_read: 108,
    updated_at: "2023-06-05T18:20:00Z",
  },
  {
    id: 5,
    title: "Attack on Titan",
    status: "plan_to_read" as KenmeiStatus,
    chapters_read: 0,
    updated_at: "2024-01-20T22:10:00Z",
  },
];

/**
 * Mock AniList manga entries for testing
 */
export const mockAniListManga = [
  {
    id: 101,
    title: {
      english: "One Piece",
      romaji: "One Piece",
      native: "ワンピース",
    },
    status: "CURRENT" as MediaListStatus,
    progress: 1050,
    chapters: 1100,
    updatedAt: 1712044800,
  },
  {
    id: 102,
    title: {
      english: "Naruto",
      romaji: "Naruto",
      native: "ナルト",
    },
    status: "COMPLETED" as MediaListStatus,
    progress: 700,
    chapters: 700,
    updatedAt: 1697385000,
  },
  {
    id: 103,
    title: {
      english: "Bleach",
      romaji: "Bleach",
      native: "ブリーチ",
    },
    status: "PAUSED" as MediaListStatus,
    progress: 300,
    chapters: 686,
    updatedAt: 1695208800,
  },
  {
    id: 104,
    title: {
      english: "Death Note",
      romaji: "Death Note",
      native: "デスノート",
    },
    status: "COMPLETED" as MediaListStatus,
    progress: 108,
    chapters: 108,
    updatedAt: 1685990400,
  },
  {
    id: 105,
    title: {
      english: "Attack on Titan",
      romaji: "Shingeki no Kyojin",
      native: "進撃の巨人",
    },
    status: "PLANNING" as MediaListStatus,
    progress: 0,
    chapters: 139,
    updatedAt: 1705795800,
  },
];

/**
 * Mock AniList user for testing
 */
export const mockAniListUser = {
  id: 12345,
  name: "TestUser",
  avatar: {
    large: "https://example.com/avatar.jpg",
  },
  options: {
    titleLanguage: "ENGLISH",
    displayAdultContent: false,
  },
};

/**
 * Mock mapping between Kenmei and AniList entries
 */
export const mockMangaMatches = [
  { kenmeiId: 1, anilistId: 101, confidence: 0.95 },
  { kenmeiId: 2, anilistId: 102, confidence: 0.98 },
  { kenmeiId: 3, anilistId: 103, confidence: 0.9 },
  { kenmeiId: 4, anilistId: 104, confidence: 0.99 },
  { kenmeiId: 5, anilistId: 105, confidence: 0.93 },
];
